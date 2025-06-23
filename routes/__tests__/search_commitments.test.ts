import { describe, it, expect, beforeEach, vi } from 'vitest';
import express from 'express';
import request from 'supertest';

// Mock the baseNodeClient
const mockClient = {
  searchUtxos: vi.fn()
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
import searchCommitmentsRouter from '../search_commitments.js';

describe('search_commitments route', () => {
  let app: express.Application;

  beforeEach(() => {
    vi.clearAllMocks();
    
    app = express();
    app.set('view engine', 'hbs');
    app.use('/search_commitments', searchCommitmentsRouter);
    
    // Mock the render function
    app.use((req, res, next) => {
      res.render = vi.fn((template, data) => {
        res.status(200).end(`Rendered: ${template} with ${JSON.stringify(data)}`);
      });
      next();
    });

    // Add a final handler to handle cases where no response is sent
    app.use((req, res, next) => {
      if (!res.headersSent) {
        res.status(404).end();
      }
    });
  });

  describe('GET /', () => {
    it('should search commitments successfully and return JSON', async () => {
      const mockResult = [{ commitment: 'abc123', output: 'output1' }];
      mockClient.searchUtxos.mockResolvedValue(mockResult);

      const response = await request(app)
        .get('/search_commitments?comm=abcd1234567890123456789012345678901234567890123456789012345678901234&json')
        .expect(200);

      expect(response.body).toEqual({ items: mockResult });
      expect(mockClient.searchUtxos).toHaveBeenCalledWith({
        commitments: [Buffer.from('abcd1234567890123456789012345678901234567890123456789012345678901234', 'hex')]
      });
    });

    it('should search commitments successfully and render template', async () => {
      const mockResult = [{ commitment: 'abc123', output: 'output1' }];
      mockClient.searchUtxos.mockResolvedValue(mockResult);

      const response = await request(app)
        .get('/search_commitments?comm=abcd1234567890123456789012345678901234567890123456789012345678901234')
        .expect(200);

      expect(response.text).toContain('Rendered: search');
      expect(mockClient.searchUtxos).toHaveBeenCalledTimes(1);
    });

    it('should handle multiple query parameter names (comm, commitment, c)', async () => {
      const mockResult = [{ commitment: 'test' }];
      mockClient.searchUtxos.mockResolvedValue(mockResult);

      // Test comm parameter
      await request(app)
        .get('/search_commitments?comm=abcd1234567890123456789012345678901234567890123456789012345678901234&json')
        .expect(200);

      // Test commitment parameter
      await request(app)
        .get('/search_commitments?commitment=abcd1234567890123456789012345678901234567890123456789012345678901234&json')
        .expect(200);

      // Test c parameter
      await request(app)
        .get('/search_commitments?c=abcd1234567890123456789012345678901234567890123456789012345678901234&json')
        .expect(200);

      expect(mockClient.searchUtxos).toHaveBeenCalledTimes(3);
    });

    it('should handle multiple commitments separated by commas', async () => {
      const mockResult = [{ commitment: 'test1' }, { commitment: 'test2' }];
      mockClient.searchUtxos.mockResolvedValue(mockResult);

      const commitment1 = 'abcd1234567890123456789012345678901234567890123456789012345678901234';
      const commitment2 = 'efgh5678901234567890123456789012345678901234567890123456789012345678';

      await request(app)
        .get(`/search_commitments?comm=${commitment1},${commitment2}&json`)
        .expect(200);

      expect(mockClient.searchUtxos).toHaveBeenCalledWith({
        commitments: [
          Buffer.from(commitment1, 'hex'),
          Buffer.from(commitment2, 'hex')
        ]
      });
    });

    it('should filter out invalid commitment formats', async () => {
      const mockResult = [{ commitment: 'test' }];
      mockClient.searchUtxos.mockResolvedValue(mockResult);

      const validCommitment = 'abcd1234567890123456789012345678901234567890123456789012345678901234';
      const invalidCommitments = 'invalid,123,too-short,abcdefg';

      await request(app)
        .get(`/search_commitments?comm=${validCommitment},${invalidCommitments}&json`)
        .expect(200);

      expect(mockClient.searchUtxos).toHaveBeenCalledWith({
        commitments: [Buffer.from(validCommitment, 'hex')]
      });
    });

    it('should remove duplicates from commitment list', async () => {
      const mockResult = [{ commitment: 'test' }];
      mockClient.searchUtxos.mockResolvedValue(mockResult);

      const commitment = 'abcd1234567890123456789012345678901234567890123456789012345678901234';

      await request(app)
        .get(`/search_commitments?comm=${commitment},${commitment},${commitment}&json`)
        .expect(200);

      expect(mockClient.searchUtxos).toHaveBeenCalledWith({
        commitments: [Buffer.from(commitment, 'hex')]
      });
    });

    it('should trim whitespace from commitments', async () => {
      const mockResult = [{ commitment: 'test' }];
      mockClient.searchUtxos.mockResolvedValue(mockResult);

      const commitment = 'abcd1234567890123456789012345678901234567890123456789012345678901234';

      await request(app)
        .get(`/search_commitments?comm= ${commitment} , ${commitment} &json`)
        .expect(200);

      expect(mockClient.searchUtxos).toHaveBeenCalledWith({
        commitments: [Buffer.from(commitment, 'hex')]
      });
    });

    it('should return 404 for empty commitment parameter', async () => {
      const response = await request(app)
        .get('/search_commitments?comm=');

      expect(response.status).toBe(404);
      expect(mockClient.searchUtxos).not.toHaveBeenCalled();
    });

    it('should return 404 for missing commitment parameter', async () => {
      const response = await request(app)
        .get('/search_commitments');

      expect(response.status).toBe(404);
      expect(mockClient.searchUtxos).not.toHaveBeenCalled();
    });

    it('should return 404 for only invalid commitment formats', async () => {
      const response = await request(app)
        .get('/search_commitments?comm=invalid,too-short,123');

      expect(response.status).toBe(404);
      expect(mockClient.searchUtxos).not.toHaveBeenCalled();
    });

    it('should handle client error and return JSON error', async () => {
      const error = new Error('gRPC connection failed');
      mockClient.searchUtxos.mockRejectedValue(error);

      const response = await request(app)
        .get('/search_commitments?comm=abcd1234567890123456789012345678901234567890123456789012345678901234&json')
        .expect(404);

      expect(response.body).toEqual({ error: error });
    });

    it('should handle client error and render error template', async () => {
      const error = new Error('gRPC connection failed');
      mockClient.searchUtxos.mockRejectedValue(error);

      const response = await request(app)
        .get('/search_commitments?comm=abcd1234567890123456789012345678901234567890123456789012345678901234')
        .expect(404);

      expect(response.text).toContain('Rendered: error');
      expect(response.text).toContain(JSON.stringify(error));
    });

    it('should set cache control header', async () => {
      const mockResult = [{ commitment: 'test' }];
      mockClient.searchUtxos.mockResolvedValue(mockResult);

      const response = await request(app)
        .get('/search_commitments?comm=abcd1234567890123456789012345678901234567890123456789012345678901234&json')
        .expect(200);

      expect(response.headers['cache-control']).toBe('public, max-age=120, s-maxage=60, stale-while-revalidate=30');
    });

    it('should handle mixed case hex values', async () => {
      const mockResult = [{ commitment: 'test' }];
      mockClient.searchUtxos.mockResolvedValue(mockResult);

      const mixedCaseCommitment = 'AbCd1234567890123456789012345678901234567890123456789012345678901234';

      await request(app)
        .get(`/search_commitments?comm=${mixedCaseCommitment}&json`)
        .expect(200);

      expect(mockClient.searchUtxos).toHaveBeenCalledWith({
        commitments: [Buffer.from(mixedCaseCommitment, 'hex')]
      });
    });

    it('should reject commitments that are not exactly 64 hex characters', async () => {
      const shortCommitment = 'abcd123456789012345678901234567890123456789012345678901234567890'; // 62 chars
      const longCommitment = 'abcd123456789012345678901234567890123456789012345678901234567890123456'; // 66 chars

      const response1 = await request(app)
        .get(`/search_commitments?comm=${shortCommitment}`);

      const response2 = await request(app)
        .get(`/search_commitments?comm=${longCommitment}`);

      expect(response1.status).toBe(404);
      expect(response2.status).toBe(404);
      expect(mockClient.searchUtxos).not.toHaveBeenCalled();
    });

    it('should handle empty result from client', async () => {
      mockClient.searchUtxos.mockResolvedValue([]);

      const response = await request(app)
        .get('/search_commitments?comm=abcd1234567890123456789012345678901234567890123456789012345678901234&json')
        .expect(200);

      expect(response.body).toEqual({ items: [] });
    });

    it('should handle null result from client', async () => {
      mockClient.searchUtxos.mockResolvedValue(null);

      const response = await request(app)
        .get('/search_commitments?comm=abcd1234567890123456789012345678901234567890123456789012345678901234&json')
        .expect(200);

      expect(response.body).toEqual({ items: null });
    });

    it('should handle concurrent requests', async () => {
      const mockResult = [{ commitment: 'test' }];
      mockClient.searchUtxos.mockResolvedValue(mockResult);

      const commitment = 'abcd1234567890123456789012345678901234567890123456789012345678901234';
      const requests = [
        request(app).get(`/search_commitments?comm=${commitment}&json`),
        request(app).get(`/search_commitments?commitment=${commitment}&json`),
        request(app).get(`/search_commitments?c=${commitment}`)
      ];

      const responses = await Promise.all(requests);

      responses.forEach(response => {
        expect(response.status).toBe(200);
      });

      expect(mockClient.searchUtxos).toHaveBeenCalledTimes(3);
    });
  });
});
