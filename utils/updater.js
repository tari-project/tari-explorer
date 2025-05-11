import pino from "pino";
import { getIndexData } from "../routes/index.js";

const logger = pino({ name: "background-updater" });

export default class BackgroundUpdater {
  constructor(options = {}) {
    this.updateInterval = options.updateInterval || 60000; // 1 minute
    this.maxRetries = options.maxRetries || 3;
    this.retryDelay = options.retryDelay || 5000; // 5 seconds
    this.data = null;
    this.isUpdating = false;
    this.lastSuccessfulUpdate = null;
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
        const newData = await getIndexData(0, 20);
        if (newData) {
          this.data = newData;
          this.lastSuccessfulUpdate = new Date();
          logger.info({ duration: Date.now() - startTs }, `data updated`);
          break;
        }
        throw new Error("Received null data from getIndexData");
      } catch (error) {
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

  isHealthy() {
    if (!this.lastSuccessfulUpdate) return false;

    const timeSinceLastUpdate =
      Date.now() - this.lastSuccessfulUpdate.getTime();
    // Consider unhealthy if last successful update was more than 5 minutes ago
    return timeSinceLastUpdate < 300000;
  }
}
