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
    // Initial update
    await this.update();
    // Schedule regular updates
    this.scheduleNextUpdate();
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

  toJSON() {
    return {};
  }
}
