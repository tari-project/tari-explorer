import { describe, it, expect, beforeEach, vi } from 'vitest';
import express from 'express';
import request from 'supertest';

// Mock the baseNodeClient
const mockClient = {
  searchKernels: vi.fn()
};

vi.mock('../../baseNodeClient.js', () => ({
  createClient: () => mockClient
}));

// Mock cacheSettings
vi.mock('../../cacheSettings.js', () => ({
  default: {
    newBlocks: 'public, max-age=120, s-maxage=60, stale-while-revalidate=30'
  }
}));

// Import the router after mocking
import searchKernelsRouter from '../search_kernels.js';

describe('search_kernels route', () => {
  let app: express.Application;

  beforeEach(() => {
    vi.clearAllMocks();
    
    app = express();
    app.set('view engine', 'hbs');
    app.use('/search_kernels', searchKernelsRouter);
    
    // Mock the render function
    app.use((req, res, next) => {
      res.render = vi.fn((template, data) => {
        res.status(200).send(`Rendered: ${template} with ${JSON.stringify(data)}`);
      });
      next();
    });
  });

  describe('GET /', () => {
    it('should search kernels successfully and return JSON', async () => {
      const mockResult = [{ kernel: 'kernel1', signature: 'sig1' }];
      mockClient.searchKernels.mockResolvedValue(mockResult);

      const nonce = 'abcd1234567890123456789012345678901234567890123456789012345678901234';
      const signature = 'efgh5678901234567890123456789012345678901234567890123456789012345678';

      const response = await request(app)
        .get(`/search_kernels?nonces=${nonce}&signatures=${signature}&json`)
        .expect(200);

      expect(response.body).toEqual({ items: mockResult });
      expect(mockClient.searchKernels).toHaveBeenCalledWith({
        signatures: [{
          public_nonce: Buffer.from(nonce, 'hex'),
          signature: Buffer.from(signature, 'hex')
        }]
      });
    });

    it('should search kernels successfully and render template', async () => {
      const mockResult = [{ kernel: 'kernel1', signature: 'sig1' }];
      mockClient.searchKernels.mockResolvedValue(mockResult);

      const nonce = 'abcd1234567890123456789012345678901234567890123456789012345678901234';
      const signature = 'efgh5678901234567890123456789012345678901234567890123456789012345678';

      const response = await request(app)
        .get(`/search_kernels?nonces=${nonce}&signatures=${signature}`)
        .expect(200);

      expect(response.text).toContain('Rendered: search');
      expect(mockClient.searchKernels).toHaveBeenCalledTimes(1);
    });

    it('should handle multiple nonces and signatures', async () => {
      const mockResult = [{ kernel: 'kernel1' }, { kernel: 'kernel2' }];
      mockClient.searchKernels.mockResolvedValue(mockResult);

      const nonce1 = 'abcd1234567890123456789012345678901234567890123456789012345678901234';
      const nonce2 = 'bcde2345678901234567890123456789012345678901234567890123456789012345';
      const sig1 = 'efgh5678901234567890123456789012345678901234567890123456789012345678';
      const sig2 = 'fghi6789012345678901234567890123456789012345678901234567890123456789';

      await request(app)
        .get(`/search_kernels?nonces=${nonce1},${nonce2}&signatures=${sig1},${sig2}&json`)
        .expect(200);

      expect(mockClient.searchKernels).toHaveBeenCalledWith({
        signatures: [
          {
            public_nonce: Buffer.from(nonce1, 'hex'),
            signature: Buffer.from(sig1, 'hex')
          },
          {
            public_nonce: Buffer.from(nonce2, 'hex'),
            signature: Buffer.from(sig2, 'hex')
          }
        ]
      });
    });

    it('should filter out invalid hex formats', async () => {
      const mockResult = [{ kernel: 'kernel1' }];
      mockClient.searchKernels.mockResolvedValue(mockResult);

      const validNonce = 'abcd1234567890123456789012345678901234567890123456789012345678901234';
      const validSig = 'efgh5678901234567890123456789012345678901234567890123456789012345678';

      await request(app)
        .get(`/search_kernels?nonces=${validNonce},invalid,short&signatures=${validSig},invalid,short&json`)
        .expect(200);

      expect(mockClient.searchKernels).toHaveBeenCalledWith({
        signatures: [{
          public_nonce: Buffer.from(validNonce, 'hex'),
          signature: Buffer.from(validSig, 'hex')
        }]
      });
    });

    it('should trim whitespace from nonces and signatures', async () => {
      const mockResult = [{ kernel: 'kernel1' }];
      mockClient.searchKernels.mockResolvedValue(mockResult);

      const nonce = 'abcd1234567890123456789012345678901234567890123456789012345678901234';
      const signature = 'efgh5678901234567890123456789012345678901234567890123456789012345678';

      await request(app)
        .get(`/search_kernels?nonces= ${nonce} &signatures= ${signature} &json`)
        .expect(200);

      expect(mockClient.searchKernels).toHaveBeenCalledWith({
        signatures: [{
          public_nonce: Buffer.from(nonce, 'hex'),
          signature: Buffer.from(signature, 'hex')
        }]
      });
    });

    it('should return 404 for empty nonces parameter', async () => {
      const signature = 'efgh5678901234567890123456789012345678901234567890123456789012345678';

      await request(app)
        .get(`/search_kernels?nonces=&signatures=${signature}`)
        .expect(404);

      expect(mockClient.searchKernels).not.toHaveBeenCalled();
    });

    it('should return 404 for empty signatures parameter', async () => {
      const nonce = 'abcd1234567890123456789012345678901234567890123456789012345678901234';

      await request(app)
        .get(`/search_kernels?nonces=${nonce}&signatures=`)
        .expect(404);

      expect(mockClient.searchKernels).not.toHaveBeenCalled();
    });

    it('should return 404 for missing nonces parameter', async () => {
      const signature = 'efgh5678901234567890123456789012345678901234567890123456789012345678';

      await request(app)
        .get(`/search_kernels?signatures=${signature}`)
        .expect(404);

      expect(mockClient.searchKernels).not.toHaveBeenCalled();
    });

    it('should return 404 for missing signatures parameter', async () => {
      const nonce = 'abcd1234567890123456789012345678901234567890123456789012345678901234';

      await request(app)
        .get(`/search_kernels?nonces=${nonce}`)
        .expect(404);

      expect(mockClient.searchKernels).not.toHaveBeenCalled();
    });

    it('should return 404 when nonces and signatures have different lengths', async () => {
      const nonce1 = 'abcd1234567890123456789012345678901234567890123456789012345678901234';
      const nonce2 = 'bcde2345678901234567890123456789012345678901234567890123456789012345';
      const sig1 = 'efgh5678901234567890123456789012345678901234567890123456789012345678';

      await request(app)
        .get(`/search_kernels?nonces=${nonce1},${nonce2}&signatures=${sig1}`)
        .expect(404);

      expect(mockClient.searchKernels).not.toHaveBeenCalled();
    });

    it('should return 404 for only invalid hex formats', async () => {
      await request(app)
        .get('/search_kernels?nonces=invalid,short&signatures=invalid,short')
        .expect(404);

      expect(mockClient.searchKernels).not.toHaveBeenCalled();
    });

    it('should handle client error and return JSON error', async () => {
      const error = new Error('gRPC connection failed');
      mockClient.searchKernels.mockRejectedValue(error);

      const nonce = 'abcd1234567890123456789012345678901234567890123456789012345678901234';
      const signature = 'efgh5678901234567890123456789012345678901234567890123456789012345678';

      const response = await request(app)
        .get(`/search_kernels?nonces=${nonce}&signatures=${signature}&json`)
        .expect(404);

      expect(response.body).toEqual({ error: error });
    });

    it('should handle client error and render error template', async () => {
      const error = new Error('gRPC connection failed');
      mockClient.searchKernels.mockRejectedValue(error);

      const nonce = 'abcd1234567890123456789012345678901234567890123456789012345678901234';
      const signature = 'efgh5678901234567890123456789012345678901234567890123456789012345678';

      const response = await request(app)
        .get(`/search_kernels?nonces=${nonce}&signatures=${signature}`)
        .expect(404);

      expect(response.text).toContain('Rendered: error');
      expect(response.text).toContain(JSON.stringify(error));
    });

    it('should set cache control header', async () => {
      const mockResult = [{ kernel: 'kernel1' }];
      mockClient.searchKernels.mockResolvedValue(mockResult);

      const nonce = 'abcd1234567890123456789012345678901234567890123456789012345678901234';
      const signature = 'efgh5678901234567890123456789012345678901234567890123456789012345678';

      const response = await request(app)
        .get(`/search_kernels?nonces=${nonce}&signatures=${signature}&json`)
        .expect(200);

      expect(response.headers['cache-control']).toBe('public, max-age=120, s-maxage=60, stale-while-revalidate=30');
    });

    it('should handle mixed case hex values', async () => {
      const mockResult = [{ kernel: 'kernel1' }];
      mockClient.searchKernels.mockResolvedValue(mockResult);

      const nonce = 'AbCd1234567890123456789012345678901234567890123456789012345678901234';
      const signature = 'EfGh5678901234567890123456789012345678901234567890123456789012345678';

      await request(app)
        .get(`/search_kernels?nonces=${nonce}&signatures=${signature}&json`)
        .expect(200);

      expect(mockClient.searchKernels).toHaveBeenCalledWith({
        signatures: [{
          public_nonce: Buffer.from(nonce, 'hex'),
          signature: Buffer.from(signature, 'hex')
        }]
      });
    });

    it('should reject nonces and signatures that are not exactly 64 hex characters', async () => {
      const shortNonce = 'abcd123456789012345678901234567890123456789012345678901234567890'; // 62 chars
      const longNonce = 'abcd123456789012345678901234567890123456789012345678901234567890123456'; // 66 chars
      const validSig = 'efgh5678901234567890123456789012345678901234567890123456789012345678';

      await request(app)
        .get(`/search_kernels?nonces=${shortNonce}&signatures=${validSig}`)
        .expect(404);

      await request(app)
        .get(`/search_kernels?nonces=${longNonce}&signatures=${validSig}`)
        .expect(404);

      expect(mockClient.searchKernels).not.toHaveBeenCalled();
    });

    it('should handle empty result from client', async () => {
      mockClient.searchKernels.mockResolvedValue([]);

      const nonce = 'abcd1234567890123456789012345678901234567890123456789012345678901234';
      const signature = 'efgh5678901234567890123456789012345678901234567890123456789012345678';

      const response = await request(app)
        .get(`/search_kernels?nonces=${nonce}&signatures=${signature}&json`)
        .expect(200);

      expect(response.body).toEqual({ items: [] });
    });

    it('should handle null result from client', async () => {
      mockClient.searchKernels.mockResolvedValue(null);

      const nonce = 'abcd1234567890123456789012345678901234567890123456789012345678901234';
      const signature = 'efgh5678901234567890123456789012345678901234567890123456789012345678';

      const response = await request(app)
        .get(`/search_kernels?nonces=${nonce}&signatures=${signature}&json`)
        .expect(200);

      expect(response.body).toEqual({ items: null });
    });

    it('should handle concurrent requests', async () => {
      const mockResult = [{ kernel: 'kernel1' }];
      mockClient.searchKernels.mockResolvedValue(mockResult);

      const nonce = 'abcd1234567890123456789012345678901234567890123456789012345678901234';
      const signature = 'efgh5678901234567890123456789012345678901234567890123456789012345678';

      const requests = [
        request(app).get(`/search_kernels?nonces=${nonce}&signatures=${signature}&json`),
        request(app).get(`/search_kernels?nonces=${nonce}&signatures=${signature}&json`),
        request(app).get(`/search_kernels?nonces=${nonce}&signatures=${signature}`)
      ];

      const responses = await Promise.all(requests);

      responses.forEach(response => {
        expect(response.status).toBe(200);
      });

      expect(mockClient.searchKernels).toHaveBeenCalledTimes(3);
    });

    it('should handle pairing of multiple nonces and signatures correctly', async () => {
      const mockResult = [{ kernel: 'kernel1' }];
      mockClient.searchKernels.mockResolvedValue(mockResult);

      const nonce1 = 'abcd1234567890123456789012345678901234567890123456789012345678901234';
      const nonce2 = 'bcde2345678901234567890123456789012345678901234567890123456789012345';
      const nonce3 = 'cdef3456789012345678901234567890123456789012345678901234567890123456';
      const sig1 = 'efgh5678901234567890123456789012345678901234567890123456789012345678';
      const sig2 = 'fghi6789012345678901234567890123456789012345678901234567890123456789';
      const sig3 = 'ghij7890123456789012345678901234567890123456789012345678901234567890';

      await request(app)
        .get(`/search_kernels?nonces=${nonce1},${nonce2},${nonce3}&signatures=${sig1},${sig2},${sig3}&json`)
        .expect(200);

      expect(mockClient.searchKernels).toHaveBeenCalledWith({
        signatures: [
          { public_nonce: Buffer.from(nonce1, 'hex'), signature: Buffer.from(sig1, 'hex') },
          { public_nonce: Buffer.from(nonce2, 'hex'), signature: Buffer.from(sig2, 'hex') },
          { public_nonce: Buffer.from(nonce3, 'hex'), signature: Buffer.from(sig3, 'hex') }
        ]
      });
    });
  });
});
