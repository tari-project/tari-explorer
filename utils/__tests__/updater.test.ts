import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import BackgroundUpdater from '../updater.js';
import * as indexRoute from '../../routes/index.js';

// Mock the index route
vi.mock('../../routes/index.js', () => ({
  getIndexData: vi.fn()
}));

// Mock pino logger to avoid console output during tests
vi.mock('pino', () => ({
  pino: vi.fn(() => ({
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn()
  }))
}));

describe('BackgroundUpdater', () => {
  let updater: BackgroundUpdater;
  const mockGetIndexData = vi.mocked(indexRoute.getIndexData);

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('constructor', () => {
    it('should use default options when none provided', () => {
      updater = new BackgroundUpdater();
      
      expect(updater.updateInterval).toBe(60000);
      expect(updater.maxRetries).toBe(3);
      expect(updater.retryDelay).toBe(5000);
      expect(updater.data).toBe(null);
      expect(updater.isUpdating).toBe(false);
      expect(updater.lastSuccessfulUpdate).toBe(null);
      expect(updater.from).toBe(0);
      expect(updater.limit).toBe(20);
    });

    it('should use custom options when provided', () => {
      const options = {
        updateInterval: 30000,
        maxRetries: 5,
        retryDelay: 3000
      };
      
      updater = new BackgroundUpdater(options);
      
      expect(updater.updateInterval).toBe(30000);
      expect(updater.maxRetries).toBe(5);
      expect(updater.retryDelay).toBe(3000);
    });
  });

  describe('update', () => {
    beforeEach(() => {
      updater = new BackgroundUpdater({ maxRetries: 2, retryDelay: 1000 });
    });

    it('should successfully update data on first attempt', async () => {
      const mockData = { blocks: [], stats: {} };
      mockGetIndexData.mockResolvedValue(mockData);

      await updater.update();

      expect(mockGetIndexData).toHaveBeenCalledWith(0, 20);
      expect(updater.data).toBe(mockData);
      expect(updater.lastSuccessfulUpdate).toBeInstanceOf(Date);
      expect(updater.isUpdating).toBe(false);
    });

    it('should retry on failure and eventually succeed', async () => {
      const mockData = { blocks: [], stats: {} };
      mockGetIndexData
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce(mockData);

      const updatePromise = updater.update();
      
      // Advance timer for retry delay
      await vi.advanceTimersToNextTimerAsync();
      
      await updatePromise;

      expect(mockGetIndexData).toHaveBeenCalledTimes(2);
      expect(updater.data).toBe(mockData);
      expect(updater.lastSuccessfulUpdate).toBeInstanceOf(Date);
    });

    it('should fail after max retries exceeded', async () => {
      mockGetIndexData.mockRejectedValue(new Error('Persistent error'));

      const updatePromise = updater.update();
      
      // Advance timer for retry delay
      await vi.advanceTimersToNextTimerAsync();
      
      await updatePromise;

      expect(mockGetIndexData).toHaveBeenCalledTimes(2); // maxRetries = 2
      expect(updater.data).toBe(null);
      expect(updater.lastSuccessfulUpdate).toBe(null);
      expect(updater.isUpdating).toBe(false);
    });

    it('should handle null data from getIndexData', async () => {
      mockGetIndexData.mockResolvedValue(null);

      const updatePromise = updater.update();
      
      // Advance timer for retry delay
      await vi.advanceTimersToNextTimerAsync();
      
      await updatePromise;

      expect(mockGetIndexData).toHaveBeenCalledTimes(2); // Should retry
      expect(updater.data).toBe(null);
      expect(updater.lastSuccessfulUpdate).toBe(null);
    });

    it('should not start new update if already updating', async () => {
      let resolvePromise: (value: any) => void;
      mockGetIndexData.mockImplementation(() => 
        new Promise(resolve => {
          resolvePromise = resolve;
        })
      );

      // Start first update but don't await
      const firstUpdate = updater.update();
      
      // Verify update is in progress
      expect(updater.isUpdating).toBe(true);
      
      // Try to start second update
      await updater.update();

      // Should still only have one call since second update was skipped
      expect(mockGetIndexData).toHaveBeenCalledTimes(1);
      
      // Complete first update
      resolvePromise({ data: 'test' });
      await firstUpdate;
      expect(updater.isUpdating).toBe(false);
    });

    it('should wait between retries', async () => {
      mockGetIndexData.mockRejectedValue(new Error('Test error'));
      const startTime = Date.now();
      
      const updatePromise = updater.update();
      
      // Advance timers to simulate retry delay
      await vi.advanceTimersToNextTimerAsync();
      
      await updatePromise;
      
      expect(mockGetIndexData).toHaveBeenCalledTimes(2);
    });
  });

  describe('start', () => {
    beforeEach(() => {
      updater = new BackgroundUpdater({ updateInterval: 10000 });
    });

    it('should perform initial update and schedule next', async () => {
      const mockData = { blocks: [] };
      mockGetIndexData.mockResolvedValue(mockData);

      await updater.start();

      expect(mockGetIndexData).toHaveBeenCalledWith(0, 20);
      expect(updater.data).toBe(mockData);
      
      // Check that setTimeout was called for scheduling
      expect(vi.getTimerCount()).toBe(1);
    });
  });

  describe('scheduleNextUpdate', () => {
    beforeEach(() => {
      updater = new BackgroundUpdater({ updateInterval: 5000 });
    });

    it('should schedule update after specified interval', async () => {
      const mockData = { blocks: [] };
      mockGetIndexData.mockResolvedValue(mockData);

      updater.scheduleNextUpdate();

      // Advance time by the update interval
      await vi.advanceTimersToNextTimerAsync();

      expect(mockGetIndexData).toHaveBeenCalledWith(0, 20);
    });

    it('should continue scheduling after update completes', async () => {
      const mockData = { blocks: [] };
      mockGetIndexData.mockResolvedValue(mockData);

      updater.scheduleNextUpdate();

      // First scheduled update
      await vi.advanceTimersToNextTimerAsync();
      expect(mockGetIndexData).toHaveBeenCalledTimes(1);

      // Second scheduled update
      await vi.advanceTimersToNextTimerAsync();
      expect(mockGetIndexData).toHaveBeenCalledTimes(2);
    });
  });

  describe('getData', () => {
    beforeEach(() => {
      updater = new BackgroundUpdater();
    });

    it('should return data and last update time', () => {
      const mockData = { blocks: [] };
      const mockDate = new Date('2024-01-01');
      
      updater.data = mockData;
      updater.lastSuccessfulUpdate = mockDate;

      const result = updater.getData();

      expect(result).toEqual({
        indexData: mockData,
        lastUpdate: mockDate
      });
    });

    it('should return null values when no data', () => {
      const result = updater.getData();

      expect(result).toEqual({
        indexData: null,
        lastUpdate: null
      });
    });
  });

  describe('isHealthy', () => {
    beforeEach(() => {
      updater = new BackgroundUpdater();
    });

    it('should return false if settings do not match', () => {
      updater.lastSuccessfulUpdate = new Date();
      
      const result = updater.isHealthy({ from: 10, limit: 30 });
      
      expect(result).toBe(false);
    });

    it('should return false if no successful update', () => {
      const result = updater.isHealthy({ from: 0, limit: 20 });
      
      expect(result).toBe(false);
    });

    it('should return true if recent successful update with matching settings', () => {
      const recentTime = new Date(Date.now() - 60000); // 1 minute ago
      updater.lastSuccessfulUpdate = recentTime;
      
      const result = updater.isHealthy({ from: 0, limit: 20 });
      
      expect(result).toBe(true);
    });

    it('should return false if last update was too long ago', () => {
      const oldTime = new Date(Date.now() - 400000); // 6+ minutes ago
      updater.lastSuccessfulUpdate = oldTime;
      
      const result = updater.isHealthy({ from: 0, limit: 20 });
      
      expect(result).toBe(false);
    });

    it('should return false if from parameter does not match', () => {
      const recentTime = new Date(Date.now() - 60000);
      updater.lastSuccessfulUpdate = recentTime;
      
      const result = updater.isHealthy({ from: 5, limit: 20 });
      
      expect(result).toBe(false);
    });

    it('should return false if limit parameter does not match', () => {
      const recentTime = new Date(Date.now() - 60000);
      updater.lastSuccessfulUpdate = recentTime;
      
      const result = updater.isHealthy({ from: 0, limit: 15 });
      
      expect(result).toBe(false);
    });
  });

  describe('toJSON', () => {
    it('should return empty object', () => {
      updater = new BackgroundUpdater();
      
      const result = updater.toJSON();
      
      expect(result).toEqual({});
    });
  });
});
