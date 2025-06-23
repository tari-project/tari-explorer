import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import path from 'path';

// Mock external dependencies
const mockClient = {
  getVersion: vi.fn(),
  listHeaders: vi.fn(),
  getBlocks: vi.fn(),
  getMempoolTransactions: vi.fn(),
  getTipInfo: vi.fn(),
  searchUtxos: vi.fn(),
  getTokens: vi.fn(),
  getNetworkDifficulty: vi.fn(),
  getActiveValidatorNodes: vi.fn(),
  getHeaderByHash: vi.fn(),
  searchKernels: vi.fn(),
  searchPaymentReferences: vi.fn()
};

const mockSendMessage = vi.fn();

// Mock the method functions to return objects with sendMessage
Object.keys(mockClient).forEach(method => {
  (mockClient as any)[method].mockReturnValue({ sendMessage: mockSendMessage });
});

vi.mock('@grpc/grpc-js', () => ({
  default: {
    loadPackageDefinition: vi.fn(() => ({
      tari: {
        rpc: {
          BaseNode: vi.fn(() => mockClient)
        }
      }
    })),
    credentials: {
      createInsecure: vi.fn()
    },
    Metadata: vi.fn()
  }
}));

vi.mock('@grpc/proto-loader', () => ({
  default: {
    loadSync: vi.fn(() => ({}))
  }
}));

vi.mock('grpc-promise', () => ({
  promisifyAll: vi.fn()
}));

describe('baseNodeClient', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('Client class', () => {
    it('should create client with default address when no env var set', async () => {
      delete process.env.BASE_NODE_GRPC_URL;
      
      const { createClient } = await import('../baseNodeClient.js');
      const client = createClient();
      
      expect(client).toBeDefined();
      expect(client.inner).toBeDefined();
    });

    it('should create client with environment variable address', async () => {
      process.env.BASE_NODE_GRPC_URL = 'custom-host:9999';
      
      const { createClient } = await import('../baseNodeClient.js');
      const client = createClient();
      
      expect(client).toBeDefined();
      expect(client.inner).toBeDefined();
    });

    it('should have all required gRPC methods', async () => {
      const { createClient } = await import('../baseNodeClient.js');
      const client = createClient();
      
      const expectedMethods = [
        'getVersion',
        'listHeaders',
        'getBlocks',
        'getMempoolTransactions',
        'getTipInfo',
        'searchUtxos',
        'getTokens',
        'getNetworkDifficulty',
        'getActiveValidatorNodes',
        'getHeaderByHash',
        'searchKernels',
        'searchPaymentReferences'
      ];
      
      expectedMethods.forEach(method => {
        expect(typeof client[method]).toBe('function');
      });
    });

    it('should call sendMessage when invoking gRPC methods', async () => {
      const { createClient } = await import('../baseNodeClient.js');
      const client = createClient();
      
      const testArg = { test: 'data' };
      await client.getVersion(testArg);
      
      expect(mockClient.getVersion).toHaveBeenCalledTimes(1);
      expect(mockSendMessage).toHaveBeenCalledWith(testArg);
    });

    it('should handle multiple method calls independently', async () => {
      const { createClient } = await import('../baseNodeClient.js');
      const client = createClient();
      
      await client.getTipInfo({ param1: 'value1' });
      await client.listHeaders({ param2: 'value2' });
      
      expect(mockClient.getTipInfo).toHaveBeenCalledTimes(1);
      expect(mockClient.listHeaders).toHaveBeenCalledTimes(1);
      expect(mockSendMessage).toHaveBeenCalledTimes(2);
      expect(mockSendMessage).toHaveBeenNthCalledWith(1, { param1: 'value1' });
      expect(mockSendMessage).toHaveBeenNthCalledWith(2, { param2: 'value2' });
    });
  });

  describe('createClient function', () => {
    it('should return the same client instance', async () => {
      const { createClient } = await import('../baseNodeClient.js');
      
      const client1 = createClient();
      const client2 = createClient();
      
      expect(client1).toBe(client2);
    });

    it('should return client with inner property', async () => {
      const { createClient } = await import('../baseNodeClient.js');
      const client = createClient();
      
      expect(client).toHaveProperty('inner');
      expect(client.inner).toBeDefined();
    });
  });

  describe('gRPC method invocation', () => {
    it('should handle searchUtxos method', async () => {
      const { createClient } = await import('../baseNodeClient.js');
      const client = createClient();
      
      const searchParams = { commitment: 'abc123' };
      await client.searchUtxos(searchParams);
      
      expect(mockClient.searchUtxos).toHaveBeenCalledTimes(1);
      expect(mockSendMessage).toHaveBeenCalledWith(searchParams);
    });

    it('should handle searchKernels method', async () => {
      const { createClient } = await import('../baseNodeClient.js');
      const client = createClient();
      
      const kernelParams = { signature: 'def456' };
      await client.searchKernels(kernelParams);
      
      expect(mockClient.searchKernels).toHaveBeenCalledTimes(1);
      expect(mockSendMessage).toHaveBeenCalledWith(kernelParams);
    });

    it('should handle searchPaymentReferences method', async () => {
      const { createClient } = await import('../baseNodeClient.js');
      const client = createClient();
      
      const paymentParams = { reference: 'ghi789' };
      await client.searchPaymentReferences(paymentParams);
      
      expect(mockClient.searchPaymentReferences).toHaveBeenCalledTimes(1);
      expect(mockSendMessage).toHaveBeenCalledWith(paymentParams);
    });

    it('should handle getNetworkDifficulty method', async () => {
      const { createClient } = await import('../baseNodeClient.js');
      const client = createClient();
      
      const difficultyParams = { height: 12345 };
      await client.getNetworkDifficulty(difficultyParams);
      
      expect(mockClient.getNetworkDifficulty).toHaveBeenCalledTimes(1);
      expect(mockSendMessage).toHaveBeenCalledWith(difficultyParams);
    });

    it('should handle getActiveValidatorNodes method', async () => {
      const { createClient } = await import('../baseNodeClient.js');
      const client = createClient();
      
      const validatorParams = { count: 50 };
      await client.getActiveValidatorNodes(validatorParams);
      
      expect(mockClient.getActiveValidatorNodes).toHaveBeenCalledTimes(1);
      expect(mockSendMessage).toHaveBeenCalledWith(validatorParams);
    });

    it('should handle getTokens method', async () => {
      const { createClient } = await import('../baseNodeClient.js');
      const client = createClient();
      
      const tokenParams = { asset_public_key: 'token123' };
      await client.getTokens(tokenParams);
      
      expect(mockClient.getTokens).toHaveBeenCalledTimes(1);
      expect(mockSendMessage).toHaveBeenCalledWith(tokenParams);
    });

    it('should handle getMempoolTransactions method', async () => {
      const { createClient } = await import('../baseNodeClient.js');
      const client = createClient();
      
      const mempoolParams = { sort_by: 'fee' };
      await client.getMempoolTransactions(mempoolParams);
      
      expect(mockClient.getMempoolTransactions).toHaveBeenCalledTimes(1);
      expect(mockSendMessage).toHaveBeenCalledWith(mempoolParams);
    });

    it('should handle getBlocks method', async () => {
      const { createClient } = await import('../baseNodeClient.js');
      const client = createClient();
      
      const blockParams = { heights: [100, 101, 102] };
      await client.getBlocks(blockParams);
      
      expect(mockClient.getBlocks).toHaveBeenCalledTimes(1);
      expect(mockSendMessage).toHaveBeenCalledWith(blockParams);
    });

    it('should handle getHeaderByHash method', async () => {
      const { createClient } = await import('../baseNodeClient.js');
      const client = createClient();
      
      const hashParams = { hash: 'blockhash123' };
      await client.getHeaderByHash(hashParams);
      
      expect(mockClient.getHeaderByHash).toHaveBeenCalledTimes(1);
      expect(mockSendMessage).toHaveBeenCalledWith(hashParams);
    });
  });

  describe('error handling', () => {
    it('should propagate errors from gRPC methods', async () => {
      const error = new Error('gRPC connection failed');
      mockSendMessage.mockRejectedValueOnce(error);
      
      const { createClient } = await import('../baseNodeClient.js');
      const client = createClient();
      
      await expect(client.getVersion({})).rejects.toThrow('gRPC connection failed');
    });

    it('should handle null arguments', async () => {
      const { createClient } = await import('../baseNodeClient.js');
      const client = createClient();
      
      await client.getTipInfo(null);
      
      expect(mockSendMessage).toHaveBeenCalledWith(null);
    });

    it('should handle undefined arguments', async () => {
      const { createClient } = await import('../baseNodeClient.js');
      const client = createClient();
      
      await client.getTipInfo(undefined);
      
      expect(mockSendMessage).toHaveBeenCalledWith(undefined);
    });
  });
});
