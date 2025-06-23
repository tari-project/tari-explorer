import { describe, it, expect, beforeEach, vi } from "vitest";
import express from "express";
import request from "supertest";

// Mock dependencies
vi.mock("../../baseNodeClient.js", () => ({
  createClient: () => ({
    getHeaderByHash: vi.fn(),
    getBlocks: vi.fn(),
    getTipInfo: vi.fn(),
  }),
}));

vi.mock("../../cache.js", () => ({
  default: {
    get: vi.fn(),
  },
}));

vi.mock("../../cacheSettings.js", () => ({
  default: {
    oldBlockDeltaTip: 5040,
    oldBlocks: "public, max-age=604800",
    newBlocks: "public, max-age=120",
  },
}));

vi.mock("../../utils/stats.js", () => ({
  miningStats: vi.fn(),
}));

// Import the router after mocking
import blocksRouter from "../blocks.js";
import { createClient } from "../../baseNodeClient.js";
import cache from "../../cache.js";
import cacheSettings from "../../cacheSettings.js";
import { miningStats } from "../../utils/stats.js";

describe("blocks route", () => {
  let app: express.Application;
  let mockClient: any;
  let mockCache: any;
  let mockCacheSettings: any;
  let mockMiningStats: any;

  beforeEach(() => {
    vi.clearAllMocks();

    // Get mock instances
    mockClient = createClient();
    mockCache = cache;
    mockCacheSettings = cacheSettings;
    mockMiningStats = miningStats as any;

    app = express();
    app.set("view engine", "hbs");
    app.set("views", "./views"); // Set views directory

    // Mock the render function to catch 404 renders too
    app.use((req, res, next) => {
      const originalRender = res.render;
      res.render = vi.fn((template, data, callback) => {
        if (template === "404") {
          res.status(404).send(`Rendered: 404 with ${JSON.stringify(data)}`);
        } else {
          res
            .status(200)
            .send(`Rendered: ${template} with ${JSON.stringify(data)}`);
        }
        if (callback) callback(null, "");
      });
      next();
    });

    app.use("/blocks", blocksRouter);
  });

  describe("fromHexString function", () => {
    it("should convert hex string to number array", async () => {
      // Test indirectly through hash lookup
      const mockHash =
        "a1b2c3d4e5f6789012345678901234567890123456789012345678901234567890";
      const mockHeader = {
        header: { height: "100" },
      };
      const mockBlock = [
        {
          block: {
            header: { height: "100" },
            body: {
              outputs: [],
              inputs: [],
              kernels: [],
            },
          },
        },
      ];

      mockClient.getHeaderByHash.mockResolvedValue(mockHeader);
      mockCache.get.mockResolvedValue(mockBlock);
      mockClient.getTipInfo.mockResolvedValue({
        metadata: { best_block_height: "1000" },
      });
      mockMiningStats.mockReturnValue({
        totalCoinbaseXtm: 0,
        numCoinbases: 0,
        numOutputsNoCoinbases: 0,
        numInputs: 0,
      });

      const response = await request(app)
        .get(`/blocks/${mockHash}`)
        .expect(200);

      expect(mockClient.getHeaderByHash).toHaveBeenCalledWith({
        hash: expect.any(Array),
      });
    });
  });

  describe("GET /:height_or_hash", () => {
    const mockBlock = [
      {
        block: {
          header: {
            height: "100",
            nonce: "12345",
            timestamp: { seconds: "1672574340" },
          },
          body: {
            outputs: [
              { commitment: "output1", features: { output_type: 0 } },
              { commitment: "output2", features: { output_type: 1 } },
            ],
            inputs: [{ commitment: "input1" }],
            kernels: [{ excess_sig: "kernel1", fee: "100" }],
          },
        },
      },
    ];

    const mockTipInfo = {
      metadata: { best_block_height: "1000" },
    };

    const mockStats = {
      totalCoinbaseXtm: 2500000000,
      numCoinbases: 1,
      numOutputsNoCoinbases: 1,
      numInputs: 1,
    };

    beforeEach(() => {
      mockCache.get.mockResolvedValue(mockBlock);
      mockClient.getTipInfo.mockResolvedValue(mockTipInfo);
      mockMiningStats.mockReturnValue(mockStats);
    });

    it("should return block by height", async () => {
      const height = 100;

      const response = await request(app).get(`/blocks/${height}`).expect(200);

      expect(mockCache.get).toHaveBeenCalledWith(mockClient.getBlocks, {
        heights: [height],
      });
      expect(mockMiningStats).toHaveBeenCalledWith(mockBlock);
      expect(response.text).toContain("Rendered: blocks");
    });

    it("should return block by hash", async () => {
      const mockHash =
        "a1b2c3d4e5f6789012345678901234567890123456789012345678901234567890";
      const mockHeader = {
        header: { height: "100" },
      };

      mockClient.getHeaderByHash.mockResolvedValue(mockHeader);

      const response = await request(app)
        .get(`/blocks/${mockHash}`)
        .expect(200);

      expect(mockClient.getHeaderByHash).toHaveBeenCalledWith({
        hash: expect.any(Array),
      });
      expect(mockCache.get).toHaveBeenCalledWith(mockClient.getBlocks, {
        heights: [100],
      });
      expect(response.text).toContain("Rendered: blocks");
    });

    it("should return 404 for block hash not found", async () => {
      const mockHash =
        "a1b2c3d4e5f6789012345678901234567890123456789012345678901234567890";

      mockClient.getHeaderByHash.mockResolvedValue(null);

      const response = await request(app)
        .get(`/blocks/${mockHash}`)
        .expect(404);

      expect(response.text).toContain("Rendered: 404");
      expect(response.text).toContain(`Block with hash ${mockHash} not found`);
    });

    it("should return 404 for block height not found", async () => {
      const height = 999999;

      mockCache.get.mockResolvedValue(null);

      const response = await request(app).get(`/blocks/${height}`).expect(404);

      expect(response.text).toContain("Rendered: 404");
      expect(response.text).toContain(`Block at height ${height} not found`);
    });

    it("should return 404 for empty block array", async () => {
      const height = 100;

      mockCache.get.mockResolvedValue([]);

      const response = await request(app).get(`/blocks/${height}`).expect(404);

      expect(response.text).toContain("Rendered: 404");
      expect(response.text).toContain(`Block at height ${height} not found`);
    });

    it("should return JSON when json query parameter is present", async () => {
      const height = 100;

      const response = await request(app)
        .get(`/blocks/${height}?json`)
        .expect(200);

      expect(response.body).toHaveProperty("title", "Block at height: 100");
      expect(response.body).toHaveProperty("header");
      expect(response.body).toHaveProperty("height", 100);
      expect(response.body).toHaveProperty("body");
      expect(response.body).toHaveProperty("pows");
    });

    it("should handle pagination parameters for outputs", async () => {
      const height = 100;
      const outputs_from = 5;
      const outputs_to = 15;

      await request(app)
        .get(
          `/blocks/${height}?outputs_from=${outputs_from}&outputs_to=${outputs_to}`,
        )
        .expect(200);

      expect(mockCache.get).toHaveBeenCalledWith(mockClient.getBlocks, {
        heights: [height],
      });
    });

    it("should handle pagination parameters for inputs", async () => {
      const height = 100;
      const inputs_from = 2;
      const inputs_to = 12;

      await request(app)
        .get(
          `/blocks/${height}?inputs_from=${inputs_from}&inputs_to=${inputs_to}`,
        )
        .expect(200);

      expect(mockCache.get).toHaveBeenCalledWith(mockClient.getBlocks, {
        heights: [height],
      });
    });

    it("should handle pagination parameters for kernels", async () => {
      const height = 100;
      const kernels_from = 1;
      const kernels_to = 11;

      await request(app)
        .get(
          `/blocks/${height}?kernels_from=${kernels_from}&kernels_to=${kernels_to}`,
        )
        .expect(200);

      expect(mockCache.get).toHaveBeenCalledWith(mockClient.getBlocks, {
        heights: [height],
      });
    });

    it("should generate pagination links for outputs", async () => {
      const largeOutputsBlock = [
        {
          block: {
            header: { height: "100" },
            body: {
              outputs: new Array(25).fill({
                commitment: "output",
                features: { output_type: 0 },
              }),
              inputs: [],
              kernels: [],
            },
          },
        },
      ];

      mockCache.get.mockResolvedValue(largeOutputsBlock);

      const response = await request(app)
        .get("/blocks/100?outputs_from=10&outputs_to=20&json")
        .expect(200);

      expect(response.body.body).toHaveProperty("outputsPrev");
      expect(response.body.body).toHaveProperty("outputsNext");
      expect(response.body.body).toHaveProperty("outputsPrevLink");
      expect(response.body.body).toHaveProperty("outputsNextLink");
    });

    it("should generate pagination links for inputs", async () => {
      const largeInputsBlock = [
        {
          block: {
            header: { height: "100" },
            body: {
              outputs: [],
              inputs: new Array(25).fill({ commitment: "input" }),
              kernels: [],
            },
          },
        },
      ];

      mockCache.get.mockResolvedValue(largeInputsBlock);

      const response = await request(app)
        .get("/blocks/100?inputs_from=10&inputs_to=20&json")
        .expect(200);

      expect(response.body.body).toHaveProperty("inputsPrev");
      expect(response.body.body).toHaveProperty("inputsNext");
      expect(response.body.body).toHaveProperty("inputsPrevLink");
      expect(response.body.body).toHaveProperty("inputsNextLink");
    });

    it("should generate pagination links for kernels", async () => {
      const largeKernelsBlock = [
        {
          block: {
            header: { height: "100" },
            body: {
              outputs: [],
              inputs: [],
              kernels: new Array(25).fill({ excess_sig: "kernel", fee: "100" }),
            },
          },
        },
      ];

      mockCache.get.mockResolvedValue(largeKernelsBlock);

      const response = await request(app)
        .get("/blocks/100?kernels_from=10&kernels_to=20&json")
        .expect(200);

      expect(response.body.body).toHaveProperty("kernelsPrev");
      expect(response.body.body).toHaveProperty("kernelsNext");
      expect(response.body.body).toHaveProperty("kernelsPrevLink");
      expect(response.body.body).toHaveProperty("kernelsNextLink");
    });

    it("should set old block cache headers for old blocks", async () => {
      const height = 100;
      const oldTipInfo = {
        metadata: { best_block_height: "10000" }, // Makes block old
      };

      mockClient.getTipInfo.mockResolvedValue(oldTipInfo);

      const response = await request(app).get(`/blocks/${height}`).expect(200);

      expect(response.headers["cache-control"]).toBe(
        mockCacheSettings.oldBlocks,
      );
    });

    it("should set new block cache headers for recent blocks", async () => {
      const height = 100;
      const recentTipInfo = {
        metadata: { best_block_height: "105" }, // Makes block recent
      };

      mockClient.getTipInfo.mockResolvedValue(recentTipInfo);

      const response = await request(app).get(`/blocks/${height}`).expect(200);

      expect(response.headers["cache-control"]).toBe(
        mockCacheSettings.newBlocks,
      );
    });

    it("should generate correct prev/next links", async () => {
      const height = 100;

      const response = await request(app)
        .get(`/blocks/${height}?json`)
        .expect(200);

      expect(response.body.prevLink).toBe("/blocks/99");
      expect(response.body.nextLink).toBe("/blocks/101");
      expect(response.body.prevHeight).toBe(99);
      expect(response.body.nextHeight).toBe(101);
    });

    it("should not show prev link for genesis block", async () => {
      const height = 0;

      const response = await request(app)
        .get(`/blocks/${height}?json`)
        .expect(200);

      expect(response.body.prevLink).toBe(null);
      expect(response.body.nextLink).toBe("/blocks/1");
    });

    it("should not show next link for tip block", async () => {
      const height = 1000; // Same as tip height in mock

      const response = await request(app)
        .get(`/blocks/${height}?json`)
        .expect(200);

      expect(response.body.prevLink).toBe("/blocks/999");
      expect(response.body.nextLink).toBe(null);
    });

    it("should include mining statistics in response", async () => {
      const height = 100;

      const response = await request(app)
        .get(`/blocks/${height}?json`)
        .expect(200);

      expect(response.body).toHaveProperty(
        "totalCoinbaseXtm",
        mockStats.totalCoinbaseXtm,
      );
      expect(response.body).toHaveProperty(
        "numCoinbases",
        mockStats.numCoinbases,
      );
      expect(response.body).toHaveProperty(
        "numOutputsNoCoinbases",
        mockStats.numOutputsNoCoinbases,
      );
      expect(response.body).toHaveProperty("numInputs", mockStats.numInputs);
    });

    it("should include PoW algorithm mappings", async () => {
      const height = 100;

      const response = await request(app)
        .get(`/blocks/${height}?json`)
        .expect(200);

      expect(response.body.pows).toEqual({
        0: "Monero RandomX",
        1: "SHA-3X",
        2: "Tari RandomX",
      });
    });

    it("should handle all pagination parameters together", async () => {
      const height = 100;
      const params = "?outputs_from=5&outputs_to=15&inputs_from=2&inputs_to=12&kernels_from=1&kernels_to=11";
      
      const mockBlock = [{
        block: {
          header: { height: '100' },
          body: { 
            outputs: new Array(25).fill({ commitment: 'output' }),
            inputs: new Array(15).fill({ commitment: 'input' }),
            kernels: new Array(20).fill({ excess_sig: 'kernel' })
          }
        }
      }];
      const mockTipInfo = { metadata: { best_block_height: '1000' } };
      const mockStats = { totalCoinbaseXtm: 0, numCoinbases: 0, numOutputsNoCoinbases: 0, numInputs: 0 };

      mockCache.get.mockResolvedValue(mockBlock);
      mockClient.getTipInfo.mockResolvedValue(mockTipInfo);
      mockMiningStats.mockReturnValue(mockStats);

      const response = await request(app)
        .get(`/blocks/${height}${params}&json`)
        .expect(200);

      expect(response.body.body.outputsFrom).toBe(5);
      expect(response.body.body.inputsFrom).toBe(2);
      expect(response.body.body.kernelsFrom).toBe(1);
    });
  });
});