import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { pino } from "pino";

// Mock pino logger
vi.mock("pino", () => ({
  pino: vi.fn(() => ({
    info: vi.fn(),
    error: vi.fn(),
  })),
}));

// Mock the getIndexData function
vi.mock("../../routes/index.js", () => ({
  getIndexData: vi.fn(),
}));

import BackgroundUpdater from "../../utils/updater.js";
import { getIndexData } from "../../routes/index.js";

describe("BackgroundUpdater", () => {
  let updater: BackgroundUpdater;
  let mockGetIndexData: any;
  let mockLogger: any;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();

    mockGetIndexData = getIndexData as any;
    mockLogger = (pino as any)().info;

    // Default successful mock
    mockGetIndexData.mockResolvedValue({
      mockData: "test data",
      timestamp: Date.now(),
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("constructor", () => {
    it("should create instance with default options", () => {
      updater = new BackgroundUpdater();

      expect(updater.updateInterval).toBe(60000); // 1 minute
      expect(updater.maxRetries).toBe(3);
      expect(updater.retryDelay).toBe(5000); // 5 seconds
      expect(updater.data).toBe(null);
      expect(updater.isUpdating).toBe(false);
      expect(updater.lastSuccessfulUpdate).toBe(null);
      expect(updater.from).toBe(0);
      expect(updater.limit).toBe(20);
    });

    it("should create instance with custom options", () => {
      updater = new BackgroundUpdater({
        updateInterval: 30000,
        maxRetries: 5,
        retryDelay: 2000,
      });

      expect(updater.updateInterval).toBe(30000);
      expect(updater.maxRetries).toBe(5);
      expect(updater.retryDelay).toBe(2000);
    });

    it("should handle partial options", () => {
      updater = new BackgroundUpdater({
        updateInterval: 45000,
      });

      expect(updater.updateInterval).toBe(45000);
      expect(updater.maxRetries).toBe(3); // default
      expect(updater.retryDelay).toBe(5000); // default
    });
  });

  describe("update method", () => {
    beforeEach(() => {
      updater = new BackgroundUpdater();
    });

    it("should successfully update data", async () => {
      const mockData = { blocks: [], timestamp: Date.now() };
      mockGetIndexData.mockResolvedValue(mockData);

      await updater.update();

      expect(mockGetIndexData).toHaveBeenCalledWith(0, 20);
      expect(updater.data).toEqual(mockData);
      expect(updater.lastSuccessfulUpdate).toBeInstanceOf(Date);
      expect(updater.isUpdating).toBe(false);
    });

    it("should not update if already updating", async () => {
      updater.isUpdating = true;

      await updater.update();

      expect(mockGetIndexData).not.toHaveBeenCalled();
      expect(updater.data).toBe(null);
    });

    it("should retry on failure", async () => {
      updater = new BackgroundUpdater({ maxRetries: 2, retryDelay: 100 });
      mockGetIndexData
        .mockRejectedValueOnce(new Error("Network error"))
        .mockResolvedValueOnce({ success: true });

      const updatePromise = updater.update();
      
      // Advance timers to handle retry delay
      await vi.advanceTimersByTimeAsync(100);
      
      await updatePromise;

      expect(mockGetIndexData).toHaveBeenCalledTimes(2);
      expect(updater.data).toEqual({ success: true });
      expect(updater.lastSuccessfulUpdate).toBeInstanceOf(Date);
    }, 10000);

    it("should stop retrying after maxRetries", async () => {
      updater = new BackgroundUpdater({ maxRetries: 2, retryDelay: 100 });
      mockGetIndexData.mockRejectedValue(new Error("Persistent error"));

      const updatePromise = updater.update();
      
      // Advance timers to handle retry delay
      await vi.advanceTimersByTimeAsync(100);
      
      await updatePromise;

      expect(mockGetIndexData).toHaveBeenCalledTimes(2);
      expect(updater.data).toBe(null);
      expect(updater.lastSuccessfulUpdate).toBe(null);
    }, 10000);

    it("should handle null data from getIndexData", async () => {
      updater = new BackgroundUpdater({ maxRetries: 2, retryDelay: 100 });
      mockGetIndexData.mockResolvedValue(null);

      const updatePromise = updater.update();
      
      // Advance timers to handle retry delays
      await vi.advanceTimersByTimeAsync(200);
      
      await updatePromise;

      // Should retry maxRetries times when getting null data
      expect(mockGetIndexData).toHaveBeenCalledTimes(2);
      expect(updater.data).toBe(null);
      expect(updater.lastSuccessfulUpdate).toBe(null);
    }, 10000);

    it("should wait between retry attempts", async () => {
      updater = new BackgroundUpdater({ maxRetries: 2, retryDelay: 1000 });
      mockGetIndexData
        .mockRejectedValueOnce(new Error("First error"))
        .mockResolvedValueOnce({ success: true });

      const updatePromise = updater.update();

      // Fast-forward time to trigger retry
      await vi.advanceTimersByTimeAsync(1000);

      await updatePromise;

      expect(mockGetIndexData).toHaveBeenCalledTimes(2);
      expect(updater.data).toEqual({ success: true });
    });
  });

  describe("start method", () => {
    beforeEach(() => {
      updater = new BackgroundUpdater({ updateInterval: 1000 });
    });

    it("should perform initial update and schedule next update", async () => {
      const updateSpy = vi.spyOn(updater, "update");
      const scheduleSpy = vi.spyOn(updater, "scheduleNextUpdate");

      await updater.start();

      expect(updateSpy).toHaveBeenCalledTimes(1);
      expect(scheduleSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe("scheduleNextUpdate method", () => {
    beforeEach(() => {
      updater = new BackgroundUpdater({ updateInterval: 5000 });
    });

    it("should schedule next update after interval", async () => {
      const updateSpy = vi.spyOn(updater, "update").mockResolvedValue();

      updater.scheduleNextUpdate();

      // Fast-forward past the update interval
      await vi.advanceTimersByTimeAsync(5000);

      expect(updateSpy).toHaveBeenCalledTimes(1);
    });

    it("should continue scheduling after update completes", async () => {
      const updateSpy = vi.spyOn(updater, "update").mockResolvedValue();

      updater.scheduleNextUpdate();

      // First interval
      await vi.advanceTimersByTimeAsync(5000);
      expect(updateSpy).toHaveBeenCalledTimes(1);

      // Second interval
      await vi.advanceTimersByTimeAsync(5000);
      expect(updateSpy).toHaveBeenCalledTimes(2);
    });

    it("should schedule next update even if current update fails", async () => {
      // Create a spy that tracks calls but doesn't actually reject to avoid unhandled promises
      const updateSpy = vi.spyOn(updater, "update").mockImplementation(async () => {
        throw new Error("Update failed");
      });

      // Mock console.error to suppress expected error logs
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      updater.scheduleNextUpdate();

      // First interval
      await vi.advanceTimersByTimeAsync(5000);
      expect(updateSpy).toHaveBeenCalledTimes(1);

      // Second interval should still be scheduled
      await vi.advanceTimersByTimeAsync(5000);
      expect(updateSpy).toHaveBeenCalledTimes(2);

      consoleSpy.mockRestore();
    });
  });

  describe("getData method", () => {
    beforeEach(() => {
      updater = new BackgroundUpdater();
    });

    it("should return current data and last update time", () => {
      const mockData = { test: "data" };
      const mockDate = new Date();

      updater.data = mockData;
      updater.lastSuccessfulUpdate = mockDate;

      const result = updater.getData();

      expect(result).toEqual({
        indexData: mockData,
        lastUpdate: mockDate,
      });
    });

    it("should return null values when no data", () => {
      const result = updater.getData();

      expect(result).toEqual({
        indexData: null,
        lastUpdate: null,
      });
    });
  });

  describe("isHealthy method", () => {
    beforeEach(() => {
      updater = new BackgroundUpdater();
      updater.from = 0;
      updater.limit = 20;
    });

    it("should return false if settings don't match", () => {
      updater.lastSuccessfulUpdate = new Date();

      expect(updater.isHealthy({ from: 1, limit: 20 })).toBe(false);
      expect(updater.isHealthy({ from: 0, limit: 30 })).toBe(false);
    });

    it("should return false if no successful update", () => {
      expect(updater.isHealthy({ from: 0, limit: 20 })).toBe(false);
    });

    it("should return true if recent successful update", () => {
      // Set last update to 1 minute ago (within 5 minute threshold)
      updater.lastSuccessfulUpdate = new Date(Date.now() - 60 * 1000);

      expect(updater.isHealthy({ from: 0, limit: 20 })).toBe(true);
    });

    it("should return false if last update was too long ago", () => {
      // Set last update to 10 minutes ago (beyond 5 minute threshold)
      updater.lastSuccessfulUpdate = new Date(Date.now() - 10 * 60 * 1000);

      expect(updater.isHealthy({ from: 0, limit: 20 })).toBe(false);
    });

    it("should handle edge case at exactly 5 minutes", () => {
      // Set last update to exactly 5 minutes ago
      updater.lastSuccessfulUpdate = new Date(Date.now() - 5 * 60 * 1000);

      expect(updater.isHealthy({ from: 0, limit: 20 })).toBe(false);
    });

    it("should return true for update just under 5 minutes ago", () => {
      // Set last update to just under 5 minutes ago
      updater.lastSuccessfulUpdate = new Date(Date.now() - 299 * 1000);

      expect(updater.isHealthy({ from: 0, limit: 20 })).toBe(true);
    });
  });

  describe("toJSON method", () => {
    beforeEach(() => {
      updater = new BackgroundUpdater();
    });

    it("should return empty object", () => {
      expect(updater.toJSON()).toEqual({});
    });
  });

  describe("integration scenarios", () => {
    it("should handle complete lifecycle", async () => {
      updater = new BackgroundUpdater({
        updateInterval: 1000,
        maxRetries: 2,
        retryDelay: 500,
      });

      const mockData = { blocks: [1, 2, 3] };
      mockGetIndexData.mockResolvedValue(mockData);

      // Start the updater
      await updater.start();

      // Verify initial state
      expect(updater.data).toEqual(mockData);
      expect(updater.isHealthy({ from: 0, limit: 20 })).toBe(true);

      // Verify data retrieval
      const retrievedData = updater.getData();
      expect(retrievedData.indexData).toEqual(mockData);
      expect(retrievedData.lastUpdate).toBeInstanceOf(Date);
    });

    it("should handle failure recovery", async () => {
      updater = new BackgroundUpdater({
        updateInterval: 1000,
        maxRetries: 3,
        retryDelay: 100,
      });

      // First update fails completely
      mockGetIndexData.mockRejectedValue(new Error("Service down"));

      const firstUpdate = updater.update();
      await vi.advanceTimersByTimeAsync(300); // enough for all retries
      await firstUpdate;

      expect(updater.isHealthy({ from: 0, limit: 20 })).toBe(false);
      expect(updater.getData().indexData).toBe(null);

      // Service recovers
      const recoveryData = { recovered: true };
      mockGetIndexData.mockResolvedValue(recoveryData);

      await updater.update();

      expect(updater.isHealthy({ from: 0, limit: 20 })).toBe(true);
      expect(updater.getData().indexData).toEqual(recoveryData);
    }, 10000);
  });
});
