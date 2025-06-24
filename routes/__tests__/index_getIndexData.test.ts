import { describe, it, expect, beforeEach, vi } from "vitest";

// Mock BEFORE imports - this is critical for ESM
const mockClient = {
  getTipInfo: vi.fn(),
  getVersion: vi.fn(),
  listHeaders: vi.fn(),
  getMempoolTransactions: vi.fn(),
  getNetworkDifficulty: vi.fn(),
  getBlocks: vi.fn(),
  getActiveValidatorNodes: vi.fn()
};

vi.mock("../../baseNodeClient.js", () => ({
  createClient: vi.fn(() => mockClient),
}));

vi.mock("../../cache.js", () => ({
  default: {
    get: vi.fn()
  }
}));

vi.mock("../../utils/stats.js", () => ({
  miningStats: vi.fn(() => ({
    totalCoinbaseXtm: 2800000000,
    numCoinbases: 1,
    numOutputsNoCoinbases: 5,
    numInputs: 3
  }))
}));

import { getIndexData } from "../index.js";
import cache from "../../cache.js";
import { miningStats } from "../../utils/stats.js";

describe("getIndexData function", () => {
  let mockCache: any;
  let mockMiningStats: any;

  beforeEach(async () => {
    vi.clearAllMocks();
    
    mockCache = cache;
    mockMiningStats = miningStats as any;
    
    // Set up default mocks
    mockClient.getTipInfo.mockResolvedValue({
      metadata: {
        best_block_height: "1000"
      }
    });

    mockClient.getVersion.mockResolvedValue({
      value: "tari-base-node-0.50.0-abc123"
    });

    // Mock last 101 headers for algo split calculations
    const mockHeaders = Array.from({ length: 101 }, (_, i) => ({
      header: {
        height: (1000 - i).toString(),
        timestamp: (Date.now() / 1000 - i * 120).toString(),
        kernel_mmr_size: (1000 + i).toString(),
        output_mmr_size: (2000 + i).toString(),
        pow: {
          pow_algo: i % 3 === 0 ? "0" : i % 3 === 1 ? "1" : "2" // Mix of algorithms
        }
      }
    }));

    mockClient.listHeaders
      .mockResolvedValueOnce(mockHeaders) // First call for last 100 headers
      .mockResolvedValueOnce(mockHeaders.slice(0, 21)); // Second call for pagination

    mockClient.getMempoolTransactions.mockResolvedValue([
      {
        transaction: {
          body: {
            kernels: [
              { fee: "100", excess_sig: { signature: "sig1" } },
              { fee: "200", excess_sig: { signature: "sig2" } }
            ]
          }
        }
      },
      {
        transaction: {
          body: {
            kernels: [
              { fee: "150", excess_sig: { signature: "sig3" } }
            ]
          }
        }
      }
    ]);

    // Mock network difficulty for hash rate calculations
    const mockDifficulties = Array.from({ length: 180 }, (_, i) => ({
      difficulty: (1000000 + i * 1000).toString(),
      estimated_hash_rate: (500000 + i * 500).toString(),
      sha3x_estimated_hash_rate: (200000 + i * 200).toString(),
      monero_randomx_estimated_hash_rate: (150000 + i * 150).toString(),
      tari_randomx_estimated_hash_rate: (150000 + i * 150).toString(),
      height: (1000 - i).toString(),
      timestamp: (Date.now() / 1000 - i * 120).toString()
    }));

    mockClient.getNetworkDifficulty.mockResolvedValue(mockDifficulties);

    // Mock blocks for mining stats
    const mockBlocks = Array.from({ length: 20 }, (_, i) => ({
      block: {
        header: {
          height: (1000 - i).toString()
        },
        body: {
          outputs: Array.from({ length: 5 }, (_, j) => ({ commitment: `output${j}` })),
          inputs: Array.from({ length: 3 }, (_, j) => ({ commitment: `input${j}` })),
          kernels: Array.from({ length: 1 }, (_, j) => ({ commitment: `kernel${j}` }))
        }
      }
    }));

    mockClient.getBlocks.mockResolvedValue(mockBlocks);

    // Mock active validator nodes
    mockClient.getActiveValidatorNodes.mockResolvedValue([
      { shard_key: "vn1", public_key: "key1" },
      { shard_key: "vn2", public_key: "key2" }
    ]);

    // Mock cache.get for individual block requests and active VNs
    mockCache.get.mockImplementation((fn: any, params: any) => {
      if (params.heights) {
        return Promise.resolve([mockBlocks[0]]);
      }
      if (params.height) {
        // Active validator nodes request
        return Promise.resolve([
          { shard_key: "vn1", public_key: "key1" },
          { shard_key: "vn2", public_key: "key2" }
        ]);
      }
      return Promise.resolve([]);
    });
  });

  it("should return comprehensive index data", async () => {
    const result = await getIndexData(0, 20);

    expect(result).toBeDefined();
    expect(result).toHaveProperty("title", "Blocks");
    expect(result).toHaveProperty("version", "tari-base-node-0.50.0-abc");
    expect(result).toHaveProperty("tipInfo");
    expect(result).toHaveProperty("mempool");
    expect(result).toHaveProperty("headers");
    expect(result).toHaveProperty("algoSplit");
    expect(result).toHaveProperty("blockTimes");
    expect(result).toHaveProperty("currentHashRate");
    expect(result).toHaveProperty("activeVns");
    expect(result).toHaveProperty("stats");
  });

  it("should calculate algorithm split correctly", async () => {
    const result = await getIndexData(0, 20);

    expect(result.algoSplit).toHaveProperty("moneroRx10");
    expect(result.algoSplit).toHaveProperty("moneroRx20");
    expect(result.algoSplit).toHaveProperty("moneroRx50");
    expect(result.algoSplit).toHaveProperty("moneroRx100");
    expect(result.algoSplit).toHaveProperty("sha3X10");
    expect(result.algoSplit).toHaveProperty("sha3X20");
    expect(result.algoSplit).toHaveProperty("sha3X50");
    expect(result.algoSplit).toHaveProperty("sha3X100");
    expect(result.algoSplit).toHaveProperty("tariRx10");
    expect(result.algoSplit).toHaveProperty("tariRx20");
    expect(result.algoSplit).toHaveProperty("tariRx50");
    expect(result.algoSplit).toHaveProperty("tariRx100");

    // Verify total counts add up correctly
    const totalBlocks = result.algoSplit.sha3X100 + 
                       result.algoSplit.moneroRx100 + 
                       result.algoSplit.tariRx100;
    expect(totalBlocks).toBe(100); // 101 headers - 1 for difference calculation
  });

  it("should process mempool transactions correctly", async () => {
    const result = await getIndexData(0, 20);

    expect(result.mempool).toHaveLength(2);
    expect(result.mempool[0].transaction.body.total_fees).toBe(300); // 100 + 200
    expect(result.mempool[1].transaction.body.total_fees).toBe(150);
    expect(result.mempool[0].transaction.body.signature).toBe("sig2"); // Last kernel signature
    expect(result.mempool[1].transaction.body.signature).toBe("sig3");
  });

  it("should calculate hash rates for all algorithms", async () => {
    const result = await getIndexData(0, 20);

    expect(result).toHaveProperty("totalHashRates");
    expect(result).toHaveProperty("currentHashRate");
    expect(result).toHaveProperty("sha3xHashRates");
    expect(result).toHaveProperty("currentSha3xHashRate");
    expect(result).toHaveProperty("moneroRandomxHashRates");
    expect(result).toHaveProperty("currentMoneroRandomxHashRate");
    expect(result).toHaveProperty("tariRandomxHashRates");
    expect(result).toHaveProperty("currentTariRandomxHashRate");

    expect(Array.isArray(result.totalHashRates)).toBe(true);
    expect(Array.isArray(result.sha3xHashRates)).toBe(true);
    expect(Array.isArray(result.moneroRandomxHashRates)).toBe(true);
    expect(Array.isArray(result.tariRandomxHashRates)).toBe(true);
  });

  it("should calculate average miners correctly", async () => {
    const result = await getIndexData(0, 20);

    expect(result).toHaveProperty("averageSha3xMiners");
    expect(result).toHaveProperty("averageMoneroRandomxMiners");
    expect(result).toHaveProperty("averageTariRandomxMiners");

    // Verify calculations
    expect(result.averageSha3xMiners).toBe(
      Math.floor(result.currentSha3xHashRate / 200_000_000)
    );
    expect(result.averageMoneroRandomxMiners).toBe(
      Math.floor(result.currentMoneroRandomxHashRate / 2700)
    );
    expect(result.averageTariRandomxMiners).toBe(
      Math.floor(result.currentTariRandomxHashRate / 2700)
    );
  });

  it("should calculate block times for all algorithms", async () => {
    const result = await getIndexData(0, 20);

    expect(result).toHaveProperty("blockTimes");
    expect(result).toHaveProperty("moneroRandomxTimes");
    expect(result).toHaveProperty("sha3xTimes");
    expect(result).toHaveProperty("tariRandomxTimes");

    expect(result.blockTimes).toHaveProperty("series");
    expect(result.blockTimes).toHaveProperty("average");
    expect(Array.isArray(result.blockTimes.series)).toBe(true);
    expect(typeof result.blockTimes.average).toBe("string");
  });

  it("should augment headers with MMR size differences", async () => {
    const result = await getIndexData(0, 20);

    expect(result.headers).toHaveLength(20);
    
    // Check that MMR size differences were calculated
    for (const header of result.headers) {
      expect(header).toHaveProperty("kernels");
      expect(header).toHaveProperty("outputs");
      expect(header).toHaveProperty("powText");
      expect(typeof header.kernels).toBe("number");
      expect(typeof header.outputs).toBe("number");
    }
  });

  it("should augment headers with mining statistics", async () => {
    const result = await getIndexData(0, 20);

    // Verify mining stats were added to headers
    for (const header of result.headers) {
      expect(header).toHaveProperty("totalCoinbaseXtm");
      expect(header).toHaveProperty("numCoinbases");
      expect(header).toHaveProperty("numOutputsNoCoinbases");
      expect(header).toHaveProperty("numInputs");
    }

    // Verify miningStats was called for each block
    expect(mockMiningStats).toHaveBeenCalled();
  });

  it("should set pagination parameters correctly", async () => {
    const result = await getIndexData(10, 20);

    expect(result).toHaveProperty("from", 10);
    expect(result).toHaveProperty("limit", 20);
    expect(result).toHaveProperty("nextPage");
    expect(result).toHaveProperty("prevPage");
    
    // Calculate expected pagination based on first header height
    const firstHeight = parseInt(result.headers[0].height);
    expect(result.nextPage).toBe(firstHeight - 20);
    expect(result.prevPage).toBe(firstHeight + 20);
  });

  it("should include active validator nodes", async () => {
    const result = await getIndexData(0, 20);

    expect(result.activeVns).toHaveLength(2);
    expect(result.activeVns[0]).toHaveProperty("shard_key", "vn1");
    expect(result.activeVns[1]).toHaveProperty("shard_key", "vn2");
    
    // Verify that cache.get was called with getActiveValidatorNodes function
    expect(mockCache.get).toHaveBeenCalledWith(
      mockClient.getActiveValidatorNodes,
      { height: "1000" }
    );
  });

  it("should handle genesis block edge case", async () => {
    // Mock headers where the last header is genesis block
    const genesisHeaders = [{
      header: {
        height: "0",
        timestamp: "0",
        kernel_mmr_size: "100",
        output_mmr_size: "200",
        pow: { pow_algo: "0" }
      }
    }];

    mockClient.listHeaders
      .mockReset()
      .mockResolvedValueOnce(genesisHeaders) // First call for last 100 headers
      .mockResolvedValueOnce(genesisHeaders); // Second call for pagination

    const result = await getIndexData(0, 1);

    // Genesis block should use MMR sizes directly
    const lastHeader = result.headers[result.headers.length - 1];
    expect(lastHeader.height).toBe("0");
    expect(lastHeader.kernels).toBe("100"); // MMR sizes are strings
    expect(lastHeader.outputs).toBe("200");
  });

  it("should return null when no blocks available", async () => {
    mockClient.getBlocks.mockResolvedValue([]);

    const result = await getIndexData(0, 20);

    expect(result).toBeNull();
  });

  it("should return null when tip block not found", async () => {
    mockCache.get.mockImplementation((fn: any, params: any) => {
      if (params.heights && params.heights[0] === "1000") {
        return Promise.resolve([]);
      }
      return Promise.resolve([{}]);
    });

    const result = await getIndexData(0, 20);

    expect(result).toBeNull();
  });

  it("should handle missing stats gracefully", async () => {
    // Mock scenario where some blocks don't have stats
    const partialBlocks = [
      {
        block: {
          header: { height: "1000" },
          body: { outputs: [], inputs: [], kernels: [] }
        }
      }
    ];

    mockClient.getBlocks.mockResolvedValue(partialBlocks);

    const result = await getIndexData(0, 20);

    // Should still call cache.get for missing stats
    expect(mockCache.get).toHaveBeenCalled();
    expect(result.headers[0]).toHaveProperty("totalCoinbaseXtm");
  });

  it("should set algorithm text correctly", async () => {
    const result = await getIndexData(0, 20);

    // Check that powText was set based on pow_algo
    for (const header of result.headers) {
      if (header.pow && header.pow.pow_algo === "0") {
        expect(header.powText).toBe("MoneroRx");
      } else if (header.pow && header.pow.pow_algo === "1") {
        expect(header.powText).toBe("SHA-3X");
      } else if (header.pow && header.pow.pow_algo === "2") {
        expect(header.powText).toBe("TariRx");
      }
    }
  });

  it("should include lastUpdate timestamp", async () => {
    const beforeCall = new Date();
    const result = await getIndexData(0, 20);
    const afterCall = new Date();

    expect(result.lastUpdate).toBeInstanceOf(Date);
    expect(result.lastUpdate.getTime()).toBeGreaterThanOrEqual(beforeCall.getTime());
    expect(result.lastUpdate.getTime()).toBeLessThanOrEqual(afterCall.getTime());
  });

  it("should make all required gRPC calls", async () => {
    await getIndexData(0, 20);

    expect(mockClient.getTipInfo).toHaveBeenCalledWith({});
    expect(mockClient.getVersion).toHaveBeenCalledWith({});
    expect(mockClient.listHeaders).toHaveBeenCalledTimes(2);
    expect(mockClient.getMempoolTransactions).toHaveBeenCalledWith({});
    expect(mockClient.getNetworkDifficulty).toHaveBeenCalledWith({ from_tip: 180 });
    expect(mockClient.getBlocks).toHaveBeenCalled();
    // Note: getActiveValidatorNodes is called through cache.get, not directly
    expect(mockCache.get).toHaveBeenCalled();
  });
});
