import { describe, it, expect, beforeEach, vi } from 'vitest';
import express from 'express';
import request from 'supertest';

// Mock the baseNodeClient
const mockClient = {
  getMempoolTransactions: vi.fn()
};

vi.mock('../../baseNodeClient.js', () => ({
  createClient: () => mockClient
}));

// Mock cache settings
vi.mock('../../cacheSettings.js', () => ({
  default: {
    mempool: 'public, max-age=30'
  }
}));

// Import the router after mocking
import mempoolRouter from '../mempool.js';

describe('mempool route', () => {
  let app: express.Application;

  beforeEach(() => {
    vi.clearAllMocks();
    
    app = express();
    app.set('view engine', 'hbs');
    app.use('/mempool', mempoolRouter);
    
    // Mock the render function
    app.use((req, res, next) => {
      res.render = vi.fn((template, data) => {
        if (template === 'error') {
          res.status(404).send(`Rendered: ${template} with ${JSON.stringify(data)}`);
        } else {
          res.status(200).send(`Rendered: ${template} with ${JSON.stringify(data)}`);
        }
      });
      next();
    });
  });

  describe('GET /:excessSigs', () => {
    it('should return 404 JSON when transaction not found with json parameter', async () => {
      const excessSig = 'notfound';
      mockClient.getMempoolTransactions.mockResolvedValue([]);

      const response = await request(app)
        .get(`/mempool/${excessSig}?json`)
        .expect(404);

      expect(response.body).toEqual({ error: 'Tx not found' });
      expect(mockClient.getMempoolTransactions).toHaveBeenCalledWith({});
    });

    it('should handle empty mempool', async () => {
      const excessSig = 'abc123';
      mockClient.getMempoolTransactions.mockResolvedValue([]);

      const response = await request(app)
        .get(`/mempool/${excessSig}?json`)
        .expect(404);

      expect(response.body).toEqual({ error: 'Tx not found' });
    });

    it('should handle null mempool response', async () => {
      const excessSig = 'abc123';
      mockClient.getMempoolTransactions.mockResolvedValue(null);

      await request(app)
        .get(`/mempool/${excessSig}?json`)
        .expect(500);
    });

    it('should handle client error gracefully', async () => {
      const excessSig = 'abc123';
      const error = new Error('gRPC connection failed');
      mockClient.getMempoolTransactions.mockRejectedValue(error);

      await request(app)
        .get(`/mempool/${excessSig}?json`)
        .expect(500);
    });

    it('should handle multiple excessSigs separated by +', async () => {
      const excessSigs = 'abc123+def456';
      mockClient.getMempoolTransactions.mockResolvedValue([]);

      const response = await request(app)
        .get(`/mempool/${excessSigs}?json`)
        .expect(404);

      expect(response.body).toEqual({ error: 'Tx not found' });
    });

    it('should handle transaction with RevealedValue range proof type', async () => {
      const mockTransactionWithRevealed = {
        transaction: {
          body: {
            kernels: [{
              excess_sig: {
                signature: Array.from(Buffer.from('def456', 'hex'))
              }
            }],
            outputs: [{
              features: {
                range_proof_type: 1
              },
              range_proof: {
                proof_bytes: Array.from(Buffer.from('proof456', 'hex'))
              }
            }]
          }
        }
      };

      const excessSig = 'def456';
      mockClient.getMempoolTransactions.mockResolvedValue([mockTransactionWithRevealed]);

      const response = await request(app)
        .get(`/mempool/${excessSig}?json`)
        .expect(200);

      expect(response.body.tx.body.outputs[0].range_proof).toBe('RevealedValue');
    });

    it('should handle transaction with no outputs', async () => {
      const noOutputsTransaction = {
        transaction: {
          body: {
            kernels: [{
              excess_sig: {
                signature: Array.from(Buffer.from('abc123', 'hex'))
              }
            }],
            outputs: []
          }
        }
      };

      const excessSig = 'abc123';
      mockClient.getMempoolTransactions.mockResolvedValue([noOutputsTransaction]);

      const response = await request(app)
        .get(`/mempool/${excessSig}?json`)
        .expect(200);

      expect(response.body.tx.body.outputs).toEqual([]);
    });

    it('should handle transaction with no kernels', async () => {
      const noKernelsTransaction = {
        transaction: {
          body: {
            kernels: [],
            outputs: [{
              features: { range_proof_type: 0 },
              range_proof: { proof_bytes: Array.from(Buffer.from('proof123', 'hex')) }
            }]
          }
        }
      };

      const excessSig = 'abc123';
      mockClient.getMempoolTransactions.mockResolvedValue([noKernelsTransaction]);

      const response = await request(app)
        .get(`/mempool/${excessSig}?json`)
        .expect(404);

      expect(response.body).toEqual({ error: 'Tx not found' });
    });

    it('should handle malformed transaction structure', async () => {
      const malformedTransaction = {
        transaction: {
          body: {
            // Missing kernels and outputs
          }
        }
      };

      const excessSig = 'abc123';
      mockClient.getMempoolTransactions.mockResolvedValue([malformedTransaction]);

      await request(app)
        .get(`/mempool/${excessSig}?json`)
        .expect(500);
    });

    it('should handle case sensitivity in excessSig', async () => {
      const mockTransaction = {
        transaction: {
          body: {
            kernels: [{
              excess_sig: {
                signature: Array.from(Buffer.from('abc123', 'hex'))
              }
            }],
            outputs: [{
              features: { range_proof_type: 0 },
              range_proof: { proof_bytes: Array.from(Buffer.from('proof123', 'hex')) }
            }]
          }
        }
      };

      const upperCaseSig = 'ABC123';
      mockClient.getMempoolTransactions.mockResolvedValue([mockTransaction]);

      const response = await request(app)
        .get(`/mempool/${upperCaseSig}?json`)
        .expect(404);

      expect(response.body).toEqual({ error: 'Tx not found' });
    });

    it('should call getMempoolTransactions with correct parameters', async () => {
      const excessSig = 'abc123';
      mockClient.getMempoolTransactions.mockResolvedValue([]);

      await request(app)
        .get(`/mempool/${excessSig}?json`)
        .expect(404);

      expect(mockClient.getMempoolTransactions).toHaveBeenCalledTimes(1);
      expect(mockClient.getMempoolTransactions).toHaveBeenCalledWith({});
    });

    it('should set correct cache headers', async () => {
      const excessSig = 'abc123';
      mockClient.getMempoolTransactions.mockResolvedValue([]);

      const response = await request(app)
        .get(`/mempool/${excessSig}?json`)
        .expect(404);

      expect(response.headers['cache-control']).toBe('public, max-age=30');
    });

    it('should handle undefined range_proof_type', async () => {
      const undefinedTypeTransaction = {
        transaction: {
          body: {
            kernels: [{
              excess_sig: {
                signature: Array.from(Buffer.from('abc123', 'hex'))
              }
            }],
            outputs: [{
              features: {
                // range_proof_type is undefined
              },
              range_proof: {
                proof_bytes: Array.from(Buffer.from('proof123', 'hex'))
              }
            }]
          }
        }
      };

      const excessSig = 'abc123';
      mockClient.getMempoolTransactions.mockResolvedValue([undefinedTypeTransaction]);

      const response = await request(app)
        .get(`/mempool/${excessSig}?json`)
        .expect(200);

      // Should default to RevealedValue when range_proof_type is not 0
      expect(response.body.tx.body.outputs[0].range_proof).toBe('RevealedValue');
    });

    it('should handle very long excessSig', async () => {
      const longSig = 'a'.repeat(1000);
      mockClient.getMempoolTransactions.mockResolvedValue([]);

      const response = await request(app)
        .get(`/mempool/${longSig}?json`)
        .expect(404);

      expect(response.body).toEqual({ error: 'Tx not found' });
    });

    it('should handle excessSig with special characters', async () => {
      const specialSig = 'abc%20123+def%2B456';
      mockClient.getMempoolTransactions.mockResolvedValue([]);

      const response = await request(app)
        .get(`/mempool/${specialSig}?json`)
        .expect(404);

      expect(response.body).toEqual({ error: 'Tx not found' });
    });

    it('should handle transaction with multiple kernels and find correct one', async () => {
      const multiKernelTransaction = {
        transaction: {
          body: {
            kernels: [
              {
                excess_sig: {
                  signature: Array.from(Buffer.from('kernel1', 'hex'))
                }
              },
              {
                excess_sig: {
                  signature: Array.from(Buffer.from('abc123', 'hex'))
                }
              }
            ],
            outputs: [{
              features: { range_proof_type: 1 },
              range_proof: { proof_bytes: Array.from(Buffer.from('proof123', 'hex')) }
            }]
          }
        }
      };

      const excessSig = 'abc123';
      mockClient.getMempoolTransactions.mockResolvedValue([multiKernelTransaction]);

      const response = await request(app)
        .get(`/mempool/${excessSig}?json`)
        .expect(200);

      expect(response.body).toHaveProperty('tx');
      expect(response.body.tx.body.outputs[0].range_proof).toBe('RevealedValue');
    });

    it('should handle empty excessSig parameter', async () => {
      mockClient.getMempoolTransactions.mockResolvedValue([]);

      // This will hit the 404 router handler since no route matches
      const response = await request(app)
        .get('/mempool/')
        .expect(404);

      // Express default 404 response doesn't have JSON body
      expect(response.body).toEqual({});
    });
  });
});
