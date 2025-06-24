import { describe, it, expect, beforeEach, vi } from "vitest";
import express from "express";
import request from "supertest";

// Mock BEFORE imports - this is critical for ESM
vi.mock("../../baseNodeClient.js", () => ({
  createClient: vi.fn(() => ({
    getMempoolTransactions: vi.fn().mockResolvedValue([
      {
        transaction: {
          body: {
            kernels: [
              {
                excess_sig: {
                  signature: Buffer.from("abc123", "hex")
                }
              }
            ],
            outputs: [
              {
                features: { range_proof_type: 0 },
                range_proof: { proof_bytes: Buffer.from("666f756e64", "hex") }
              },
              {
                features: { range_proof_type: 1 },
                range_proof: { proof_bytes: Buffer.from("cafebabe", "hex") }
              }
            ]
          }
        }
      }
    ])
  })),
}));

vi.mock("../../cacheSettings.js", () => ({
  default: {
    mempool: "public, max-age=15"
  },
}));

import mempoolRouter from "../mempool.js";
import { createClient } from "../../baseNodeClient.js";

describe("mempool route (working)", () => {
  let app: express.Application;
  let mockClient: any;

  beforeEach(async () => {
    vi.clearAllMocks();
    
    // Get references to mocked modules
    mockClient = createClient();

    // Set up default mock responses
    mockClient.getMempoolTransactions.mockResolvedValue([
      {
        transaction: {
          body: {
            kernels: [
              {
                excess_sig: {
                  signature: Buffer.from("abc123", "hex")
                }
              }
            ],
            outputs: [
              {
                features: { range_proof_type: 0 },
                range_proof: { proof_bytes: Buffer.from("666f756e64", "hex") }
              },
              {
                features: { range_proof_type: 1 },
                range_proof: { proof_bytes: Buffer.from("cafebabe", "hex") }
              }
            ]
          }
        }
      }
    ]);

    // Create isolated Express app
    app = express();
    app.set("view engine", "hbs");
    
    // Mock template rendering to return JSON
    app.use((req, res, next) => {
      res.render = vi.fn((template, data) => {
        res.json({ template, data });
      });
      next();
    });

    app.use("/mempool", mempoolRouter);
  });

  describe("GET /:excessSigs", () => {
    it("should return transaction details for valid excess signature", async () => {
      const response = await request(app)
        .get("/mempool/abc123")
        .expect(200);

      expect(response.body.template).toBe("mempool");
      expect(response.body.data).toHaveProperty("tx");
      expect(response.body.data.tx).toHaveProperty("body");
      expect(response.body.data.tx.body).toHaveProperty("kernels");
      expect(response.body.data.tx.body).toHaveProperty("outputs");
    });

    it("should set mempool cache headers", async () => {
      const response = await request(app)
        .get("/mempool/abc123")
        .expect(200);

      expect(response.headers["cache-control"]).toBe("public, max-age=15");
    });

    it("should return JSON when json parameter present", async () => {
      const response = await request(app)
        .get("/mempool/abc123?json")
        .expect(200);

      expect(response.body).toHaveProperty("tx");
      expect(response.body).not.toHaveProperty("template");
    });

    it("should handle multiple excess signatures with + separator", async () => {
      // Mock for multiple signatures
      mockClient.getMempoolTransactions.mockResolvedValueOnce([
        {
          transaction: {
            body: {
              kernels: [
                {
                  excess_sig: {
                    signature: Buffer.from("def456", "hex")
                  }
                }
              ],
              outputs: []
            }
          }
        }
      ]);

      const response = await request(app)
        .get("/mempool/abc123+def456")
        .expect(200);

      expect(response.body.template).toBe("mempool");
      expect(response.body.data).toHaveProperty("tx");
    });

    it("should process range proofs correctly", async () => {
      const response = await request(app)
        .get("/mempool/abc123")
        .expect(200);

      const outputs = response.body.data.tx.body.outputs;
      
      // First output should have BulletProofPlus converted to hex
      expect(outputs[0].range_proof).toBe("666f756e64");
      
      // Second output should be RevealedValue
      expect(outputs[1].range_proof).toBe("RevealedValue");
    });

    it("should return 404 for non-existent transaction", async () => {
      // Mock empty mempool
      mockClient.getMempoolTransactions.mockResolvedValueOnce([]);

      const response = await request(app)
        .get("/mempool/nonexistent")
        .expect(404);

      expect(response.body.template).toBe("error");
      expect(response.body.data).toHaveProperty("error", "Tx not found");
    });

    it("should return 404 JSON for non-existent transaction with json param", async () => {
      // Mock empty mempool
      mockClient.getMempoolTransactions.mockResolvedValueOnce([]);

      const response = await request(app)
        .get("/mempool/nonexistent?json")
        .expect(404);

      expect(response.body).toEqual({ error: "Tx not found" });
      expect(response.body).not.toHaveProperty("template");
    });

    it("should search through multiple transactions", async () => {
      // Mock mempool with multiple transactions
      mockClient.getMempoolTransactions.mockResolvedValueOnce([
        {
          transaction: {
            body: {
              kernels: [
                {
                  excess_sig: {
                    signature: Buffer.from("wrong123", "hex")
                  }
                }
              ],
              outputs: []
            }
          }
        },
        {
          transaction: {
            body: {
              kernels: [
                {
                  excess_sig: {
                    signature: Buffer.from("abc123", "hex")
                  }
                }
              ],
              outputs: [
              {
              features: { range_proof_type: 0 },
              range_proof: { proof_bytes: Buffer.from("666f756e64", "hex") }
              }
              ]
            }
          }
        }
      ]);

      const response = await request(app)
        .get("/mempool/abc123")
        .expect(200);

      expect(response.body.template).toBe("mempool");
      expect(response.body.data.tx.body.outputs[0].range_proof).toBe("666f756e64");
    });

    it("should handle transactions with multiple kernels", async () => {
      // Mock transaction with multiple kernels
      mockClient.getMempoolTransactions.mockResolvedValueOnce([
        {
          transaction: {
            body: {
              kernels: [
                {
                  excess_sig: {
                    signature: Buffer.from("wrong", "hex")
                  }
                },
                {
                  excess_sig: {
                    signature: Buffer.from("abc123", "hex")
                  }
                }
              ],
              outputs: []
            }
          }
        }
      ]);

      const response = await request(app)
        .get("/mempool/abc123")
        .expect(200);

      expect(response.body.template).toBe("mempool");
      expect(response.body.data).toHaveProperty("tx");
    });

    it("should handle empty mempool gracefully", async () => {
      // Mock completely empty mempool
      mockClient.getMempoolTransactions.mockImplementationOnce(async () => []);

      const response = await request(app)
        .get("/mempool/nonexistent")
        .expect(404);

      expect(response.body.template).toBe("error");
    });
  });
});
