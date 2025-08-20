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
import CacheKeys from "./cacheKeys.js";
import { createClient } from "../baseNodeClient.js";
import { collectAsyncIterable } from "./grpcHelpers.js";
import { miningStats } from "./stats.js";

const logger = pino({ name: "background-updater" });

export default class BackgroundUpdater {
  updateInterval: number;
  maxRetries: number;
  retryDelay: number;
  data: any;
  isUpdating: boolean;
  lastSuccessfulUpdate: Date | null;
  from: number;
  limit: number;
  
  // Redis update intervals
  dashboardUpdateInterval: number;
  mempoolUpdateInterval: number;
  miningStatsUpdateInterval: number;
  tipUpdateInterval: number;
  networkStatsUpdateInterval: number;
  
  // Last update timestamps for different data types
  lastDashboardUpdate: Date | null;
  lastMempoolUpdate: Date | null;
  lastMiningStatsUpdate: Date | null;
  lastTipUpdate: Date | null;
  lastNetworkStatsUpdate: Date | null;

  constructor(
    options: {
      updateInterval?: number;
      maxRetries?: number;
      retryDelay?: number;
      dashboardUpdateInterval?: number;
      mempoolUpdateInterval?: number;
      miningStatsUpdateInterval?: number;
      tipUpdateInterval?: number;
      networkStatsUpdateInterval?: number;
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
    
    // Redis update intervals
    this.dashboardUpdateInterval = options.dashboardUpdateInterval || 45000; // 45 seconds
    this.mempoolUpdateInterval = options.mempoolUpdateInterval || 20000; // 20 seconds
    this.miningStatsUpdateInterval = options.miningStatsUpdateInterval || 120000; // 2 minutes
    this.tipUpdateInterval = options.tipUpdateInterval || 30000; // 30 seconds
    this.networkStatsUpdateInterval = options.networkStatsUpdateInterval || 300000; // 5 minutes
    
    // Initialize last update timestamps
    this.lastDashboardUpdate = null;
    this.lastMempoolUpdate = null;
    this.lastMiningStatsUpdate = null;
    this.lastTipUpdate = null;
    this.lastNetworkStatsUpdate = null;
  }

  async start() {
    // Initial updates for both legacy and Redis
    await this.update();
    await this.updateAllRedisData();
    
    // Schedule regular updates
    this.scheduleNextUpdate();
    this.scheduleRedisUpdates();
  }

  async update() {
    if (this.isUpdating) {
      return;
    }

    this.isUpdating = true;
    let attempts = 0;

    while (attempts < this.maxRetries) {
      try {
        const startTs = Date.now();

        await this.updateTipData();
        await this.updateMiningStats();

        const newData = await getIndexData(this.from, this.limit);
        if (newData) {
          this.data = newData;
          this.lastSuccessfulUpdate = new Date();
          logger.info({ duration: Date.now() - startTs }, `data updated`);
          break;
        }
        throw new Error("Received null data from getIndexData");
      } catch (error: any) {
        logger.error(
          error,
          `Update attempt ${attempts + 1} failed: ${error.message}`,
        );
        attempts++;

        if (attempts === this.maxRetries) {
          break;
        }

        await new Promise((resolve) => setTimeout(resolve, this.retryDelay));
      }
    }

    this.isUpdating = false;
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

  async updateAllRedisData() {
    const now = Date.now();
    
    // Update dashboard data
    if (!this.lastDashboardUpdate || 
        now - this.lastDashboardUpdate.getTime() >= this.dashboardUpdateInterval) {
      await this.updateDashboardData();
    }
    
    // Update mempool data
    if (!this.lastMempoolUpdate || 
        now - this.lastMempoolUpdate.getTime() >= this.mempoolUpdateInterval) {
      await this.updateMempoolData();
    }

    // Update network stats
    if (!this.lastNetworkStatsUpdate || 
        now - this.lastNetworkStatsUpdate.getTime() >= this.networkStatsUpdateInterval) {
      await this.updateNetworkStats();
    }
  }
  
  async updateDashboardData() {
    if (!cacheService.isConnected()) {
      logger.warn('Redis not connected, skipping dashboard data update');
      return;
    }
    
    try {
      const startTs = Date.now();
      const dashboardData = await getIndexData(this.from, this.limit);
      
      if (dashboardData) {
        await cacheService.set(CacheKeys.DASHBOARD_DATA, dashboardData, 90); // 90 second TTL
        this.lastDashboardUpdate = new Date();
        logger.info({ duration: Date.now() - startTs }, 'Dashboard data updated in Redis');
      }
    } catch (error: any) {
      logger.error(error, 'Failed to update dashboard data in Redis');
    }
  }
  
  async updateMempoolData() {
    if (!cacheService.isConnected()) {
      logger.warn('Redis not connected, skipping mempool data update');
      return;
    }
    
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
      this.lastMempoolUpdate = new Date();
      logger.info({ duration: Date.now() - startTs }, 'Mempool data updated in Redis');
    } catch (error: any) {
      logger.error(error, 'Failed to update mempool data in Redis');
    }
  }
  
  async updateMiningStats() {
    if (!cacheService.isConnected()) {
      logger.warn('Redis not connected, skipping mining stats update');
      return;
    }
    
    try {
      const startTs = Date.now();
      const client = createClient();
      const tipInfo = await client.getTipInfo({});
      const tipHeight = tipInfo?.metadata?.best_block_height || 0n;
      
      const limit = 20;
      const blocks = await collectAsyncIterable(
        client.getBlocks({
          heights: Array.from({ length: limit }, (_, i) => tipHeight - BigInt(i)),
        })
      );
      
      const stats = blocks
        .map((block) => ({
          height: block?.block?.header?.height || 0n,
          ...miningStats(block, false),
        }))
        .sort((a, b) => Number(b.height - a.height));
      
      await cacheService.set(CacheKeys.MINING_STATS_RECENT, stats, 300); // 5 minute TTL
      this.lastMiningStatsUpdate = new Date();
      logger.info({ duration: Date.now() - startTs }, 'Mining stats updated in Redis');
    } catch (error: any) {
      logger.error(error, 'Failed to update mining stats in Redis');
    }
  }
  
  async updateTipData() {
    try {
      const startTs = Date.now();
      const client = createClient();
      const tipInfo = await client.getTipInfo({});
      
      const tipData = {
        height: tipInfo?.metadata?.best_block_height || 0n,
        timestamp: tipInfo?.metadata?.timestamp || 0n,
        lastUpdate: new Date()
      };
      
      await cacheService.set(CacheKeys.TIP_CURRENT, tipData, 300); // 5 minutes TTL
      this.lastTipUpdate = new Date();
      logger.info({ duration: Date.now() - startTs }, 'Tip data updated in Redis');
    } catch (error: any) {
      logger.error(error, 'Failed to update tip data in Redis');
    }
  }
  
  async updateNetworkStats() {
    if (!cacheService.isConnected()) {
      logger.warn('Redis not connected, skipping network stats update');
      return;
    }
    
    try {
      const startTs = Date.now();
      const client = createClient();
      const lastDifficulties = await collectAsyncIterable(
        client.getNetworkDifficulty({ from_tip: 720n }),
      );
      
      await cacheService.set(CacheKeys.NETWORK_STATS, lastDifficulties, 360); // 6 minute TTL
      this.lastNetworkStatsUpdate = new Date();
      logger.info({ duration: Date.now() - startTs }, 'Network stats updated in Redis');
    } catch (error: any) {
      logger.error(error, 'Failed to update network stats in Redis');
    }
  }
  
  scheduleRedisUpdates() {
    // Schedule dashboard updates
    setTimeout(() => {
      this.updateDashboardData().finally(() => {
        this.scheduleRedisUpdates();
      });
    }, this.dashboardUpdateInterval);
    
    // Schedule mempool updates (more frequent)
    setTimeout(() => {
      this.updateMempoolData();
    }, this.mempoolUpdateInterval);
    // Schedule network stats updates
    setTimeout(() => {
      this.updateNetworkStats();
    }, this.networkStatsUpdateInterval);
  }
  
  toJSON() {
    return {};
  }
}
