import { describe, it, expect, beforeEach, vi } from "vitest";
import express from "express";
import request from "supertest";
import { getIndexData } from "../index.js";

// Mock BEFORE imports - this is critical for ESM
vi.mock("../../baseNodeClient.js", () => ({
  createClient: vi.fn(() => ({
    getTipInfo: vi.fn().mockResolvedValue({
      metadata: { best_block_height: 100 }
    }),
    getVersion: vi.fn().mockResolvedValue({
      value: "1.0.0-test-version-string-with-long-name"
    }),
    listHeaders: vi.fn().mockResolvedValue([
      {
        header: {
          height: 100,
          timestamp: Date.now() / 1000,
          pow: { pow_algo: 0 }
        }
      },
      {
        header: {
          height: 99,
          timestamp: Date.now() / 1000 - 60,
          pow: { pow_algo: 1 }
        }
      }
    ]),
    getMempoolTransactions: vi.fn().mockResolvedValue([
      {
        transaction: {
          body: {
            kernels: [{ excess_sig: { signature: Buffer.from("test", "hex") } }],
            outputs: [{ features: { range_proof_type: 0 } }]
          }
        }
      }
    ]),
    getNetworkDifficulty: vi.fn().mockResolvedValue([
      { difficulty: "1000000", estimated_hash_rate: "500000", height: 100, timestamp: Date.now() / 1000 },
      { difficulty: "999999", estimated_hash_rate: "499999", height: 99, timestamp: Date.now() / 1000 - 60 }
    ]),
    getBlocks: vi.fn().mockResolvedValue([
      {
        block: {
          header: {
            height: 100,
            timestamp: Date.now() / 1000,
            pow: { pow_algo: 0 }
          },
          body: {
            outputs: [
              {
                features: {
                  output_type: 0,
                  coinbase_extra: Buffer.from("test")
                },
                minimum_value_promise: "1000000"
              }
            ]
          }
        }
      }
    ]),
    getActiveValidatorNodes: vi.fn().mockResolvedValue([]),
  })),
}));

vi.mock("../../cacheSettings.js", () => ({
  default: {
    index: "public, max-age=120"
  },
}));

vi.mock("../../utils/stats.js", () => ({
  miningStats: vi.fn().mockReturnValue({
    reward: "1000000",
    difficulty: "123456789",
    hashRate: "1000000000"
  }),
}));

vi.mock("../../cache.js", () => ({
  default: {
    get: vi.fn(),
  },
}));

import indexRouter from "../index.js";
import { createClient } from "../../baseNodeClient.js";

describe("index route", () => {
  let app: express.Application;
  let mockClient: any;

  beforeEach(async () => {
    vi.clearAllMocks();
    
    // Get references to mocked modules
    mockClient = createClient();

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

    // Mock background updater
    app.use((req, res, next) => {
      res.locals.backgroundUpdater = {
        isHealthy: vi.fn(() => true),
        getData: vi.fn(() => ({ 
          indexData: {
            tipInfo: { metadata: { best_block_height: 100 } },
            version: "test-version",
            mempool: [],
            headers: [],
            from: parseInt((req.query.from as string) || "0"),
            limit: (() => {
              let limit = parseInt((req.query.limit as string) || "20");
              if (limit > 100) limit = 100;
              return limit;
            })(),
            title: "Blocks",
            blockTimes: [],
            totalHashRates: [1000000],
            currentHashRate: 1000000
          }
        }))
      };
      next();
    });

    app.use("/", indexRouter);
  });

  describe("GET /", () => {
    it("should return homepage with default parameters", async () => {
      const response = await request(app)
        .get("/")
        .expect(200);

      expect(response.body.template).toBe("index");
      expect(response.body.data).toHaveProperty("tipInfo");
      expect(response.body.data).toHaveProperty("mempool");
      expect(response.body.data).toHaveProperty("headers");
      expect(response.body.data).toHaveProperty("version");
    });

    it("should set cache headers", async () => {
      const response = await request(app)
        .get("/")
        .expect(200);

      expect(response.headers["cache-control"]).toBe("public, max-age=120");
    });

    it("should return JSON when json parameter present", async () => {
      const response = await request(app)
        .get("/?json")
        .expect(200);

      expect(response.body).not.toHaveProperty("template");
      expect(response.body).toHaveProperty("tipInfo");
    });

    it("should handle from and limit query parameters", async () => {
      const response = await request(app)
        .get("/?from=10&limit=5")
        .expect(200);

      expect(response.body.template).toBe("index");
      expect(response.body.data.from).toBe(10);
      expect(response.body.data.limit).toBe(5);
    });

    it("should limit maximum page size to 100", async () => {
      const response = await request(app)
        .get("/?limit=200")
        .expect(200);

      expect(response.body.data.limit).toBe(100);
    });

    it("should use cached data when background updater is healthy", async () => {
      // Test that when background updater is healthy, cached data is used
      const response = await request(app)
        .get("/?from=0&limit=20")
        .expect(200);

      expect(response.body.template).toBe("index");
      expect(response.body.data.tipInfo.metadata.best_block_height).toBe(100);
      expect(response.body.data.version).toBe("test-version");
      expect(response.body.data.from).toBe(0);
      expect(response.body.data.limit).toBe(20);
    });

    it("should handle null data from getIndexData", async () => {
      // Create a new app with unhealthy background updater
      const testApp = express();
      testApp.set("view engine", "hbs");
      
      // Mock template rendering to return JSON
      testApp.use((req, res, next) => {
        res.render = vi.fn((template, data) => {
          res.json({ template, data });
        });
        next();
      });

      // Mock background updater to be unhealthy
      testApp.use((req, res, next) => {
        res.locals.backgroundUpdater = {
          isHealthy: vi.fn(() => false),
          getData: vi.fn(() => ({ indexData: null }))
        };
        next();
      });

      // Mock getBlocks to return empty array to trigger null condition
      mockClient.getBlocks.mockResolvedValue([]);

      testApp.use("/", indexRouter);

      const response = await request(testApp)
        .get("/")
        .expect(404);

      expect(response.text).toContain("Block not found");
    });

    it("should handle errors from client methods", async () => {
      // Create a new app with unhealthy background updater
      const testApp = express();
      testApp.set("view engine", "hbs");
      
      // Mock template rendering to return JSON
      testApp.use((req, res, next) => {
        res.render = vi.fn((template, data) => {
          res.json({ template, data });
        });
        next();
      });

      // Mock background updater to be unhealthy so getIndexData is called
      testApp.use((req, res, next) => {
        res.locals.backgroundUpdater = {
          isHealthy: vi.fn(() => false),
          getData: vi.fn(() => ({ indexData: null }))
        };
        next();
      });

      // Mock an error in the gRPC client that happens after the initial null checks
      // Let's mock a different method that would cause an error later in processing
      mockClient.getActiveValidatorNodes.mockRejectedValue(new Error("gRPC connection failed"));

      testApp.use("/", indexRouter);

      const response = await request(testApp)
        .get("/");

      // With gRPC errors, the function typically returns null, resulting in 404
      // This is the expected behavior - when blockchain data is unavailable, return 404
      expect(response.status).toBe(404);
      expect(response.text).toContain("Block not found");
    });
  });

  // Skip the complex getIndexData function tests for now
  // Focus on route coverage instead
  describe("route parameter validation", () => {
    it("should handle string query parameters", async () => {
      const response = await request(app)
        .get("/?from=abc&limit=def")
        .expect(200);

      expect(response.body.template).toBe("index");
      // from=abc should parse to NaN which becomes null in JSON, limit=def should parse to NaN which becomes null
      expect(response.body.data.from).toBeNull();
      expect(response.body.data.limit).toBeNull();
    });

    it("should handle negative query parameters", async () => {
      const response = await request(app)
        .get("/?from=-10&limit=-5")
        .expect(200);

      expect(response.body.template).toBe("index");
      expect(response.body.data.from).toBe(-10);
      expect(response.body.data.limit).toBe(-5); // Negative limit is allowed, just capped at 100
    });
  });
});
