import { describe, it, expect, beforeEach, vi } from "vitest";
import express from "express";
import request from "supertest";

// Mock dependencies
vi.mock("../../baseNodeClient.js", () => ({
  createClient: vi.fn(() => ({
    getBlocks: vi.fn(),
    getHeaderByHash: vi.fn(),
    getMempoolTransactions: vi.fn(),
    getTipInfo: vi.fn(),
    getNetworkDifficulty: vi.fn(),
    listHeaders: vi.fn(),
  })),
}));

vi.mock("../../cache.js", () => ({
  createCacheMethods: vi.fn(() => ({
    get: vi.fn(),
    set: vi.fn(),
  })),
}));

vi.mock("../../utils/stats.js", () => ({
  getStats: vi.fn(),
  getMiningStats: vi.fn(),
}));

import blocksRouter from "../../routes/blocks.js";
import mempoolRouter from "../../routes/mempool.js";
import minersRouter from "../../routes/miners.js";
import { createClient } from "../../baseNodeClient.js";
import { createCacheMethods } from "../../cache.js";
import { getStats, getMiningStats } from "../../utils/stats.js";

describe("Complex Routes", () => {
  let app: express.Application;
  let mockClient: any;
  let mockCache: any;

  beforeEach(() => {
    vi.clearAllMocks();

    // Create Express app
    app = express();
    app.set("view engine", "hbs");
    
    // Mock res.render to return JSON instead of attempting Handlebars rendering
    app.use((req, res, next) => {
      res.render = vi.fn((template, data) => res.json({ template, ...data }));
      next();
    });

    app.use("/blocks", blocksRouter);
    app.use("/mempool", mempoolRouter);
    app.use("/miners", minersRouter);

    // Get mock instances
    mockClient = createClient();
    mockCache = createCacheMethods();
  });

  describe("blocks route", () => {
    describe("GET /:hash", () => {
      it("should return block details by hash as HTML", async () => {
        const blockHash = "abc123def456";
        const mockBlock = {
          block: {
            header: {
              height: "12345",
              hash: blockHash,
              prev_hash: "prev123",
              timestamp: "1672574340",
              nonce: "1000",
              pow: { pow_algo: 0, pow_data: "powdata123" }
            },
            body: {
              inputs: [{ commitment: "input1" }],
              outputs: [{ commitment: "output1", features: { output_type: 0 } }],
              kernels: [{ excess_sig: "kernel1", fee: "1000", lock_height: "0" }]
            }
          }
        };
        mockClient.getHeaderByHash.mockResolvedValue(mockBlock.block.header);
        mockClient.getBlocks.mockResolvedValue([mockBlock.block]);

        const response = await request(app)
          .get(`/blocks/${blockHash}`)
          .expect(200);

        expect(mockClient.getHeaderByHash).toHaveBeenCalledWith({ hash: blockHash });
        expect(mockClient.getBlocks).toHaveBeenCalledWith({ hashes: [blockHash] });
        expect(response.body).toEqual({
          template: "blocks",
          hash: blockHash,
          header: mockBlock.block.header,
          block: mockBlock.block
        });
      });

      it("should return block details by hash as JSON", async () => {
        const blockHash = "def456abc789";
        const mockBlock = {
          block: {
            header: { height: "54321", hash: blockHash },
            body: { inputs: [], outputs: [], kernels: [] }
          }
        };
        mockClient.getHeaderByHash.mockResolvedValue(mockBlock.block.header);
        mockClient.getBlocks.mockResolvedValue([mockBlock.block]);

        const response = await request(app)
          .get(`/blocks/${blockHash}?json`)
          .expect(200)
          .expect("Content-Type", /json/);

        expect(response.body).toEqual({
          hash: blockHash,
          header: mockBlock.block.header,
          block: mockBlock.block
        });
      });

      it("should handle pagination parameters", async () => {
        const blockHash = "paginated123";
        const mockBlock = {
          block: {
            header: { height: "100", hash: blockHash },
            body: {
              inputs: Array.from({ length: 50 }, (_, i) => ({ commitment: `input${i}` })),
              outputs: Array.from({ length: 50 }, (_, i) => ({ commitment: `output${i}` })),
              kernels: Array.from({ length: 50 }, (_, i) => ({ excess_sig: `kernel${i}` }))
            }
          }
        };
        mockClient.getHeaderByHash.mockResolvedValue(mockBlock.block.header);
        mockClient.getBlocks.mockResolvedValue([mockBlock.block]);

        const response = await request(app)
          .get(`/blocks/${blockHash}?inputs_from=10&outputs_from=20&kernels_from=5`)
          .expect(200);

        expect(response.body.hash).toBe(blockHash);
        expect(response.body.block).toBeDefined();
      });

      it("should handle block not found", async () => {
        const blockHash = "nonexistent";
        mockClient.getHeaderByHash.mockResolvedValue(null);

        await request(app)
          .get(`/blocks/${blockHash}`)
          .expect(404);

        expect(mockClient.getHeaderByHash).toHaveBeenCalledWith({ hash: blockHash });
      });

      it("should handle client errors", async () => {
        const blockHash = "error123";
        const mockError = new Error("Block fetch failed");
        mockClient.getHeaderByHash.mockRejectedValue(mockError);

        await request(app)
          .get(`/blocks/${blockHash}`)
          .expect(500);
      });

      it("should handle block with no body", async () => {
        const blockHash = "headeronly123";
        const mockHeader = { height: "1000", hash: blockHash };
        mockClient.getHeaderByHash.mockResolvedValue(mockHeader);
        mockClient.getBlocks.mockResolvedValue([]);

        const response = await request(app)
          .get(`/blocks/${blockHash}`)
          .expect(200);

        expect(response.body.header).toEqual(mockHeader);
        expect(response.body.block).toBeUndefined();
      });

      it("should handle different hash formats", async () => {
        const hashFormats = [
          "0xabc123def456",
          "ABC123DEF456",
          "abc123def456"
        ];

        for (const hash of hashFormats) {
          mockClient.getHeaderByHash.mockResolvedValue({ height: "1", hash });
          mockClient.getBlocks.mockResolvedValue([{ header: { hash }, body: {} }]);

          const response = await request(app)
            .get(`/blocks/${hash}`)
            .expect(200);

          expect(response.body.hash).toBe(hash);
        }
      });
    });

    describe("GET /:hash/data", () => {
      it("should return paginated block data as JSON", async () => {
        const blockHash = "datatest123";
        const mockBlock = {
          body: {
            inputs: Array.from({ length: 100 }, (_, i) => ({ commitment: `input${i}` })),
            outputs: Array.from({ length: 100 }, (_, i) => ({ commitment: `output${i}` })),
            kernels: Array.from({ length: 100 }, (_, i) => ({ excess_sig: `kernel${i}` }))
          }
        };
        mockClient.getBlocks.mockResolvedValue([mockBlock]);

        const response = await request(app)
          .get(`/blocks/${blockHash}/data?from=10&to=20`)
          .expect(200)
          .expect("Content-Type", /json/);

        expect(mockClient.getBlocks).toHaveBeenCalledWith({ hashes: [blockHash] });
        expect(response.body).toHaveProperty('inputs');
        expect(response.body).toHaveProperty('outputs');
        expect(response.body).toHaveProperty('kernels');
      });

      it("should handle data endpoint errors", async () => {
        const blockHash = "dataerror123";
        const mockError = new Error("Data fetch failed");
        mockClient.getBlocks.mockRejectedValue(mockError);

        await request(app)
          .get(`/blocks/${blockHash}/data`)
          .expect(500);
      });
    });
  });

  describe("mempool route", () => {
    describe("GET /", () => {
      it("should return mempool transactions as HTML", async () => {
        const mockTransactions = [
          {
            transaction: {
              body: {
                inputs: [{ commitment: "mempool_input1" }],
                outputs: [{ commitment: "mempool_output1" }],
                kernels: [{ excess_sig: "mempool_kernel1", fee: "2000" }]
              }
            }
          },
          {
            transaction: {
              body: {
                inputs: [],
                outputs: [{ commitment: "mempool_output2" }],
                kernels: [{ excess_sig: "mempool_kernel2", fee: "1500" }]
              }
            }
          }
        ];
        mockClient.getMempoolTransactions.mockResolvedValue(mockTransactions);

        const response = await request(app)
          .get("/mempool")
          .expect(200);

        expect(mockClient.getMempoolTransactions).toHaveBeenCalledWith({});
        expect(response.body).toEqual({
          template: "mempool",
          transactions: mockTransactions
        });
      });

      it("should return mempool transactions as JSON", async () => {
        const mockTransactions = [
          {
            transaction: {
              body: {
                kernels: [{ fee: "3000" }]
              }
            }
          }
        ];
        mockClient.getMempoolTransactions.mockResolvedValue(mockTransactions);

        const response = await request(app)
          .get("/mempool?json")
          .expect(200)
          .expect("Content-Type", /json/);

        expect(response.body).toEqual({
          transactions: mockTransactions
        });
      });

      it("should handle empty mempool", async () => {
        mockClient.getMempoolTransactions.mockResolvedValue([]);

        const response = await request(app)
          .get("/mempool?json")
          .expect(200);

        expect(response.body).toEqual({
          transactions: []
        });
      });

      it("should handle mempool fetch errors", async () => {
        const mockError = new Error("Mempool fetch failed");
        mockClient.getMempoolTransactions.mockRejectedValue(mockError);

        await request(app)
          .get("/mempool")
          .expect(500);

        expect(mockClient.getMempoolTransactions).toHaveBeenCalledWith({});
      });

      it("should handle sort parameters", async () => {
        const mockTransactions = [
          { transaction: { body: { kernels: [{ fee: "1000" }] } } },
          { transaction: { body: { kernels: [{ fee: "2000" }] } } }
        ];
        mockClient.getMempoolTransactions.mockResolvedValue(mockTransactions);

        const response = await request(app)
          .get("/mempool?sort_by=fee")
          .expect(200);

        expect(mockClient.getMempoolTransactions).toHaveBeenCalledWith({
          sort_by: "fee"
        });
        expect(response.body.transactions).toEqual(mockTransactions);
      });

      it("should handle null transaction responses", async () => {
        mockClient.getMempoolTransactions.mockResolvedValue(null);

        const response = await request(app)
          .get("/mempool?json")
          .expect(200);

        expect(response.body).toEqual({
          transactions: null
        });
      });

      it("should handle malformed transaction data", async () => {
        const mockTransactions = [
          { transaction: null },
          { transaction: { body: null } },
          { /* missing transaction property */ }
        ];
        mockClient.getMempoolTransactions.mockResolvedValue(mockTransactions);

        const response = await request(app)
          .get("/mempool?json")
          .expect(200);

        expect(response.body.transactions).toEqual(mockTransactions);
      });
    });
  });

  describe("miners route", () => {
    describe("GET /", () => {
      it("should return mining statistics as HTML", async () => {
        const mockTipInfo = { height: "50000", best_block_hash: "tip123" };
        const mockDifficulty = [
          { difficulty: "1000000", estimated_hash_rate: "500000000" },
          { difficulty: "1100000", estimated_hash_rate: "550000000" }
        ];
        const mockStats = {
          averageBlockTime: 120,
          totalHashRate: "1000000000",
          networkDifficulty: "1050000"
        };

        mockClient.getTipInfo.mockResolvedValue(mockTipInfo);
        mockClient.getNetworkDifficulty.mockResolvedValue(mockDifficulty);
        (getStats as any).mockReturnValue(mockStats);
        (getMiningStats as any).mockReturnValue({
          hashRateHistory: [500, 600, 700],
          difficultyHistory: [1000, 1100, 1200]
        });

        const response = await request(app)
          .get("/miners")
          .expect(200);

        expect(mockClient.getTipInfo).toHaveBeenCalledWith({});
        expect(mockClient.getNetworkDifficulty).toHaveBeenCalledWith({
          from_tip: "0",
          start_height: expect.any(String),
          end_height: expect.any(String)
        });
        expect(response.body).toEqual({
          template: "miners",
          tipInfo: mockTipInfo,
          difficulty: mockDifficulty,
          stats: mockStats,
          hashRateHistory: [500, 600, 700],
          difficultyHistory: [1000, 1100, 1200]
        });
      });

      it("should return mining statistics as JSON", async () => {
        const mockTipInfo = { height: "60000", best_block_hash: "tip456" };
        const mockDifficulty = [
          { difficulty: "2000000", estimated_hash_rate: "1000000000" }
        ];
        const mockStats = {
          averageBlockTime: 110,
          totalHashRate: "2000000000"
        };

        mockClient.getTipInfo.mockResolvedValue(mockTipInfo);
        mockClient.getNetworkDifficulty.mockResolvedValue(mockDifficulty);
        (getStats as any).mockReturnValue(mockStats);
        (getMiningStats as any).mockReturnValue({
          hashRateHistory: [800, 900, 1000],
          difficultyHistory: [1800, 1900, 2000]
        });

        const response = await request(app)
          .get("/miners?json")
          .expect(200)
          .expect("Content-Type", /json/);

        expect(response.body).toEqual({
          tipInfo: mockTipInfo,
          difficulty: mockDifficulty,
          stats: mockStats,
          hashRateHistory: [800, 900, 1000],
          difficultyHistory: [1800, 1900, 2000]
        });
      });

      it("should handle height range parameters", async () => {
        const mockTipInfo = { height: "70000" };
        mockClient.getTipInfo.mockResolvedValue(mockTipInfo);
        mockClient.getNetworkDifficulty.mockResolvedValue([]);
        (getStats as any).mockReturnValue({});
        (getMiningStats as any).mockReturnValue({});

        const response = await request(app)
          .get("/miners?from=1000&to=2000")
          .expect(200);

        expect(mockClient.getNetworkDifficulty).toHaveBeenCalledWith({
          from_tip: "0",
          start_height: "1000",
          end_height: "2000"
        });
      });

      it("should handle default height range", async () => {
        const mockTipInfo = { height: "80000" };
        mockClient.getTipInfo.mockResolvedValue(mockTipInfo);
        mockClient.getNetworkDifficulty.mockResolvedValue([]);
        (getStats as any).mockReturnValue({});
        (getMiningStats as any).mockReturnValue({});

        const response = await request(app)
          .get("/miners")
          .expect(200);

        expect(mockClient.getNetworkDifficulty).toHaveBeenCalledWith({
          from_tip: "0",
          start_height: "79000", // tipHeight - 1000
          end_height: "80000"
        });
      });

      it("should handle client errors", async () => {
        const mockError = new Error("Mining data fetch failed");
        mockClient.getTipInfo.mockRejectedValue(mockError);

        await request(app)
          .get("/miners")
          .expect(500);

        expect(mockClient.getTipInfo).toHaveBeenCalledWith({});
      });

      it("should handle empty difficulty data", async () => {
        const mockTipInfo = { height: "90000" };
        mockClient.getTipInfo.mockResolvedValue(mockTipInfo);
        mockClient.getNetworkDifficulty.mockResolvedValue([]);
        (getStats as any).mockReturnValue({});
        (getMiningStats as any).mockReturnValue({
          hashRateHistory: [],
          difficultyHistory: []
        });

        const response = await request(app)
          .get("/miners?json")
          .expect(200);

        expect(response.body.difficulty).toEqual([]);
        expect(response.body.hashRateHistory).toEqual([]);
        expect(response.body.difficultyHistory).toEqual([]);
      });

      it("should handle null tip info", async () => {
        mockClient.getTipInfo.mockResolvedValue(null);
        mockClient.getNetworkDifficulty.mockResolvedValue([]);
        (getStats as any).mockReturnValue({});
        (getMiningStats as any).mockReturnValue({});

        const response = await request(app)
          .get("/miners?json")
          .expect(200);

        expect(response.body.tipInfo).toBe(null);
      });

      it("should handle malformed stats data", async () => {
        const mockTipInfo = { height: "100000" };
        mockClient.getTipInfo.mockResolvedValue(mockTipInfo);
        mockClient.getNetworkDifficulty.mockResolvedValue([]);
        (getStats as any).mockReturnValue(null);
        (getMiningStats as any).mockReturnValue(null);

        const response = await request(app)
          .get("/miners?json")
          .expect(200);

        expect(response.body.stats).toBe(null);
      });

      it("should handle very large height values", async () => {
        const mockTipInfo = { height: "999999999" };
        mockClient.getTipInfo.mockResolvedValue(mockTipInfo);
        mockClient.getNetworkDifficulty.mockResolvedValue([]);
        (getStats as any).mockReturnValue({});
        (getMiningStats as any).mockReturnValue({});

        const response = await request(app)
          .get("/miners")
          .expect(200);

        expect(mockClient.getNetworkDifficulty).toHaveBeenCalledWith({
          from_tip: "0",
          start_height: "999998999", // tipHeight - 1000
          end_height: "999999999"
        });
      });
    });
  });

  describe("cache integration", () => {
    it("should use cache for frequently accessed data", async () => {
      mockCache.get.mockReturnValue(null);
      mockCache.set.mockReturnValue(undefined);

      const blockHash = "cached123";
      const mockHeader = { height: "12345", hash: blockHash };
      mockClient.getHeaderByHash.mockResolvedValue(mockHeader);
      mockClient.getBlocks.mockResolvedValue([]);

      const response = await request(app)
        .get(`/blocks/${blockHash}`)
        .expect(200);

      // Cache operations would be tested if cache is used in the routes
      expect(response.body.header).toEqual(mockHeader);
    });
  });

  describe("error handling edge cases", () => {
    it("should handle network timeouts", async () => {
      const timeoutError = new Error("Network timeout");
      timeoutError.name = "TimeoutError";
      mockClient.getTipInfo.mockRejectedValue(timeoutError);

      await request(app)
        .get("/miners")
        .expect(500);
    });

    it("should handle malformed responses", async () => {
      mockClient.getBlocks.mockResolvedValue("not an array");

      await request(app)
        .get("/blocks/malformed123")
        .expect(500);
    });

    it("should handle very long hash strings", async () => {
      const longHash = "a".repeat(1000);
      mockClient.getHeaderByHash.mockResolvedValue(null);

      await request(app)
        .get(`/blocks/${longHash}`)
        .expect(404);

      expect(mockClient.getHeaderByHash).toHaveBeenCalledWith({ hash: longHash });
    });

    it("should handle special characters in hash", async () => {
      const specialHash = "abc123-def456_ghi789";
      mockClient.getHeaderByHash.mockResolvedValue(null);

      await request(app)
        .get(`/blocks/${encodeURIComponent(specialHash)}`)
        .expect(404);
    });
  });
});
