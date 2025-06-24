import { describe, it, expect, beforeEach, vi } from "vitest";
import express from "express";
import request from "supertest";

// Mock BEFORE imports - this is critical for ESM
vi.mock("../../baseNodeClient.js", () => ({
  createClient: vi.fn(() => ({
    getBlocks: vi.fn().mockResolvedValue([]),
    getHeaderByHash: vi.fn().mockResolvedValue({
      header: { height: "100" }
    }),
    getTipInfo: vi.fn().mockResolvedValue({
      metadata: { best_block_height: "1000" }
    })
  })),
}));

vi.mock("../../cache.js", () => ({
  default: {
    get: vi.fn().mockImplementation((fn, request) => {
      // Always return the mock block data for successful cases
      return Promise.resolve([
        {
          block: {
            header: { height: request.heights[0].toString() },
            body: {
              outputs: Array(15).fill({ output: "mock" }),
              inputs: Array(8).fill({ input: "mock" }),
              kernels: Array(5).fill({ kernel: "mock" })
            }
          }
        }
      ]);
    })
  }
}));

vi.mock("../../cacheSettings.js", () => ({
  default: {
    newBlocks: "public, max-age=120",
    oldBlocks: "public, max-age=604800",
    oldBlockDeltaTip: 5040
  },
}));

vi.mock("../../utils/stats.js", () => ({
  miningStats: vi.fn().mockReturnValue({
    totalCoinbaseXtm: 10000000,
    numCoinbases: 1,
    numOutputsNoCoinbases: 14,
    numInputs: 8
  })
}));

import blocksRouter from "../blocks.js";
import { createClient } from "../../baseNodeClient.js";

describe("blocks route (working)", () => {
  let app: express.Application;
  let mockClient: any;
  let mockCache: any;

  beforeEach(async () => {
    vi.clearAllMocks();
    
    // Get references to mocked modules
    mockClient = createClient();
    const cacheModule = await import("../../cache.js");
    mockCache = cacheModule.default;

    // Set up default mock responses
    mockClient.getBlocks.mockResolvedValue([]);
    mockClient.getHeaderByHash.mockResolvedValue({
      header: { height: "100" }
    });
    mockClient.getTipInfo.mockResolvedValue({
      metadata: { best_block_height: "1000" }
    });

    mockCache.get.mockImplementation((fn, request) => {
      return Promise.resolve([
        {
          block: {
            header: { height: request.heights[0].toString() },
            body: {
              outputs: Array(15).fill({ output: "mock" }),
              inputs: Array(8).fill({ input: "mock" }),
              kernels: Array(5).fill({ kernel: "mock" })
            }
          }
        }
      ]);
    });

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

    app.use("/blocks", blocksRouter);
  });

  describe("GET /:height_or_hash - by height", () => {
    it("should return block details for valid height", async () => {
      const response = await request(app)
        .get("/blocks/100")
        .expect(200);

      expect(response.body.template).toBe("blocks");
      expect(response.body.data).toHaveProperty("height", 100);
      expect(response.body.data).toHaveProperty("header");
      expect(response.body.data).toHaveProperty("body");
      expect(response.body.data.body).toHaveProperty("outputs_length", 15);
      expect(response.body.data.body).toHaveProperty("inputs_length", 8);
      expect(response.body.data.body).toHaveProperty("kernels_length", 5);
    });

    it("should set cache headers for blocks", async () => {
      const response = await request(app)
        .get("/blocks/100")
        .expect(200);

      // Should have cache control header (either new or old)
      expect(response.headers["cache-control"]).toMatch(/public, max-age=\d+/);
    });

    it("should set new block cache headers for recent blocks", async () => {
      const response = await request(app)
        .get("/blocks/999")
        .expect(200);

      expect(response.headers["cache-control"]).toBe("public, max-age=120");
    });

    it("should return JSON when json parameter present", async () => {
      const response = await request(app)
        .get("/blocks/100?json")
        .expect(200);

      expect(response.body).toHaveProperty("height", 100);
      expect(response.body).toHaveProperty("header");
      expect(response.body).toHaveProperty("body");
      expect(response.body).not.toHaveProperty("template");
    });

    it("should handle pagination parameters for outputs", async () => {
      const response = await request(app)
        .get("/blocks/100?outputs_from=5&outputs_to=15")
        .expect(200);

      expect(response.body.data.body).toHaveProperty("outputsFrom", 5);
      expect(response.body.data.body.outputs).toHaveLength(10);
    });

    it("should generate pagination links for outputs", async () => {
      const response = await request(app)
        .get("/blocks/100?outputs_from=10&outputs_to=20")
        .expect(200);

      expect(response.body.data.body).toHaveProperty("outputsPrev", "0..9");
      expect(response.body.data.body).toHaveProperty("outputsPrevLink");
      expect(response.body.data.body.outputsPrevLink).toContain("outputs_from=0");
    });

    it("should generate next/prev block navigation", async () => {
      const response = await request(app)
        .get("/blocks/100")
        .expect(200);

      expect(response.body.data).toHaveProperty("prevLink", "/blocks/99");
      expect(response.body.data).toHaveProperty("nextLink", "/blocks/101");
      expect(response.body.data).toHaveProperty("prevHeight", 99);
      expect(response.body.data).toHaveProperty("nextHeight", 101);
    });

    it("should not have prev link for genesis block", async () => {
      const response = await request(app)
        .get("/blocks/0")
        .expect(200);

      expect(response.body.data).toHaveProperty("prevLink", null);
    });
  });

  describe("GET /:height_or_hash - by hash", () => {
    it("should handle 64-character hash format", async () => {
      const hash = "a1b2c3d4e5f6789012345678901234567890123456789012345678901234567890";
      
      const response = await request(app)
        .get(`/blocks/${hash}`)
        .expect((res) => {
          // Should either return 200 with block data or 404 if not found
          expect([200, 404]).toContain(res.status);
        });

      // If successful, should have proper template
      if (response.status === 200) {
        expect(response.body.template).toBe("blocks");
      } else {
        expect(response.body.template).toBe("404");
      }
    });

    it("should handle invalid hash format", async () => {
      const response = await request(app)
        .get("/blocks/invalid_hash")
        .expect((res) => {
          // Should either return 200 as height or 404
          expect([200, 404]).toContain(res.status);
        });
    });
  });

  describe("GET /:height_or_hash - error cases", () => {
    it("should return 404 for non-existent block height", async () => {
      // Mock cache to return empty array for non-existent block
      mockCache.get.mockResolvedValue([]);

      const response = await request(app)
        .get("/blocks/999999")
        .expect(404);

      expect(response.body.template).toBe("404");
      expect(response.body.data.message).toContain("Block at height 999999 not found");
    });

    it("should handle mining stats calculation", async () => {
      const response = await request(app)
        .get("/blocks/100")
        .expect(200);

      expect(response.body.data).toHaveProperty("totalCoinbaseXtm", 10000000);
      expect(response.body.data).toHaveProperty("numCoinbases", 1);
      expect(response.body.data).toHaveProperty("numOutputsNoCoinbases", 14);
      expect(response.body.data).toHaveProperty("numInputs", 8);
    });

    it("should include PoW algorithm mapping", async () => {
      const response = await request(app)
        .get("/blocks/100")
        .expect(200);

      expect(response.body.data).toHaveProperty("pows");
      expect(response.body.data.pows).toEqual({
        0: "Monero RandomX",
        1: "SHA-3X", 
        2: "Tari RandomX"
      });
    });
  });

  describe("Pagination edge cases", () => {
    it("should handle inputs pagination", async () => {
      const response = await request(app)
        .get("/blocks/100?inputs_from=0&inputs_to=5")
        .expect(200);

      expect(response.body.data.body).toHaveProperty("inputsFrom", 0);
      expect(response.body.data.body.inputs).toHaveLength(5);
    });

    it("should handle kernels pagination", async () => {
      const response = await request(app)
        .get("/blocks/100?kernels_from=0&kernels_to=3")
        .expect(200);

      expect(response.body.data.body).toHaveProperty("kernelsFrom", 0);
      expect(response.body.data.body.kernels).toHaveLength(3);
    });

    it("should generate pagination links with all parameters", async () => {
      const response = await request(app)
        .get("/blocks/100?outputs_from=10&outputs_to=20&inputs_from=5&inputs_to=15&kernels_from=2&kernels_to=12")
        .expect(200);

      const outputsPrevLink = response.body.data.body.outputsPrevLink;
      expect(outputsPrevLink).toContain("outputs_from=0");
      expect(outputsPrevLink).toContain("inputs_from=5");
      expect(outputsPrevLink).toContain("kernels_from=2");
    });
  });
});
