// Copyright 2021. The Tari Project
//
// Redistribution and use in source and binary forms, with or without modification, are permitted provided that the
// following conditions are met:
//
// 1. Redistributions of source code must retain the above copyright notice, this list of conditions and the following
// disclaimer.
//
// 2. Redistributions in binary form must reproduce the above copyright notice, this list of conditions and the
// following disclaimer in the documentation and/or other materials provided with the distribution.
//
// 3. Neither the name of the copyright holder nor the names of its contributors may be used to endorse or promote
// products derived from this software without specific prior written permission.
//
// THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND ANY EXPRESS OR IMPLIED WARRANTIES,
// INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
// DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL,
// SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR
// SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY,
// WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE
// USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.

import { pino } from "pino";
import { getIndexData } from "../routes/index.js";
import cacheService from "./cacheService.js";
import CacheKeys, { LockKeys } from "./cacheKeys.js";
import { createClient } from "../baseNodeClient.js";
import { collectAsyncIterable } from "./grpcHelpers.js";
import { miningStats } from "./stats.js";
import distributedLock from "./distributedLock.js";

const logger = pino({ name: "background-updater" });

const DEFAULT_REDIS_TTL = 300; // 5 min

export default class BackgroundUpdater {
  updateInterval: number;
  maxRetries: number;
  retryDelay: number;
  data: any;
  isUpdating: boolean;
  lastSuccessfulUpdate: Date | null;
  from: number;
  limit: number;

  constructor(
    options: {
      updateInterval?: number;
      maxRetries?: number;
      retryDelay?: number;
    } = {},
  ) {
    this.updateInterval = options.updateInterval || 60000; // 1 minute
    this.maxRetries = options.maxRetries || 3;
    this.retryDelay = options.retryDelay || 5000; // 5 seconds
    this.data = null;
    this.isUpdating = false;
    this.lastSuccessfulUpdate = null;

    this.from = 0;
    this.limit = 20;
  }

  async start() {
    await this.update();

    // Schedule regular updates
    this.scheduleNextUpdate();
  }

  async update() {
    if (this.isUpdating) {
      return;
    }

    // Generate unique lock identifier for this instance
    const lockId = distributedLock.generateLockId();
    const lockKey = LockKeys.BACKGROUND_UPDATER_MAIN;

    // Try to acquire distributed lock with 5 minute TTL
    const lockAcquired = await distributedLock.acquire(lockKey, lockId, 300, true);

    if (!lockAcquired) {
      // Another instance is handling the update
      logger.info("Background update skipped - another instance is currently updating");

      // Check lock status for debugging
      const lockStatus = await distributedLock.status(lockKey);
      if (lockStatus.held) {
        logger.debug(`Update lock held by: ${lockStatus.holder}, TTL: ${lockStatus.ttl}s`);
      }

      return;
    }

    this.isUpdating = true;
    let attempts = 0;

    const client = createClient();

    try {
      while (attempts < this.maxRetries) {
        try {
          const startTs = Date.now();
          logger.info(`Starting background update with lock: ${lockId}`);

          const tipInfo = await client.getTipInfo({});
          const cachedTip = await cacheService.get<{ height: bigint; timestamp: bigint }>(CacheKeys.TIP_CURRENT);
          if (cachedTip && cachedTip.height === tipInfo?.metadata?.best_block_height) {
            logger.debug(`Tip height ${tipInfo?.metadata?.best_block_height} unchanged, skipping update`);
            break;
          }

          await Promise.all([
            this.updateTipData(tipInfo),
            this.updateNetworkStats(),
            this.updateMiningStats(tipInfo),
            this.updateMempoolData(),
          ]);

          const newData = await getIndexData(this.from, this.limit, tipInfo);
          if (newData) {
            this.data = newData;
            this.lastSuccessfulUpdate = new Date();
            logger.info(
              {
                duration: Date.now() - startTs,
                lockId,
              },
              `Background update completed successfully`,
            );
            break;
          }
          throw new Error("Received null data from getIndexData");
        } catch (error: any) {
          logger.error(error, `Update attempt ${attempts + 1} failed: ${error.message}`);
          attempts++;

          if (attempts === this.maxRetries) {
            logger.error(`All ${this.maxRetries} update attempts failed, releasing lock`);
            break;
          }

          await new Promise((resolve) => setTimeout(resolve, this.retryDelay));
        }
      }
    } finally {
      // Always release the lock when done
      const released = await distributedLock.release(lockKey, lockId);
      if (released) {
        logger.info(`Background update lock released: ${lockId}`);
      } else {
        logger.warn(`Failed to release background update lock: ${lockId}`);
      }

      this.isUpdating = false;
    }
  }

  scheduleNextUpdate() {
    setTimeout(() => {
      this.update().finally(() => this.scheduleNextUpdate());
    }, this.updateInterval);
  }

  getData() {
    return {
      indexData: this.data,
      lastUpdate: this.lastSuccessfulUpdate,
    };
  }

  isHealthy(settings: { from: number; limit: number }) {
    if (settings.from !== this.from || settings.limit !== this.limit)
      return false;
    if (!this.lastSuccessfulUpdate) return false;

    const timeSinceLastUpdate =
      Date.now() - this.lastSuccessfulUpdate.getTime();
    // Consider unhealthy if last successful update was more than 5 minutes ago
    return timeSinceLastUpdate < 300000;
  }

  async updateMempoolData() {
    try {
      const startTs = Date.now();
      const client = createClient();
      const mempool = await collectAsyncIterable(client.getMempoolTransactions({}));

      // Add fee calculations
      for (let i = 0; i < mempool.length; i++) {
        let sum = 0n;
        for (let j = 0; j < (mempool[i]?.transaction?.body?.kernels?.length || 0); j++) {
          sum += mempool[i]?.transaction?.body?.kernels[j]?.fee || 0n;
        }
        (mempool[i]?.transaction?.body as any).total_fees = sum;
      }

      await cacheService.set(CacheKeys.MEMPOOL_CURRENT, mempool, 40); // 40 second TTL
      logger.info({ duration: Date.now() - startTs }, "Mempool data updated in Redis");
    } catch (error: any) {
      logger.error(error, "Failed to update mempool data in Redis");
    }
  }

  async updateMiningStats(tipInfo) {
    try {
      const startTs = Date.now();
      const client = createClient();
      const tipHeight = tipInfo?.metadata?.best_block_height || 0n;

      const limit = 20;
      const blocks = await collectAsyncIterable(
        client.getBlocks({
          heights: Array.from({ length: limit }, (_, i) => tipHeight - BigInt(i)),
        }),
      );

      const stats = blocks
        .map((block) => ({
          height: block?.block?.header?.height || 0n,
          ...miningStats(block, false),
        }))
        .sort((a, b) => Number(b.height - a.height));

      await cacheService.set(CacheKeys.MINING_STATS_RECENT, stats, DEFAULT_REDIS_TTL);
      logger.info({ duration: Date.now() - startTs }, "Mining stats updated in Redis");
    } catch (error: any) {
      logger.error(error, "Failed to update mining stats in Redis");
    }
  }

  async updateTipData(tipInfo) {
    try {
      const startTs = Date.now();

      const tipData = {
        height: tipInfo?.metadata?.best_block_height || 0n,
        timestamp: tipInfo?.metadata?.timestamp || 0n,
        lastUpdate: new Date(),
      };

      const cachedTip = await cacheService.get<{
        height: bigint;
        timestamp: bigint;
      }>(CacheKeys.TIP_CURRENT);
      if (cachedTip && cachedTip.height > tipData.height) {
        logger.warn(`Current tip height ${tipData.height} is less than cached height ${cachedTip.height}, skipping update`);
        return;
      }

      await cacheService.set(CacheKeys.TIP_CURRENT, tipData, DEFAULT_REDIS_TTL);
      logger.info({ duration: Date.now() - startTs }, "Tip data updated in Redis");
    } catch (error: any) {
      logger.error(error, "Failed to update tip data in Redis");
    }
  }

  async updateNetworkStats() {
    try {
      const startTs = Date.now();
      const client = createClient();
      const lastDifficulties = await collectAsyncIterable(client.getNetworkDifficulty({ from_tip: 720n }));

      await cacheService.set(CacheKeys.NETWORK_STATS, lastDifficulties, DEFAULT_REDIS_TTL);
      logger.info({ duration: Date.now() - startTs }, "Network stats updated in Redis");
    } catch (error: any) {
      logger.error(error, "Failed to update network stats in Redis");
    }
  }

  toJSON() {
    return {};
  }
}
