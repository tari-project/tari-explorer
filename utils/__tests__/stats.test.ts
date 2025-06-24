import { miningStats } from '../stats.js';

describe('miningStats', () => {
  const mockBlockData = {
    block: {
      header: {
        timestamp: 1640995200, // Jan 1, 2022
        pow: {
          pow_algo: "0"
        }
      },
      body: {
        inputs: [
          { id: 'input1' },
          { id: 'input2' }
        ],
        outputs: [
          {
            features: {
              output_type: 1,
              range_proof_type: 1
            },
            minimum_value_promise: "1000000"
          },
          {
            features: {
              output_type: 1,
              range_proof_type: 1
            },
            minimum_value_promise: "2000000"
          },
          {
            features: {
              output_type: 0,
              range_proof_type: 0
            },
            minimum_value_promise: "500000"
          }
        ]
      }
    }
  };

  describe('with valid block data', () => {
    it('should calculate mining stats correctly for object input', () => {
      const result = miningStats(mockBlockData);
      
      expect(result).toEqual({
        totalCoinbaseXtm: "3.000000",
        numCoinbases: 2,
        numOutputsNoCoinbases: 1,
        numInputs: 2,
        powAlgo: "Monero",
        timestamp: expect.stringMatching(/\d{2}\/\d{2}\/\d{4}, \d{2}:\d{2}:\d{2}/)
      });
    });

    it('should calculate mining stats correctly for array input', () => {
      const result = miningStats([mockBlockData]);
      
      expect(result).toEqual({
        totalCoinbaseXtm: "3.000000",
        numCoinbases: 2,
        numOutputsNoCoinbases: 1,
        numInputs: 2,
        powAlgo: "Monero",
        timestamp: expect.stringMatching(/\d{2}\/\d{2}\/\d{4}, \d{2}:\d{2}:\d{2}/)
      });
    });

    it('should handle SHA-3 pow algorithm', () => {
      const sha3Block = {
        ...mockBlockData,
        block: {
          ...mockBlockData.block,
          header: {
            ...mockBlockData.block.header,
            pow: { pow_algo: "1" }
          }
        }
      };
      
      const result = miningStats(sha3Block);
      expect(result.powAlgo).toBe("SHA-3");
    });

    it('should handle missing minimum_value_promise', () => {
      const blockWithoutPromise = {
        ...mockBlockData,
        block: {
          ...mockBlockData.block,
          body: {
            ...mockBlockData.block.body,
            outputs: [{
              features: {
                output_type: 1,
                range_proof_type: 1
              }
              // No minimum_value_promise
            }]
          }
        }
      };
      
      const result = miningStats(blockWithoutPromise);
      expect(result.totalCoinbaseXtm).toBe("0.000000");
      expect(result.numCoinbases).toBe(1);
    });
  });

  describe('with invalid block data', () => {
    it('should throw error for null input', () => {
      expect(() => miningStats(null)).toThrow('Invalid block data');
    });

    it('should throw error for undefined input', () => {
      expect(() => miningStats(undefined)).toThrow('Invalid block data');
    });

    it('should throw error for empty object', () => {
      expect(() => miningStats({})).toThrow('Invalid block data');
    });

    it('should throw error for missing block property', () => {
      expect(() => miningStats({ notBlock: true })).toThrow('Invalid block data');
    });

    it('should throw error for missing outputs array', () => {
      const invalidBlock = {
        block: {
          header: { timestamp: 123 },
          body: { inputs: [] }
          // No outputs
        }
      };
      
      expect(() => miningStats(invalidBlock)).toThrow('Invalid block data');
    });

    it('should throw error for non-array outputs', () => {
      const invalidBlock = {
        block: {
          header: { timestamp: 123 },
          body: {
            inputs: [],
            outputs: "not an array"
          }
        }
      };
      
      expect(() => miningStats(invalidBlock)).toThrow('Invalid block data');
    });
  });

  describe('edge cases', () => {
    it('should handle empty outputs array', () => {
      const emptyOutputsBlock = {
        ...mockBlockData,
        block: {
          ...mockBlockData.block,
          body: {
            inputs: [],
            outputs: []
          }
        }
      };
      
      const result = miningStats(emptyOutputsBlock);
      expect(result.totalCoinbaseXtm).toBe("0.000000");
      expect(result.numCoinbases).toBe(0);
      expect(result.numOutputsNoCoinbases).toBe(0);
      expect(result.numInputs).toBe(0);
    });

    it('should handle outputs without coinbase features', () => {
      const noCoinbaseBlock = {
        ...mockBlockData,
        block: {
          ...mockBlockData.block,
          body: {
            inputs: [{ id: 'input1' }],
            outputs: [
              {
                features: {
                  output_type: 0,
                  range_proof_type: 0
                },
                minimum_value_promise: "1000000"
              }
            ]
          }
        }
      };
      
      const result = miningStats(noCoinbaseBlock);
      expect(result.totalCoinbaseXtm).toBe("0.000000");
      expect(result.numCoinbases).toBe(0);
      expect(result.numOutputsNoCoinbases).toBe(1);
    });
  });
});
