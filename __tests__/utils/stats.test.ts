import { describe, it, expect } from "vitest";
import { miningStats } from "../../utils/stats.js";

describe("miningStats", () => {
  const createMockBlock = (overrides = {}) => ({
    block: {
      header: {
        timestamp: 1640995200, // Jan 1, 2022 00:00:00 UTC
        pow: {
          pow_algo: "0", // Monero by default
        },
      },
      body: {
        inputs: [
          { input_data: "mock_input_1" },
          { input_data: "mock_input_2" },
        ],
        outputs: [
          {
            features: {
              output_type: 1, // Coinbase
              range_proof_type: 1,
            },
            minimum_value_promise: "1000000", // 1 XTM
          },
          {
            features: {
              output_type: 0, // Standard
              range_proof_type: 1,
            },
            minimum_value_promise: "500000", // 0.5 XTM
          },
          {
            features: {
              output_type: 1, // Coinbase
              range_proof_type: 1,
            },
            minimum_value_promise: "2000000", // 2 XTM
          },
        ],
      },
    },
    ...overrides,
  });

  describe("valid block data", () => {
    it("should calculate mining stats for Monero algorithm", () => {
      const mockBlock = createMockBlock();
      const result = miningStats(mockBlock);

      expect(result.totalCoinbaseXtm).toBe("3.000000");
      expect(result.numCoinbases).toBe(2);
      expect(result.numOutputsNoCoinbases).toBe(1);
      expect(result.numInputs).toBe(2);
      expect(result.powAlgo).toBe("Monero");
      expect(result.timestamp).toMatch(/01\/01\/2022, \d{2}:00:00/);
    });

    it("should calculate mining stats for SHA-3 algorithm", () => {
      const mockBlock = createMockBlock({
        block: {
          header: {
            timestamp: 1640995200,
            pow: {
              pow_algo: "1", // SHA-3
            },
          },
          body: {
            inputs: [],
            outputs: [
              {
                features: {
                  output_type: 1,
                  range_proof_type: 1,
                },
                minimum_value_promise: "5000000", // 5 XTM
              },
            ],
          },
        },
      });

      const result = miningStats(mockBlock);

      expect(result.totalCoinbaseXtm).toBe("5.000000");
      expect(result.numCoinbases).toBe(1);
      expect(result.numOutputsNoCoinbases).toBe(0);
      expect(result.numInputs).toBe(0);
      expect(result.powAlgo).toBe("SHA-3");
      expect(result.timestamp).toMatch(/01\/01\/2022, \d{2}:00:00/);
    });

    it("should handle array input (first element)", () => {
      const mockBlock = createMockBlock();
      const result = miningStats([mockBlock]);

      expect(result.powAlgo).toBe("Monero");
      expect(result.numCoinbases).toBe(2);
    });

    it("should handle block with no coinbase outputs", () => {
      const mockBlock = createMockBlock({
        block: {
          header: {
            timestamp: 1640995200,
            pow: { pow_algo: "0" },
          },
          body: {
            inputs: [{ input_data: "mock" }],
            outputs: [
              {
                features: {
                  output_type: 0, // Standard output
                  range_proof_type: 1,
                },
                minimum_value_promise: "1000000",
              },
            ],
          },
        },
      });

      const result = miningStats(mockBlock);

      expect(result.totalCoinbaseXtm).toBe("0.000000");
      expect(result.numCoinbases).toBe(0);
      expect(result.numOutputsNoCoinbases).toBe(1);
      expect(result.numInputs).toBe(1);
      expect(result.powAlgo).toBe("Monero");
      expect(result.timestamp).toMatch(/01\/01\/2022, \d{2}:00:00/);
    });

    it("should handle outputs with missing minimum_value_promise", () => {
      const mockBlock = createMockBlock({
        block: {
          header: {
            timestamp: 1640995200,
            pow: { pow_algo: "0" },
          },
          body: {
            inputs: [],
            outputs: [
              {
                features: {
                  output_type: 1,
                  range_proof_type: 1,
                },
                // No minimum_value_promise
              },
              {
                features: {
                  output_type: 1,
                  range_proof_type: 1,
                },
                minimum_value_promise: null,
              },
            ],
          },
        },
      });

      const result = miningStats(mockBlock);

      expect(result.totalCoinbaseXtm).toBe("0.000000");
      expect(result.numCoinbases).toBe(2);
    });

    it("should format large coinbase amounts correctly", () => {
      const mockBlock = createMockBlock({
        block: {
          header: {
            timestamp: 1640995200,
            pow: { pow_algo: "0" },
          },
          body: {
            inputs: [],
            outputs: [
              {
                features: {
                  output_type: 1,
                  range_proof_type: 1,
                },
                minimum_value_promise: "123456789000", // 123,456.789 XTM
              },
            ],
          },
        },
      });

      const result = miningStats(mockBlock);

      expect(result.totalCoinbaseXtm).toBe("123,456.789000");
    });

    it("should handle different timestamp formats", () => {
      const mockBlock = createMockBlock({
        block: {
          header: {
            timestamp: 1609459200, // Jan 1, 2021 00:00:00 UTC
            pow: { pow_algo: "0" },
          },
          body: {
            inputs: [],
            outputs: [],
          },
        },
      });

      const result = miningStats(mockBlock);

      expect(result.timestamp).toMatch(/01\/01\/2021, \d{2}:00:00/);
    });
  });

  describe("error handling", () => {
    it("should throw error for null input", () => {
      expect(() => miningStats(null)).toThrow("Invalid block data");
    });

    it("should throw error for undefined input", () => {
      expect(() => miningStats(undefined)).toThrow("Invalid block data");
    });

    it("should throw error for non-object input", () => {
      expect(() => miningStats("invalid")).toThrow("Invalid block data");
      expect(() => miningStats(123)).toThrow("Invalid block data");
      expect(() => miningStats(true)).toThrow("Invalid block data");
    });

    it("should throw error for empty object", () => {
      expect(() => miningStats({})).toThrow("Invalid block data");
    });

    it("should throw error for missing block property", () => {
      expect(() => miningStats({ notBlock: {} })).toThrow("Invalid block data");
    });

    it("should throw error for missing block.body", () => {
      expect(() =>
        miningStats({
          block: {
            header: {},
          },
        }),
      ).toThrow("Invalid block data");
    });

    it("should throw error for missing block.body.outputs", () => {
      expect(() =>
        miningStats({
          block: {
            header: {},
            body: {},
          },
        }),
      ).toThrow("Invalid block data");
    });

    it("should throw error for non-array outputs", () => {
      expect(() =>
        miningStats({
          block: {
            header: {},
            body: {
              outputs: "not an array",
            },
          },
        }),
      ).toThrow("Invalid block data");
    });

    it("should throw error for empty array input", () => {
      expect(() => miningStats([])).toThrow("Invalid block data");
    });

    it("should throw error for array with invalid first element", () => {
      expect(() => miningStats([null])).toThrow("Invalid block data");
      expect(() => miningStats([{}])).toThrow("Invalid block data");
    });
  });

  describe("edge cases", () => {
    it("should handle outputs with malformed features", () => {
      const mockBlock = createMockBlock({
        block: {
          header: {
            timestamp: 1640995200,
            pow: { pow_algo: "0" },
          },
          body: {
            inputs: [],
            outputs: [
              {
                // No features object
                minimum_value_promise: "1000000",
              },
              {
                features: {
                  // Missing output_type
                  range_proof_type: 1,
                },
                minimum_value_promise: "2000000",
              },
              {
                features: {
                  output_type: 1,
                  // Missing range_proof_type
                },
                minimum_value_promise: "3000000",
              },
            ],
          },
        },
      });

      const result = miningStats(mockBlock);

      // None of the outputs should be counted as coinbase since they don't match the criteria
      expect(result.numCoinbases).toBe(0);
      expect(result.totalCoinbaseXtm).toBe("0.000000");
      expect(result.numOutputsNoCoinbases).toBe(3);
    });

    it("should handle missing inputs array", () => {
      const mockBlock = createMockBlock({
        block: {
          header: {
            timestamp: 1640995200,
            pow: { pow_algo: "0" },
          },
          body: {
            // No inputs array
            outputs: [],
          },
        },
      });

      expect(() => miningStats(mockBlock)).toThrow();
    });

    it("should handle very small amounts", () => {
      const mockBlock = createMockBlock({
        block: {
          header: {
            timestamp: 1640995200,
            pow: { pow_algo: "0" },
          },
          body: {
            inputs: [],
            outputs: [
              {
                features: {
                  output_type: 1,
                  range_proof_type: 1,
                },
                minimum_value_promise: "1", // 0.000001 XTM
              },
            ],
          },
        },
      });

      const result = miningStats(mockBlock);

      expect(result.totalCoinbaseXtm).toBe("0.000001");
    });
  });
});
