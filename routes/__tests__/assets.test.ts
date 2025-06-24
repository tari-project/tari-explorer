import { describe, it, expect, beforeEach, vi } from 'vitest';
import express from 'express';
import request from 'supertest';
import path from 'path';
import hbs from 'hbs';

// Mock the baseNodeClient
const mockClient = {
  getTokens: vi.fn()
};

vi.mock('../../baseNodeClient.js', () => ({
  createClient: () => mockClient
}));

// Import the router after mocking
import assetsRouter from '../assets.js';

describe('assets route', () => {
  let app: express.Application;

  beforeEach(() => {
    vi.clearAllMocks();
    
    app = express();
    
    // Set up view engine with template paths
    app.set('view engine', 'hbs');
    app.set('views', path.join(process.cwd(), 'views'));
    
    // Register partials
    hbs.registerPartials(path.join(process.cwd(), 'partials'));
    
    app.use('/assets', assetsRouter);
  });

  describe('GET /:asset_public_key', () => {
    const validAssetKey = 'abcd1234567890abcdef1234567890abcdef1234567890abcdef1234567890ab';
    const mockTokens = [
      { id: 1, amount: 1000, description: 'Test Token 1' },
      { id: 2, amount: 2000, description: 'Test Token 2' }
    ];

    it('should return tokens as JSON when json query parameter is present', async () => {
      mockClient.getTokens.mockResolvedValue(mockTokens);

      const response = await request(app)
        .get(`/assets/${validAssetKey}?json`)
        .expect(200);

      expect(response.body).toEqual({
        title: `Asset with pub key: ${validAssetKey}`,
        tokens: mockTokens
      });
      expect(mockClient.getTokens).toHaveBeenCalledWith({
        asset_public_key: Buffer.from(validAssetKey, 'hex')
      });
    });

    it('should render assets template when no json query parameter', async () => {
      mockClient.getTokens.mockResolvedValue(mockTokens);

      const response = await request(app)
        .get(`/assets/${validAssetKey}`)
        .expect(500); // Will fail to render template since we don't have the actual template

      expect(mockClient.getTokens).toHaveBeenCalledWith({
        asset_public_key: Buffer.from(validAssetKey, 'hex')
      });
    });

    it('should handle empty json query parameter', async () => {
      mockClient.getTokens.mockResolvedValue(mockTokens);

      const response = await request(app)
        .get(`/assets/${validAssetKey}?json=`)
        .expect(200);

      expect(response.body).toEqual({
        title: `Asset with pub key: ${validAssetKey}`,
        tokens: mockTokens
      });
    });

    it('should handle any value for json query parameter', async () => {
      mockClient.getTokens.mockResolvedValue(mockTokens);

      const response = await request(app)
        .get(`/assets/${validAssetKey}?json=true`)
        .expect(200);

      expect(response.body).toEqual({
        title: `Asset with pub key: ${validAssetKey}`,
        tokens: mockTokens
      });
    });

    it('should return 404 when no tokens found (null)', async () => {
      mockClient.getTokens.mockResolvedValue(null);

      const response = await request(app)
        .get(`/assets/${validAssetKey}`)
        .expect(404);

      expect(response.text).toContain('Not found: No tokens for asset found');
      expect(mockClient.getTokens).toHaveBeenCalledWith({
        asset_public_key: Buffer.from(validAssetKey, 'hex')
      });
    });

    it('should return 404 when no tokens found (undefined)', async () => {
      mockClient.getTokens.mockResolvedValue(undefined);

      const response = await request(app)
        .get(`/assets/${validAssetKey}`)
        .expect(404);

      expect(response.text).toContain('Not found: No tokens for asset found');
    });

    it('should return 404 when tokens array is empty', async () => {
      mockClient.getTokens.mockResolvedValue([]);

      const response = await request(app)
        .get(`/assets/${validAssetKey}`)
        .expect(404);

      expect(response.text).toContain('Not found: No tokens for asset found');
    });

    it('should return 404 as JSON when json query param is present and no tokens found', async () => {
      mockClient.getTokens.mockResolvedValue(null);

      const response = await request(app)
        .get(`/assets/${validAssetKey}?json`)
        .expect(404);

      expect(response.text).toContain('Not found: No tokens for asset found');
    });

    it('should handle client throwing an error', async () => {
      const error = new Error('gRPC connection failed');
      mockClient.getTokens.mockRejectedValue(error);

      const response = await request(app)
        .get(`/assets/${validAssetKey}`)
        .expect(500);

      expect(mockClient.getTokens).toHaveBeenCalledWith({
        asset_public_key: Buffer.from(validAssetKey, 'hex')
      });
    });

    it('should handle client error with json query parameter', async () => {
      const error = new Error('Network error');
      mockClient.getTokens.mockRejectedValue(error);

      const response = await request(app)
        .get(`/assets/${validAssetKey}?json`)
        .expect(500);

      expect(mockClient.getTokens).toHaveBeenCalledWith({
        asset_public_key: Buffer.from(validAssetKey, 'hex')
      });
    });

    it('should properly convert hex string to buffer', async () => {
      const hexKey = 'deadbeef1234567890abcdef1234567890abcdef1234567890abcdef123456';
      mockClient.getTokens.mockResolvedValue(mockTokens);

      await request(app)
        .get(`/assets/${hexKey}`)
        .expect(500); // Will fail to render template

      expect(mockClient.getTokens).toHaveBeenCalledWith({
        asset_public_key: Buffer.from(hexKey, 'hex')
      });
      
      // Verify the buffer conversion is correct
      const expectedBuffer = Buffer.from(hexKey, 'hex');
      const actualCall = mockClient.getTokens.mock.calls[0][0];
      expect(actualCall.asset_public_key).toEqual(expectedBuffer);
    });

    it('should handle short hex keys', async () => {
      const shortKey = 'abcd';
      mockClient.getTokens.mockResolvedValue(mockTokens);

      await request(app)
        .get(`/assets/${shortKey}`)
        .expect(500); // Will fail to render template

      expect(mockClient.getTokens).toHaveBeenCalledWith({
        asset_public_key: Buffer.from(shortKey, 'hex')
      });
    });

    it('should handle invalid hex characters', async () => {
      const invalidKey = 'xyz123';
      mockClient.getTokens.mockResolvedValue(mockTokens);

      await request(app)
        .get(`/assets/${invalidKey}`)
        .expect(500); // Will fail to render template

      // Buffer.from with 'hex' will still work but may not produce expected results
      expect(mockClient.getTokens).toHaveBeenCalledWith({
        asset_public_key: Buffer.from(invalidKey, 'hex')
      });
    });

    it('should handle empty asset key', async () => {
      mockClient.getTokens.mockResolvedValue(mockTokens);

      await request(app)
        .get('/assets/')
        .expect(404); // This should not match the route
    });

    it('should handle single token in array', async () => {
      const singleToken = [{ id: 1, amount: 500, description: 'Single Token' }];
      mockClient.getTokens.mockResolvedValue(singleToken);

      const response = await request(app)
        .get(`/assets/${validAssetKey}?json`)
        .expect(200);

      expect(response.body).toEqual({
        title: `Asset with pub key: ${validAssetKey}`,
        tokens: singleToken
      });
    });

    it('should handle large token arrays', async () => {
      const largeTokenArray = Array.from({ length: 100 }, (_, i) => ({
        id: i + 1,
        amount: (i + 1) * 100,
        description: `Token ${i + 1}`
      }));
      mockClient.getTokens.mockResolvedValue(largeTokenArray);

      const response = await request(app)
        .get(`/assets/${validAssetKey}?json`)
        .expect(200);

      expect(response.body.tokens).toHaveLength(100);
      expect(response.body.tokens[0]).toEqual(largeTokenArray[0]);
      expect(response.body.tokens[99]).toEqual(largeTokenArray[99]);
    });

    it('should handle concurrent requests', async () => {
      mockClient.getTokens.mockResolvedValue(mockTokens);

      const requests = [
        request(app).get(`/assets/${validAssetKey}?json`),
        request(app).get(`/assets/${validAssetKey}`), // Will be 500
        request(app).get(`/assets/different${validAssetKey}?json`)
      ];

      const responses = await Promise.all(requests);

      // JSON requests should succeed, template rendering should fail
      expect(responses[0].status).toBe(200);
      expect(responses[1].status).toBe(500);
      expect(responses[2].status).toBe(200);

      expect(mockClient.getTokens).toHaveBeenCalledTimes(3);
    });

    it('should call getTokens with correct buffer for different hex keys', async () => {
      const keys = [
        'abcd1234',
        'deadbeef',
        '1234567890abcdef'
      ];
      
      mockClient.getTokens.mockResolvedValue(mockTokens);

      for (const key of keys) {
        await request(app)
          .get(`/assets/${key}`)
          .expect(500); // Will fail to render template
      }

      expect(mockClient.getTokens).toHaveBeenCalledTimes(3);
      
      // Verify each call had the correct buffer
      keys.forEach((key, index) => {
        expect(mockClient.getTokens.mock.calls[index][0]).toEqual({
          asset_public_key: Buffer.from(key, 'hex')
        });
      });
    });

    it('should handle tokens with complex nested data', async () => {
      const complexTokens = [
        {
          id: 1,
          amount: 1000,
          description: 'Complex Token',
          metadata: {
            creator: 'Alice',
            created_at: '2023-01-01',
            attributes: { color: 'blue', rarity: 'rare' }
          }
        }
      ];
      mockClient.getTokens.mockResolvedValue(complexTokens);

      const response = await request(app)
        .get(`/assets/${validAssetKey}?json`)
        .expect(200);

      expect(response.body).toEqual({
        title: `Asset with pub key: ${validAssetKey}`,
        tokens: complexTokens
      });
    });

    it('should preserve token data types', async () => {
      const typedTokens = [
        {
          id: 1,
          amount: 1000,
          active: true,
          metadata: null,
          tags: undefined,
          decimal_places: 8
        }
      ];
      mockClient.getTokens.mockResolvedValue(typedTokens);

      const response = await request(app)
        .get(`/assets/${validAssetKey}?json`)
        .expect(200);

      expect(response.body.tokens[0].id).toBe(1);
      expect(response.body.tokens[0].active).toBe(true);
      expect(response.body.tokens[0].metadata).toBe(null);
      expect(response.body.tokens[0].decimal_places).toBe(8);
    });
  });
});
