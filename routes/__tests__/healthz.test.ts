import { describe, it, expect, beforeEach, vi } from 'vitest';
import express from 'express';
import request from 'supertest';

// Mock the baseNodeClient
const mockClient = {
  getVersion: vi.fn()
};

vi.mock('../../baseNodeClient.js', () => ({
  createClient: () => mockClient
}));

// Import the router after mocking
import healthzRouter from '../healthz.js';

describe('healthz route', () => {
  let app: express.Application;

  beforeEach(() => {
    vi.clearAllMocks();
    
    app = express();
    app.set('view engine', 'hbs');
    app.use('/healthz', healthzRouter);
    
    // Mock the render function
    app.use((req, res, next) => {
      res.render = vi.fn((template, data) => {
        res.status(200).send(`Rendered: ${template} with ${JSON.stringify(data)}`);
      });
      next();
    });
  });

  describe('GET /', () => {
    it('should return version information as JSON when json query parameter is present', async () => {
      const mockVersion = 'v1.2.3';
      mockClient.getVersion.mockResolvedValue({ value: mockVersion });

      const response = await request(app)
        .get('/healthz?json')
        .expect(200);

      expect(response.body).toEqual({ version: mockVersion });
      expect(mockClient.getVersion).toHaveBeenCalledWith({});
    });

    it('should render healthz template when no json query parameter', async () => {
      const mockVersion = 'v1.2.3';
      mockClient.getVersion.mockResolvedValue({ value: mockVersion });

      const response = await request(app)
        .get('/healthz')
        .expect(200);

      expect(response.text).toContain('Version:');
      expect(response.text).toContain(mockVersion);
      expect(mockClient.getVersion).toHaveBeenCalledWith({});
    });

    it('should handle empty json query parameter', async () => {
      const mockVersion = 'v2.0.0';
      mockClient.getVersion.mockResolvedValue({ value: mockVersion });

      const response = await request(app)
        .get('/healthz?json=')
        .expect(200);

      expect(response.body).toEqual({ version: mockVersion });
    });

    it('should handle any value for json query parameter', async () => {
      const mockVersion = 'v3.1.0';
      mockClient.getVersion.mockResolvedValue({ value: mockVersion });

      const response = await request(app)
        .get('/healthz?json=true')
        .expect(200);

      expect(response.body).toEqual({ version: mockVersion });
    });

    it('should handle null version from client', async () => {
      mockClient.getVersion.mockResolvedValue({ value: null });

      const response = await request(app)
        .get('/healthz?json')
        .expect(200);

      expect(response.body).toEqual({ version: null });
    });

    it('should handle undefined version from client', async () => {
      mockClient.getVersion.mockResolvedValue({ value: undefined });

      const response = await request(app)
        .get('/healthz?json')
        .expect(200);

      expect(response.body).toEqual({ version: undefined });
    });

    it('should handle client throwing an error', async () => {
      const error = new Error('gRPC connection failed');
      mockClient.getVersion.mockRejectedValue(error);

      const response = await request(app)
        .get('/healthz?json')
        .expect(500);

      expect(mockClient.getVersion).toHaveBeenCalledWith({});
    });

    it('should call getVersion with empty object', async () => {
      const mockVersion = 'v1.0.0';
      mockClient.getVersion.mockResolvedValue({ value: mockVersion });

      await request(app)
        .get('/healthz?json')
        .expect(200);

      expect(mockClient.getVersion).toHaveBeenCalledTimes(1);
      expect(mockClient.getVersion).toHaveBeenCalledWith({});
    });

    it('should handle concurrent requests', async () => {
      const mockVersion = 'v1.0.0';
      mockClient.getVersion.mockResolvedValue({ value: mockVersion });

      const requests = [
        request(app).get('/healthz?json'),
        request(app).get('/healthz?json'),
        request(app).get('/healthz')
      ];

      const responses = await Promise.all(requests);

      responses.forEach(response => {
        expect(response.status).toBe(200);
      });

      expect(mockClient.getVersion).toHaveBeenCalledTimes(3);
    });

    it('should handle complex version strings', async () => {
      const complexVersion = 'v1.2.3-beta.1+build.456';
      mockClient.getVersion.mockResolvedValue({ value: complexVersion });

      const response = await request(app)
        .get('/healthz?json')
        .expect(200);

      expect(response.body).toEqual({ version: complexVersion });
    });

    it('should handle version with special characters', async () => {
      const specialVersion = 'v1.0.0-αβγ-test+build@123';
      mockClient.getVersion.mockResolvedValue({ value: specialVersion });

      const response = await request(app)
        .get('/healthz?json')
        .expect(200);

      expect(response.body).toEqual({ version: specialVersion });
    });

    it('should handle numeric version', async () => {
      const numericVersion = 123;
      mockClient.getVersion.mockResolvedValue({ value: numericVersion });

      const response = await request(app)
        .get('/healthz?json')
        .expect(200);

      expect(response.body).toEqual({ version: numericVersion });
    });

    it('should handle boolean version', async () => {
      const booleanVersion = true;
      mockClient.getVersion.mockResolvedValue({ value: booleanVersion });

      const response = await request(app)
        .get('/healthz?json')
        .expect(200);

      expect(response.body).toEqual({ version: booleanVersion });
    });

    it('should handle client response without value property', async () => {
      mockClient.getVersion.mockResolvedValue({});

      const response = await request(app)
        .get('/healthz?json')
        .expect(200);

      expect(response.body).toEqual({ version: undefined });
    });
  });
});
