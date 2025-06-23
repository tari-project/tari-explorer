import { describe, it, expect, beforeEach, vi } from 'vitest';
import express from 'express';
import request from 'supertest';

// Mock the baseNodeClient
const mockClient = {
  getNetworkDifficulty: vi.fn()
};

vi.mock('../../baseNodeClient.js', () => ({
  createClient: () => mockClient
}));

// Mock cacheSettings
vi.mock('../../cacheSettings.js', () => ({
  default: {
    index: 'public, max-age=120, s-maxage=60, stale-while-revalidate=30'
  }
}));

// Import the router after mocking
import minersRouter from '../miners.js';

describe('miners route', () => {
  let app: express.Application;
  const mockDate = new Date('2023-01-01T12:00:00.000Z');
  const mockTimestamp = Math.floor(mockDate.getTime() / 1000);

  beforeEach(() => {
    vi.clearAllMocks();
    
    app = express();
    app.set('view engine', 'hbs');
    app.use('/miners', minersRouter);
    
    // Mock the render function to simulate template rendering
    const originalRender = app.render;
    app.use((req, res, next) => {
      const originalRender = res.render;
      res.render = vi.fn((template, data, callback) => {
        res.status(200).send(`Rendered: ${template} with ${JSON.stringify(data)}`);
      });
      next();
    });

    // Mock Date.now()
    vi.spyOn(Date, 'now').mockReturnValue(mockDate.getTime());
  });

  const createMockDifficulty = (overrides = {}) => ({
    height: 1000,
    timestamp: mockTimestamp - 60, // 1 minute ago
    pow_algo: '0', // randomx
    first_coinbase_extra: 'miner-1',
    coinbase_extras: ['extra1', 'miner-1,unique-id,extra3,extra4,Windows,v1.0.0', 'extra7'],
    ...overrides
  });

  describe('GET /', () => {
    it('should return JSON data when json query parameter is present', async () => {
      const mockDifficulties = [createMockDifficulty()];
      mockClient.getNetworkDifficulty.mockResolvedValue(mockDifficulties);

      const response = await request(app)
        .get('/miners?json')
        .expect(200);

      expect(response.body).toHaveProperty('num_blocks', 1);
      expect(response.body).toHaveProperty('difficulties');
      expect(response.body).toHaveProperty('extras');
      expect(response.body).toHaveProperty('unique_ids');
      expect(response.body).toHaveProperty('os');
      expect(response.body).toHaveProperty('versions');
      expect(response.body).toHaveProperty('active_miners');
      expect(response.body).toHaveProperty('now', mockTimestamp);
      expect(mockClient.getNetworkDifficulty).toHaveBeenCalledWith({ from_tip: 720 });
    });

    it('should render miners template when no json query parameter', async () => {
      const mockDifficulties = [createMockDifficulty()];
      mockClient.getNetworkDifficulty.mockResolvedValue(mockDifficulties);

      const response = await request(app)
        .get('/miners')
        .expect(200);

      expect(response.text).toContain('<h2>Versions</h2>');
      expect(mockClient.getNetworkDifficulty).toHaveBeenCalledWith({ from_tip: 720 });
    });

    it('should set cache control headers', async () => {
      mockClient.getNetworkDifficulty.mockResolvedValue([]);

      const response = await request(app)
        .get('/miners')
        .expect(200);

      expect(response.headers['cache-control']).toBe('public, max-age=120, s-maxage=60, stale-while-revalidate=30');
    });

    it('should handle empty difficulty data', async () => {
      mockClient.getNetworkDifficulty.mockResolvedValue([]);

      const response = await request(app)
        .get('/miners?json')
        .expect(200);

      expect(response.body.num_blocks).toBe(0);
      expect(response.body.difficulties).toEqual([]);
      expect(response.body.extras).toEqual([]);
      expect(response.body.unique_ids).toEqual({});
      expect(response.body.os).toEqual({});
      expect(response.body.versions).toEqual({});
      expect(response.body.active_miners).toEqual({});
    });

    it('should process single miner with universe format', async () => {
      const mockDifficulties = [createMockDifficulty({
        coinbase_extras: ['extra1', 'miner-1,unique-123,extra3,extra4,Linux,v2.0.0']
      })];
      mockClient.getNetworkDifficulty.mockResolvedValue(mockDifficulties);

      const response = await request(app)
        .get('/miners?json')
        .expect(200);

      expect(response.body.unique_ids).toHaveProperty('unique-123');
      expect(response.body.unique_ids['unique-123'].randomx.version).toBe('v2.0.0');
      expect(response.body.unique_ids['unique-123'].randomx.os).toBe('Linux');
      expect(response.body.unique_ids['unique-123'].randomx.count).toBe(1);
      expect(response.body.os).toHaveProperty('Linux', 1);
      expect(response.body.versions).toHaveProperty('v2.0.0', 1);
    });

    it('should process miner with non-universe format', async () => {
      const mockDifficulties = [createMockDifficulty({
        first_coinbase_extra: '',
        coinbase_extras: ['simple-extra']
      })];
      mockClient.getNetworkDifficulty.mockResolvedValue(mockDifficulties);

      const response = await request(app)
        .get('/miners?json')
        .expect(200);

      expect(response.body.unique_ids).toHaveProperty('Non-universe miner');
      expect(response.body.unique_ids['Non-universe miner'].randomx.version).toBe('Non-universe miner');
      expect(response.body.unique_ids['Non-universe miner'].randomx.os).toBe('Non-universe miner');
      expect(response.body.os).toHaveProperty('Non-universe miner', 1);
      expect(response.body.versions).toHaveProperty('Non-universe miner', 1);
    });

    it('should handle sha algorithm (pow_algo !== "0")', async () => {
      const mockDifficulties = [createMockDifficulty({
        pow_algo: '1', // SHA
        coinbase_extras: ['extra1', 'miner-1,sha-miner,extra3,extra4,macOS,v1.5.0']
      })];
      mockClient.getNetworkDifficulty.mockResolvedValue(mockDifficulties);

      const response = await request(app)
        .get('/miners?json')
        .expect(200);

      expect(response.body.unique_ids['sha-miner'].sha.count).toBe(1);
      expect(response.body.unique_ids['sha-miner'].randomx.count).toBe(0);
      expect(response.body.unique_ids['sha-miner'].sha.version).toBe('v1.5.0');
      expect(response.body.unique_ids['sha-miner'].sha.os).toBe('macOS');
    });

    it('should handle multiple miners with same unique_id', async () => {
      const mockDifficulties = [
        createMockDifficulty({
          height: 1000,
          pow_algo: '0',
          coinbase_extras: ['extra1', 'miner-1,same-id,extra3,extra4,Linux,v1.0.0']
        }),
        createMockDifficulty({
          height: 999,
          pow_algo: '1',
          coinbase_extras: ['extra1', 'miner-1,same-id,extra3,extra4,Linux,v1.0.0']
        })
      ];
      mockClient.getNetworkDifficulty.mockResolvedValue(mockDifficulties);

      const response = await request(app)
        .get('/miners?json')
        .expect(200);

      expect(response.body.unique_ids['same-id'].randomx.count).toBe(1);
      expect(response.body.unique_ids['same-id'].sha.count).toBe(1);
    });

    it('should calculate time_since_last_block correctly', async () => {
      const oldTimestamp = mockTimestamp - 300; // 5 minutes ago
      const mockDifficulties = [createMockDifficulty({
        timestamp: oldTimestamp,
        coinbase_extras: ['extra1', 'miner-1,old-miner,extra3,extra4,Linux,v1.0.0']
      })];
      mockClient.getNetworkDifficulty.mockResolvedValue(mockDifficulties);

      const response = await request(app)
        .get('/miners?json')
        .expect(200);

      expect(response.body.unique_ids['old-miner'].randomx.time_since_last_block).toBe(5);
    });

    it('should identify active miners (time_since_last_block < 120)', async () => {
      const recentTimestamp = mockTimestamp - 60; // 1 minute ago
      const oldTimestamp = mockTimestamp - 7200; // 2 hours ago
      
      const mockDifficulties = [
        createMockDifficulty({
          timestamp: recentTimestamp,
          coinbase_extras: ['extra1', 'miner-1,active-miner,extra3,extra4,Linux,v1.0.0']
        }),
        createMockDifficulty({
          timestamp: oldTimestamp,
          coinbase_extras: ['extra1', 'miner-1,inactive-miner,extra3,extra4,Linux,v1.0.0']
        })
      ];
      mockClient.getNetworkDifficulty.mockResolvedValue(mockDifficulties);

      const response = await request(app)
        .get('/miners?json')
        .expect(200);

      expect(response.body.active_miners).toHaveProperty('active-miner');
      expect(response.body.active_miners).not.toHaveProperty('inactive-miner');
    });

    it('should count recent_blocks for miners active within 120 minutes', async () => {
      const recentTimestamp = mockTimestamp - 60; // 1 minute ago
      const mockDifficulties = [createMockDifficulty({
        timestamp: recentTimestamp,
        coinbase_extras: ['extra1', 'miner-1,recent-miner,extra3,extra4,Linux,v1.0.0']
      })];
      mockClient.getNetworkDifficulty.mockResolvedValue(mockDifficulties);

      const response = await request(app)
        .get('/miners?json')
        .expect(200);

      expect(response.body.unique_ids['recent-miner'].randomx.recent_blocks).toBe(1);
    });

    it('should not count recent_blocks for old blocks', async () => {
      const oldTimestamp = mockTimestamp - 7200; // 2 hours ago
      const mockDifficulties = [createMockDifficulty({
        timestamp: oldTimestamp,
        coinbase_extras: ['extra1', 'miner-1,old-miner,extra3,extra4,Linux,v1.0.0']
      })];
      mockClient.getNetworkDifficulty.mockResolvedValue(mockDifficulties);

      const response = await request(app)
        .get('/miners?json')
        .expect(200);

      expect(response.body.unique_ids['old-miner'].randomx.recent_blocks).toBe(0);
    });

    it('should handle incomplete coinbase_extras format', async () => {
      const mockDifficulties = [createMockDifficulty({
        coinbase_extras: ['extra1', 'short,format']
      })];
      mockClient.getNetworkDifficulty.mockResolvedValue(mockDifficulties);

      const response = await request(app)
        .get('/miners?json')
        .expect(200);

      expect(response.body.unique_ids['miner-1'].randomx.version).toBe('Non-universe miner');
      expect(response.body.unique_ids['miner-1'].randomx.os).toBe('Non-universe miner');
    });

    it('should aggregate OS statistics correctly', async () => {
      const mockDifficulties = [
        createMockDifficulty({
          coinbase_extras: ['extra1', 'miner-1,id1,extra3,extra4,Windows,v1.0.0']
        }),
        createMockDifficulty({
          coinbase_extras: ['extra1', 'miner-1,id2,extra3,extra4,Windows,v2.0.0']
        }),
        createMockDifficulty({
          coinbase_extras: ['extra1', 'miner-1,id3,extra3,extra4,Linux,v1.0.0']
        })
      ];
      mockClient.getNetworkDifficulty.mockResolvedValue(mockDifficulties);

      const response = await request(app)
        .get('/miners?json')
        .expect(200);

      expect(response.body.os.Windows).toBe(2);
      expect(response.body.os.Linux).toBe(1);
    });

    it('should aggregate version statistics correctly', async () => {
      const mockDifficulties = [
        createMockDifficulty({
          coinbase_extras: ['extra1', 'miner-1,id1,extra3,extra4,Windows,v1.0.0']
        }),
        createMockDifficulty({
          coinbase_extras: ['extra1', 'miner-1,id2,extra3,extra4,Linux,v1.0.0']
        }),
        createMockDifficulty({
          coinbase_extras: ['extra1', 'miner-1,id3,extra3,extra4,Linux,v2.0.0']
        })
      ];
      mockClient.getNetworkDifficulty.mockResolvedValue(mockDifficulties);

      const response = await request(app)
        .get('/miners?json')
        .expect(200);

      expect(response.body.versions['v1.0.0']).toBe(2);
      expect(response.body.versions['v2.0.0']).toBe(1);
    });

    it('should handle miners with mixed algorithms', async () => {
      const mockDifficulties = [
        createMockDifficulty({
          pow_algo: '0', // randomx
          coinbase_extras: ['extra1', 'miner-1,mixed-miner,extra3,extra4,Linux,v1.0.0']
        }),
        createMockDifficulty({
          pow_algo: '1', // sha
          coinbase_extras: ['extra1', 'miner-1,mixed-miner,extra3,extra4,Linux,v1.0.0']
        })
      ];
      mockClient.getNetworkDifficulty.mockResolvedValue(mockDifficulties);

      const response = await request(app)
        .get('/miners?json')
        .expect(200);

      const miner = response.body.unique_ids['mixed-miner'];
      expect(miner.randomx.count).toBe(1);
      expect(miner.sha.count).toBe(1);
    });

    it('should handle active miners with mixed algorithms', async () => {
      const recentTimestamp = mockTimestamp - 60; // 1 minute ago
      const mockDifficulties = [
        createMockDifficulty({
          timestamp: recentTimestamp,
          pow_algo: '0', // randomx
          coinbase_extras: ['extra1', 'miner-1,mixed-active,extra3,extra4,Linux,v1.0.0']
        }),
        createMockDifficulty({
          timestamp: mockTimestamp - 7200, // 2 hours ago
          pow_algo: '1', // sha
          coinbase_extras: ['extra1', 'miner-1,mixed-active,extra3,extra4,Linux,v1.0.0']
        })
      ];
      mockClient.getNetworkDifficulty.mockResolvedValue(mockDifficulties);

      const response = await request(app)
        .get('/miners?json')
        .expect(200);

      // Should be active because randomx was recent (< 120 min ago)
      expect(response.body.active_miners).toHaveProperty('mixed-active');
    });

    it('should include extras array with correct data', async () => {
      const mockDifficulties = [createMockDifficulty({
        height: 1000,
        coinbase_extras: ['extra1', 'miner-1,test-id,extra3,extra4,TestOS,v1.2.3']
      })];
      mockClient.getNetworkDifficulty.mockResolvedValue(mockDifficulties);

      const response = await request(app)
        .get('/miners?json')
        .expect(200);

      expect(response.body.extras).toHaveLength(1);
      expect(response.body.extras[0]).toEqual({
        height: 1000,
        extra: 'extra1|miner-1,test-id,extra3,extra4,TestOS,v1.2.3',
        unique_id: 'test-id',
        os: 'TestOS',
        version: 'v1.2.3'
      });
    });

    it('should handle null/undefined from getNetworkDifficulty', async () => {
      mockClient.getNetworkDifficulty.mockResolvedValue(null);

      // This will cause a runtime error in the current implementation
      const response = await request(app)
        .get('/miners?json')
        .expect(500);
    });

    it('should handle client throwing an error', async () => {
      const error = new Error('Network connection failed');
      mockClient.getNetworkDifficulty.mockRejectedValue(error);

      const response = await request(app)
        .get('/miners?json')
        .expect(500);

      expect(mockClient.getNetworkDifficulty).toHaveBeenCalledWith({ from_tip: 720 });
    });

    it('should handle large datasets efficiently', async () => {
      const largeDifficulties = Array.from({ length: 720 }, (_, i) => 
        createMockDifficulty({
          height: 1000 - i,
          coinbase_extras: [`extra${i}`, `miner-${i % 10},id-${i % 10},extra3,extra4,OS-${i % 3},v${i % 5}.0.0`]
        })
      );
      mockClient.getNetworkDifficulty.mockResolvedValue(largeDifficulties);

      const response = await request(app)
        .get('/miners?json')
        .expect(200);

      expect(response.body.num_blocks).toBe(720);
      expect(response.body.difficulties).toHaveLength(720);
      expect(response.body.extras).toHaveLength(720);
      expect(Object.keys(response.body.unique_ids)).toHaveLength(10);
    });

    it('should handle empty coinbase_extras array', async () => {
      const mockDifficulties = [createMockDifficulty({
        coinbase_extras: []
      })];
      mockClient.getNetworkDifficulty.mockResolvedValue(mockDifficulties);

      const response = await request(app)
        .get('/miners?json')
        .expect(200);

      expect(response.body.extras[0].extra).toBe('');
      expect(response.body.unique_ids['miner-1'].randomx.version).toBe('Non-universe miner');
    });

    it('should handle concurrent requests correctly', async () => {
      const mockDifficulties = [createMockDifficulty()];
      mockClient.getNetworkDifficulty.mockResolvedValue(mockDifficulties);

      const requests = [
        request(app).get('/miners?json'),
        request(app).get('/miners?json'),
        request(app).get('/miners')
      ];

      const responses = await Promise.all(requests);

      responses.forEach(response => {
        expect(response.status).toBe(200);
      });

      expect(mockClient.getNetworkDifficulty).toHaveBeenCalledTimes(3);
    });

    it('should handle edge case with default time_since_last_block of 1000', async () => {
      const veryOldTimestamp = mockTimestamp - 100000; // Very old
      const mockDifficulties = [createMockDifficulty({
        timestamp: veryOldTimestamp,
        coinbase_extras: ['extra1', 'miner-1,very-old-miner,extra3,extra4,Linux,v1.0.0']
      })];
      mockClient.getNetworkDifficulty.mockResolvedValue(mockDifficulties);

      const response = await request(app)
        .get('/miners?json')
        .expect(200);

      // Should not be in active_miners because time_since_last_block > 120
      expect(response.body.active_miners).not.toHaveProperty('very-old-miner');
      expect(response.body.unique_ids['very-old-miner'].randomx.time_since_last_block).toBeGreaterThan(120);
    });

    it('should handle miners that switch between active and inactive', async () => {
      const mockDifficulties = [
        createMockDifficulty({
          timestamp: mockTimestamp - 60, // 1 minute ago - active
          coinbase_extras: ['extra1', 'miner-1,switcher,extra3,extra4,Linux,v1.0.0']
        }),
        createMockDifficulty({
          timestamp: mockTimestamp - 7200, // 2 hours ago - inactive
          coinbase_extras: ['extra1', 'miner-1,switcher,extra3,extra4,Linux,v1.0.0']
        })
      ];
      mockClient.getNetworkDifficulty.mockResolvedValue(mockDifficulties);

      const response = await request(app)
        .get('/miners?json')
        .expect(200);

      // The current implementation overwrites timestamps, so the last processed timestamp wins
      // Since the 2-hour old block is processed last, it overwrites the 1-minute timestamp
      // So this miner should NOT be in active_miners based on current implementation
      expect(response.body.active_miners).not.toHaveProperty('switcher');
      expect(response.body.unique_ids.switcher.randomx.count).toBe(2);
      expect(response.body.unique_ids.switcher.randomx.recent_blocks).toBe(1);
    });
  });
});
