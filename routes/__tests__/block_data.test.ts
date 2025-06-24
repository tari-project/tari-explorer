import { describe, it, expect, beforeEach, vi } from "vitest";
import express from "express";
import request from "supertest";

// Mock BEFORE imports - this is critical for ESM
const mockClient = {
  getHeaderByHash: vi.fn(),
  getBlocks: vi.fn(),
  getTipInfo: vi.fn().mockResolvedValue({
    metadata: {
      best_block_height: "1000"
    }
  })
};

vi.mock("../../baseNodeClient.js", () => ({
  createClient: vi.fn(() => mockClient),
}));

vi.mock("../../cache.js", () => ({
  default: {
    get: vi.fn()
  }
}));

vi.mock("../../cacheSettings.js", () => ({
  default: {
    oldBlocks: "public, max-age=604800",
    newBlocks: "public, max-age=120",
    oldBlockDeltaTip: 5040
  },
}));

import blockDataRouter from "../block_data.js";
import { createClient } from "../../baseNodeClient.js";
import cache from "../../cache.js";

describe("block_data route", () => {
  let app: express.Application;
  let mockCache: any;

  beforeEach(async () => {
    vi.clearAllMocks();
    
    // Get references to mocked modules
    mockCache = cache;

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

    app.use("/block_data", blockDataRouter);
  });

  describe("GET /:height_or_hash", () => {
    it("should return block data for height", async () => {
      const mockBlockData = [{
        block: {
          body: {
            outputs: [
              { commitment: "abcd1234", features: { output_type: 0 } },
              { commitment: "efgh5678", features: { output_type: 1 } }
            ],
            inputs: [
              { commitment: "input1", features: { version: 0 } }
            ],
            kernels: [
              { commitment: "kernel1", fee: "100" }
            ]
          }
        }
      }];

      mockCache.get.mockResolvedValue(mockBlockData);

      const response = await request(app)
        .get("/block_data/500?what=outputs&from=0&to=10")
        .expect(200);

      expect(response.body.height).toBe(500);
      expect(response.body.body.length).toBe(2);
      expect(response.body.body.data).toHaveLength(2);
      expect(mockCache.get).toHaveBeenCalledWith(
        expect.any(Function),
        { heights: [500] }
      );
    });

    it("should return block data for 64-character hash", async () => {
      const mockHash = "a".repeat(64);
      const mockHeader = {
        header: {
          height: "750"
        }
      };
      const mockBlockData = [{
        block: {
          body: {
            outputs: [{ commitment: "test1" }],
            inputs: [{ commitment: "test2" }],
            kernels: [{ commitment: "test3" }]
          }
        }
      }];

      mockClient.getHeaderByHash.mockResolvedValue(mockHeader);
      mockCache.get.mockResolvedValue(mockBlockData);

      const response = await request(app)
        .get(`/block_data/${mockHash}?what=outputs&from=0&to=5`)
        .expect(200);

      expect(response.body.height).toBe(750);
      expect(response.body.body.length).toBe(1);
      expect(mockClient.getHeaderByHash).toHaveBeenCalledWith({
        hash: expect.any(Array)
      });
      expect(mockCache.get).toHaveBeenCalledWith(
        expect.any(Function),
        { heights: [750] }
      );
    });

    it("should slice data correctly with from/to parameters", async () => {
      const mockBlockData = [{
        block: {
          body: {
            outputs: Array.from({ length: 20 }, (_, i) => ({ 
              commitment: `output${i}` 
            }))
          }
        }
      }];

      mockCache.get.mockResolvedValue(mockBlockData);

      const response = await request(app)
        .get("/block_data/500?what=outputs&from=5&to=10")
        .expect(200);

      expect(response.body.body.length).toBe(20);
      expect(response.body.body.data).toHaveLength(5);
      expect(response.body.body.data[0].commitment).toBe("output5");
      expect(response.body.body.data[4].commitment).toBe("output9");
    });

    it("should handle inputs data type", async () => {
      const mockBlockData = [{
        block: {
          body: {
            inputs: [
              { commitment: "input1", features: { version: 0 } },
              { commitment: "input2", features: { version: 1 } }
            ]
          }
        }
      }];

      mockCache.get.mockResolvedValue(mockBlockData);

      const response = await request(app)
        .get("/block_data/500?what=inputs&from=0&to=10")
        .expect(200);

      expect(response.body.body.length).toBe(2);
      expect(response.body.body.data[0].commitment).toBe("input1");
      expect(response.body.body.data[1].commitment).toBe("input2");
    });

    it("should handle kernels data type", async () => {
      const mockBlockData = [{
        block: {
          body: {
            kernels: [
              { commitment: "kernel1", fee: "100" },
              { commitment: "kernel2", fee: "200" }
            ]
          }
        }
      }];

      mockCache.get.mockResolvedValue(mockBlockData);

      const response = await request(app)
        .get("/block_data/500?what=kernels&from=0&to=10")
        .expect(200);

      expect(response.body.body.length).toBe(2);
      expect(response.body.body.data[0].commitment).toBe("kernel1");
      expect(response.body.body.data[1].commitment).toBe("kernel2");
    });

    it("should set cache headers for old blocks", async () => {
      // Mock tip info for a higher block height to ensure old block condition
      mockClient.getTipInfo.mockResolvedValue({
        metadata: {
          best_block_height: "10000"
        }
      });

      const mockBlockData = [{
        block: {
          body: {
            outputs: [{ commitment: "test" }]
          }
        }
      }];

      mockCache.get.mockResolvedValue(mockBlockData);

      const response = await request(app)
        .get("/block_data/1?what=outputs&from=0&to=10")
        .expect(200);

      // Block 1 is old (1 + 5040 = 5041 <= 10000), should get old block cache
      expect(response.headers["cache-control"]).toBe("public, max-age=604800");
    });

    it("should set cache headers for new blocks", async () => {
      // Reset mock to default tip height for this test
      mockClient.getTipInfo.mockResolvedValue({
        metadata: {
          best_block_height: "1000"
        }
      });

      const mockBlockData = [{
        block: {
          body: {
            outputs: [{ commitment: "test" }]
          }
        }
      }];

      mockCache.get.mockResolvedValue(mockBlockData);

      const response = await request(app)
        .get("/block_data/999?what=outputs&from=0&to=10")
        .expect(200);

      // Block 999 is new (999 + 5040 = 6039 > 1000), should get new block cache
      expect(response.headers["cache-control"]).toBe("public, max-age=120");
    });

    it("should return 404 for missing what parameter", async () => {
      const response = await request(app)
        .get("/block_data/500")
        .expect(404);

      expect(response.body.template).toBe("404");
      expect(response.body.data.message).toBe("Invalid request");
    });

    it("should return 404 for non-existent hash", async () => {
      const mockHash = "b".repeat(64);
      mockClient.getHeaderByHash.mockResolvedValue(null);

      const response = await request(app)
        .get(`/block_data/${mockHash}?what=outputs`)
        .expect(404);

      expect(response.body.template).toBe("404");
      expect(response.body.data.message).toBe(`Block with hash ${mockHash} not found`);
    });

    it("should return 404 for non-existent height", async () => {
      mockCache.get.mockResolvedValue([]);

      const response = await request(app)
        .get("/block_data/9999?what=outputs")
        .expect(404);

      expect(response.body.template).toBe("404");
      expect(response.body.data.message).toBe("Block at height 9999 not found");
    });

    it("should return 404 for null block result", async () => {
      mockCache.get.mockResolvedValue(null);

      const response = await request(app)
        .get("/block_data/500?what=outputs")
        .expect(404);

      expect(response.body.template).toBe("404");
      expect(response.body.data.message).toBe("Block at height 500 not found");
    });

    it("should use default from/to values when not provided", async () => {
      const mockBlockData = [{
        block: {
          body: {
            outputs: Array.from({ length: 15 }, (_, i) => ({ 
              commitment: `output${i}` 
            }))
          }
        }
      }];

      mockCache.get.mockResolvedValue(mockBlockData);

      const response = await request(app)
        .get("/block_data/500?what=outputs")
        .expect(200);

      // Default should be from=0, to=10
      expect(response.body.body.length).toBe(15);
      expect(response.body.body.data).toHaveLength(10);
      expect(response.body.body.data[0].commitment).toBe("output0");
      expect(response.body.body.data[9].commitment).toBe("output9");
    });

    it("should convert hex string to number array correctly", async () => {
      const mockHash = "deadbeef" + "a".repeat(56);
      const mockHeader = {
        header: {
          height: "123"
        }
      };
      const mockBlockData = [{
        block: {
          body: {
            outputs: [{ commitment: "test" }]
          }
        }
      }];

      mockClient.getHeaderByHash.mockResolvedValue(mockHeader);
      mockCache.get.mockResolvedValue(mockBlockData);

      const response = await request(app)
        .get(`/block_data/${mockHash}?what=outputs`)
        .expect(200);

      expect(response.body.height).toBe(123);
      // Check that fromHexString converted properly
      expect(mockClient.getHeaderByHash).toHaveBeenCalledWith({
        hash: expect.arrayContaining([0xde, 0xad, 0xbe, 0xef])
      });
    });

    it("should handle empty block body arrays", async () => {
      const mockBlockData = [{
        block: {
          body: {
            outputs: []
          }
        }
      }];

      mockCache.get.mockResolvedValue(mockBlockData);

      const response = await request(app)
        .get("/block_data/500?what=outputs&from=0&to=10")
        .expect(200);

      expect(response.body.body.length).toBe(0);
      expect(response.body.body.data).toHaveLength(0);
    });

    it("should handle large from/to values gracefully", async () => {
      const mockBlockData = [{
        block: {
          body: {
            outputs: [
              { commitment: "output1" },
              { commitment: "output2" }
            ]
          }
        }
      }];

      mockCache.get.mockResolvedValue(mockBlockData);

      const response = await request(app)
        .get("/block_data/500?what=outputs&from=5&to=100")
        .expect(200);

      expect(response.body.body.length).toBe(2);
      expect(response.body.body.data).toHaveLength(0); // slice(5,100) of 2-item array
    });
  });
});
