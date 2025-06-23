import { describe, it, expect, beforeEach, vi } from 'vitest';
import express from 'express';
import request from 'supertest';

// Mock the baseNodeClient
const mockClient = {
  searchPaymentReferences: vi.fn()
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
import searchOutputsByPayrefRouter from '../search_outputs_by_payref.js';

describe('search_outputs_by_payref route', () => {
  let app: express.Application;

  beforeEach(() => {
    vi.clearAllMocks();
    
    app = express();
    app.set('view engine', 'hbs');
    app.use('/search_outputs_by_payref', searchOutputsByPayrefRouter);
    
    // Mock the render function
    app.use((req, res, next) => {
      res.render = vi.fn((template, data) => {
        res.status(200).send(`Rendered: ${template} with ${JSON.stringify(data)}`);
      });
      next();
    });
  });

  describe('GET /', () => {
    it('should search payment references successfully and return JSON', async () => {
      const mockResult = [{ payref: 'payref1', output: 'output1' }];
      mockClient.searchPaymentReferences.mockResolvedValue(mockResult);

      const response = await request(app)
        .get('/search_outputs_by_payref?pay=abcd1234567890123456789012345678901234567890123456789012345678901234&json')
        .expect(200);

      expect(response.body).toEqual({ items: mockResult });
      expect(mockClient.searchPaymentReferences).toHaveBeenCalledWith({
        payment_reference_hex: ['abcd1234567890123456789012345678901234567890123456789012345678901234'],
        include_spent: true
      });
    });

    it('should search payment references successfully and render template', async () => {
      const mockResult = [{ payref: 'payref1', output: 'output1' }];
      mockClient.searchPaymentReferences.mockResolvedValue(mockResult);

      const response = await request(app)
        .get('/search_outputs_by_payref?pay=abcd1234567890123456789012345678901234567890123456789012345678901234')
        .expect(200);

      expect(response.text).toContain('Rendered: search_payref');
      expect(mockClient.searchPaymentReferences).toHaveBeenCalledTimes(1);
    });

    it('should handle multiple query parameter names (pay, payref, p)', async () => {
      const mockResult = [{ payref: 'test' }];
      mockClient.searchPaymentReferences.mockResolvedValue(mockResult);

      const payref = 'abcd1234567890123456789012345678901234567890123456789012345678901234';

      // Test pay parameter
      await request(app)
        .get(`/search_outputs_by_payref?pay=${payref}&json`)
        .expect(200);

      // Test payref parameter
      await request(app)
        .get(`/search_outputs_by_payref?payref=${payref}&json`)
        .expect(200);

      // Test p parameter
      await request(app)
        .get(`/search_outputs_by_payref?p=${payref}&json`)
        .expect(200);

      expect(mockClient.searchPaymentReferences).toHaveBeenCalledTimes(3);
    });

    it('should handle multiple payment references separated by commas', async () => {
      const mockResult = [{ payref: 'test1' }, { payref: 'test2' }];
      mockClient.searchPaymentReferences.mockResolvedValue(mockResult);

      const payref1 = 'abcd1234567890123456789012345678901234567890123456789012345678901234';
      const payref2 = 'efgh5678901234567890123456789012345678901234567890123456789012345678';

      await request(app)
        .get(`/search_outputs_by_payref?pay=${payref1},${payref2}&json`)
        .expect(200);

      expect(mockClient.searchPaymentReferences).toHaveBeenCalledWith({
        payment_reference_hex: [payref1, payref2],
        include_spent: true
      });
    });

    it('should filter out invalid payment reference formats', async () => {
      const mockResult = [{ payref: 'test' }];
      mockClient.searchPaymentReferences.mockResolvedValue(mockResult);

      const validPayref = 'abcd1234567890123456789012345678901234567890123456789012345678901234';
      const invalidPayrefs = 'invalid,123,too-short,abcdefg';

      await request(app)
        .get(`/search_outputs_by_payref?pay=${validPayref},${invalidPayrefs}&json`)
        .expect(200);

      expect(mockClient.searchPaymentReferences).toHaveBeenCalledWith({
        payment_reference_hex: [validPayref],
        include_spent: true
      });
    });

    it('should remove duplicates from payment reference list', async () => {
      const mockResult = [{ payref: 'test' }];
      mockClient.searchPaymentReferences.mockResolvedValue(mockResult);

      const payref = 'abcd1234567890123456789012345678901234567890123456789012345678901234';

      await request(app)
        .get(`/search_outputs_by_payref?pay=${payref},${payref},${payref}&json`)
        .expect(200);

      expect(mockClient.searchPaymentReferences).toHaveBeenCalledWith({
        payment_reference_hex: [payref],
        include_spent: true
      });
    });

    it('should trim whitespace from payment references', async () => {
      const mockResult = [{ payref: 'test' }];
      mockClient.searchPaymentReferences.mockResolvedValue(mockResult);

      const payref = 'abcd1234567890123456789012345678901234567890123456789012345678901234';

      await request(app)
        .get(`/search_outputs_by_payref?pay= ${payref} , ${payref} &json`)
        .expect(200);

      expect(mockClient.searchPaymentReferences).toHaveBeenCalledWith({
        payment_reference_hex: [payref],
        include_spent: true
      });
    });

    it('should return 404 for empty payment reference parameter', async () => {
      await request(app)
        .get('/search_outputs_by_payref?pay=')
        .expect(404);

      expect(mockClient.searchPaymentReferences).not.toHaveBeenCalled();
    });

    it('should return 404 for missing payment reference parameter', async () => {
      await request(app)
        .get('/search_outputs_by_payref')
        .expect(404);

      expect(mockClient.searchPaymentReferences).not.toHaveBeenCalled();
    });

    it('should return 404 for only invalid payment reference formats', async () => {
      await request(app)
        .get('/search_outputs_by_payref?pay=invalid,too-short,123')
        .expect(404);

      expect(mockClient.searchPaymentReferences).not.toHaveBeenCalled();
    });

    it('should handle client error and return JSON error', async () => {
      const error = new Error('gRPC connection failed');
      mockClient.searchPaymentReferences.mockRejectedValue(error);

      const response = await request(app)
        .get('/search_outputs_by_payref?pay=abcd1234567890123456789012345678901234567890123456789012345678901234&json')
        .expect(404);

      expect(response.body).toEqual({ error: error });
    });

    it('should handle client error and render error template', async () => {
      const error = new Error('gRPC connection failed');
      mockClient.searchPaymentReferences.mockRejectedValue(error);

      const response = await request(app)
        .get('/search_outputs_by_payref?pay=abcd1234567890123456789012345678901234567890123456789012345678901234')
        .expect(404);

      expect(response.text).toContain('Rendered: error');
      expect(response.text).toContain(JSON.stringify(error));
    });

    it('should set cache control header', async () => {
      const mockResult = [{ payref: 'test' }];
      mockClient.searchPaymentReferences.mockResolvedValue(mockResult);

      const response = await request(app)
        .get('/search_outputs_by_payref?pay=abcd1234567890123456789012345678901234567890123456789012345678901234&json')
        .expect(200);

      expect(response.headers['cache-control']).toBe('public, max-age=120, s-maxage=60, stale-while-revalidate=30');
    });

    it('should handle mixed case hex values', async () => {
      const mockResult = [{ payref: 'test' }];
      mockClient.searchPaymentReferences.mockResolvedValue(mockResult);

      const mixedCasePayref = 'AbCd1234567890123456789012345678901234567890123456789012345678901234';

      await request(app)
        .get(`/search_outputs_by_payref?pay=${mixedCasePayref}&json`)
        .expect(200);

      expect(mockClient.searchPaymentReferences).toHaveBeenCalledWith({
        payment_reference_hex: [mixedCasePayref],
        include_spent: true
      });
    });

    it('should reject payment references that are not exactly 64 hex characters', async () => {
      const shortPayref = 'abcd123456789012345678901234567890123456789012345678901234567890'; // 62 chars
      const longPayref = 'abcd123456789012345678901234567890123456789012345678901234567890123456'; // 66 chars

      await request(app)
        .get(`/search_outputs_by_payref?pay=${shortPayref}`)
        .expect(404);

      await request(app)
        .get(`/search_outputs_by_payref?pay=${longPayref}`)
        .expect(404);

      expect(mockClient.searchPaymentReferences).not.toHaveBeenCalled();
    });

    it('should handle empty result from client', async () => {
      mockClient.searchPaymentReferences.mockResolvedValue([]);

      const response = await request(app)
        .get('/search_outputs_by_payref?pay=abcd1234567890123456789012345678901234567890123456789012345678901234&json')
        .expect(200);

      expect(response.body).toEqual({ items: [] });
    });

    it('should handle null result from client', async () => {
      mockClient.searchPaymentReferences.mockResolvedValue(null);

      const response = await request(app)
        .get('/search_outputs_by_payref?pay=abcd1234567890123456789012345678901234567890123456789012345678901234&json')
        .expect(200);

      expect(response.body).toEqual({ items: null });
    });

    it('should handle concurrent requests', async () => {
      const mockResult = [{ payref: 'test' }];
      mockClient.searchPaymentReferences.mockResolvedValue(mockResult);

      const payref = 'abcd1234567890123456789012345678901234567890123456789012345678901234';
      const requests = [
        request(app).get(`/search_outputs_by_payref?pay=${payref}&json`),
        request(app).get(`/search_outputs_by_payref?payref=${payref}&json`),
        request(app).get(`/search_outputs_by_payref?p=${payref}`)
      ];

      const responses = await Promise.all(requests);

      responses.forEach(response => {
        expect(response.status).toBe(200);
      });

      expect(mockClient.searchPaymentReferences).toHaveBeenCalledTimes(3);
    });

    it('should always include spent outputs in search', async () => {
      const mockResult = [{ payref: 'test' }];
      mockClient.searchPaymentReferences.mockResolvedValue(mockResult);

      const payref = 'abcd1234567890123456789012345678901234567890123456789012345678901234';

      await request(app)
        .get(`/search_outputs_by_payref?pay=${payref}&json`)
        .expect(200);

      expect(mockClient.searchPaymentReferences).toHaveBeenCalledWith({
        payment_reference_hex: [payref],
        include_spent: true
      });
    });

    it('should handle complex comma-separated payment references with mixed validity', async () => {
      const mockResult = [{ payref: 'test1' }, { payref: 'test2' }];
      mockClient.searchPaymentReferences.mockResolvedValue(mockResult);

      const validPayref1 = 'abcd1234567890123456789012345678901234567890123456789012345678901234';
      const validPayref2 = 'efgh5678901234567890123456789012345678901234567890123456789012345678';
      const invalidPayref = 'invalid';

      await request(app)
        .get(`/search_outputs_by_payref?pay=${validPayref1},${invalidPayref},${validPayref2}&json`)
        .expect(200);

      expect(mockClient.searchPaymentReferences).toHaveBeenCalledWith({
        payment_reference_hex: [validPayref1, validPayref2],
        include_spent: true
      });
    });

    it('should handle parameter precedence correctly', async () => {
      const mockResult = [{ payref: 'test' }];
      mockClient.searchPaymentReferences.mockResolvedValue(mockResult);

      const payref1 = 'abcd1234567890123456789012345678901234567890123456789012345678901234';
      const payref2 = 'efgh5678901234567890123456789012345678901234567890123456789012345678';
      const payref3 = 'ijkl9012345678901234567890123456789012345678901234567890123456789012';

      // Test parameter precedence: pay > payref > p
      await request(app)
        .get(`/search_outputs_by_payref?pay=${payref1}&payref=${payref2}&p=${payref3}&json`)
        .expect(200);

      expect(mockClient.searchPaymentReferences).toHaveBeenCalledWith({
        payment_reference_hex: [payref1],
        include_spent: true
      });
    });

    it('should handle non-hex characters in payment references', async () => {
      const payrefWithNonHex = 'abcd1234567890123456789012345678901234567890123456789012345678901z34'; // 'z' is not hex

      await request(app)
        .get(`/search_outputs_by_payref?pay=${payrefWithNonHex}`)
        .expect(404);

      expect(mockClient.searchPaymentReferences).not.toHaveBeenCalled();
    });
  });
});
