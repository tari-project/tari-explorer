import { describe, it, expect, beforeEach, vi } from 'vitest';
import express from 'express';
import request from 'supertest';

// Mock the baseNodeClient
vi.mock('../../baseNodeClient.js', () => ({
  createClient: () => ({
    getBlocks: vi.fn(),
    getTipInfo: vi.fn(),
    getHeaderByHash: vi.fn()
  })
}));

// Mock cache
vi.mock('../../cache.js', () => ({
  default: {
    get: vi.fn()
  }
}));

vi.mock('../../cacheSettings.js', () => ({
  default: {
    oldBlocks: 'public, max-age=604800',
    newBlocks: 'public, max-age=120',
    oldBlockDeltaTip: 5040
  }
}));

// Import the router after mocking
import blockDataRouter from '../block_data.js';
import { createClient } from '../../baseNodeClient.js';
import cache from '../../cache.js';

describe('block_data route', () => {
  let app: express.Application;
  let mockClient: any;
  let mockCache: any;

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Get mock instances
    mockClient = createClient();
    mockCache = cache;
    
    // Set up common mocks
    mockClient.getTipInfo.mockResolvedValue({
      metadata: { best_block_height: '1000' }
    });
    
    app = express();
    app.use(express.json());
    
    // Mock render function
    app.use((req, res, next) => {
      res.render = vi.fn((template, data) => {
        res.status(404).json({ template, data });
      });
      next();
    });
    
    app.use('/block_data', blockDataRouter);
  });

  describe('GET /:height', () => {
    const mockBlock = {
      block: {
        header: { height: '100' },
        body: {
          outputs: [
            {
              commitment: 'abc123',
              features: { output_type: 'standard' },
              range_proof: 'proof1'
            },
            {
              commitment: 'def456', 
              features: { output_type: 'coinbase' },
              range_proof: 'proof2'
            }
          ],
          inputs: [
            {
              output_hash: 'input1',
              public_nonce_commitment: 'nonce1'
            }
          ],
          kernels: [
            {
              features: 'plain',
              fee: '1000',
              lock_height: '0'
            }
          ]
        }
      }
    };

    it('should return outputs component as JSON', async () => {
      mockCache.get.mockResolvedValue([mockBlock]);

      const response = await request(app)
        .get('/block_data/100?what=outputs')
        .expect(200);

      expect(response.body.body.data).toEqual(mockBlock.block.body.outputs);
      expect(response.body.height).toBe(100);
    });

    it('should return inputs component as JSON', async () => {
      mockCache.get.mockResolvedValue([mockBlock]);

      const response = await request(app)
        .get('/block_data/100?what=inputs')
        .expect(200);

      expect(response.body.body.data).toEqual(mockBlock.block.body.inputs);
    });

    it('should return kernels component as JSON', async () => {
      mockCache.get.mockResolvedValue([mockBlock]);

      const response = await request(app)
        .get('/block_data/100?what=kernels')
        .expect(200);

      expect(response.body.body.data).toEqual(mockBlock.block.body.kernels);
    });

    it('should return 404 when what parameter is missing', async () => {
      await request(app)
        .get('/block_data/100')
        .expect(404);
    });

    it('should return 404 when block not found', async () => {
      mockCache.get.mockResolvedValue([]);

      await request(app)
        .get('/block_data/100?what=outputs')
        .expect(404);
    });

    it('should handle pagination with from/to parameters', async () => {
      mockCache.get.mockResolvedValue([mockBlock]);

      const response = await request(app)
        .get('/block_data/100?what=outputs&from=0&to=1')
        .expect(200);

      expect(response.body.body.data).toEqual([mockBlock.block.body.outputs[0]]);
      expect(response.body.body.length).toBe(2);
    });

    it('should handle hex hash input', async () => {
      const hexHash = 'a1b2c3d4e5f6789012345678901234567890123456789012345678901234567890';
      const mockHeader = { header: { height: '100' } };
      
      mockClient.getHeaderByHash.mockResolvedValue(mockHeader);
      mockCache.get.mockResolvedValue([mockBlock]);

      const response = await request(app)
        .get(`/block_data/${hexHash}?what=outputs`)
        .expect(200);

      expect(response.body.height).toBe(100);
    });

    it('should return 404 for invalid hex hash', async () => {
      const hexHash = 'a1b2c3d4e5f6789012345678901234567890123456789012345678901234567890';
      
      mockClient.getHeaderByHash.mockResolvedValue(null);

      await request(app)
        .get(`/block_data/${hexHash}?what=outputs`)
        .expect(404);
    });

    it('should set cache headers for old blocks', async () => {
      mockCache.get.mockResolvedValue([mockBlock]);
      mockClient.getTipInfo.mockResolvedValue({
        metadata: { best_block_height: '10000' }
      });

      const response = await request(app)
        .get('/block_data/100?what=outputs')
        .expect(200);

      expect(response.headers['cache-control']).toBe('public, max-age=604800');
    });

    it('should set cache headers for new blocks', async () => {
      mockCache.get.mockResolvedValue([mockBlock]);
      mockClient.getTipInfo.mockResolvedValue({
        metadata: { best_block_height: '105' }
      });

      const response = await request(app)
        .get('/block_data/100?what=outputs')
        .expect(200);

      expect(response.headers['cache-control']).toBe('public, max-age=120');
    });
  });
});
