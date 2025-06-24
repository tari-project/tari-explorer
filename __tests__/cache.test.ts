import { describe, it, expect, beforeEach, vi } from 'vitest';
import cache from '../cache.js';

describe('Cache singleton', () => {
  let mockFunction: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    // Clear the cache before each test
    cache.cache.clear();
    mockFunction = vi.fn();
  });

  describe('singleton instance', () => {
    it('should have correct default limit from environment', () => {
      expect(cache.limit).toBe(1000); // default value
      expect(cache.cache).toBeInstanceOf(Map);
    });
  });

  describe('get method', () => {
    it('should call function and cache result when key not in cache', async () => {
      const args = { id: 1, name: 'test' };
      const expectedResult = { data: 'result' };
      mockFunction.mockResolvedValue(expectedResult);

      const result = await cache.get(mockFunction, args);

      expect(mockFunction).toHaveBeenCalledTimes(1);
      expect(mockFunction).toHaveBeenCalledWith(args);
      expect(result).toBe(expectedResult);
      expect(cache.cache.get(JSON.stringify(args))).toBe(expectedResult);
    });

    it('should return cached value without calling function when key exists', async () => {
      const args = { id: 1, name: 'test' };
      const cachedResult = { data: 'cached' };
      
      // First call to populate cache
      mockFunction.mockResolvedValue(cachedResult);
      await cache.get(mockFunction, args);
      
      // Reset mock for second call
      mockFunction.mockClear();
      mockFunction.mockResolvedValue({ data: 'new' });
      
      const result = await cache.get(mockFunction, args);

      expect(mockFunction).not.toHaveBeenCalled();
      expect(result).toBe(cachedResult);
    });

    it('should move accessed item to end (LRU behavior)', async () => {
      const args1 = { id: 1 };
      const args2 = { id: 2 };
      const args3 = { id: 3 };
      
      mockFunction.mockResolvedValueOnce('result1');
      mockFunction.mockResolvedValueOnce('result2');
      mockFunction.mockResolvedValueOnce('result3');
      
      // Fill cache partially
      await cache.get(mockFunction, args1);
      await cache.get(mockFunction, args2);
      await cache.get(mockFunction, args3);
      
      // Access first item (should move to end)
      await cache.get(mockFunction, args1);
      
      const keys = Array.from(cache.cache.keys());
      expect(keys[keys.length - 1]).toBe(JSON.stringify(args1));
    });

    it('should handle async function errors', async () => {
      const args = { id: 1 };
      const error = new Error('Function failed');
      mockFunction.mockRejectedValue(error);

      await expect(cache.get(mockFunction, args)).rejects.toThrow('Function failed');
      
      // Should not cache failed results
      expect(cache.cache.has(JSON.stringify(args))).toBe(false);
    });

    it('should cache null and undefined values', async () => {
      const nullArgs = { type: 'null' };
      const undefinedArgs = { type: 'undefined' };
      
      mockFunction.mockResolvedValueOnce(null);
      mockFunction.mockResolvedValueOnce(undefined);
      
      const nullResult = await cache.get(mockFunction, nullArgs);
      const undefinedResult = await cache.get(mockFunction, undefinedArgs);
      
      expect(nullResult).toBe(null);
      expect(undefinedResult).toBe(undefined);
      expect(cache.cache.get(JSON.stringify(nullArgs))).toBe(null);
      expect(cache.cache.get(JSON.stringify(undefinedArgs))).toBe(undefined);
    });
  });

  describe('set method', () => {
    it('should add item to cache directly', () => {
      cache.set('key1', 'value1');
      cache.set('key2', 'value2');
      
      expect(cache.cache.get('key1')).toBe('value1');
      expect(cache.cache.get('key2')).toBe('value2');
    });

    it('should remove oldest item when cache reaches limit', () => {
      // Fill cache to near limit
      for (let i = 0; i < cache.limit; i++) {
        cache.set(`key${i}`, `value${i}`);
      }
      
      // Add one more item
      cache.set('overflow', 'value');
      
      expect(cache.cache.size).toBe(cache.limit);
      expect(cache.cache.has('key0')).toBe(false); // First item should be evicted
      expect(cache.cache.get('overflow')).toBe('value');
    });
  });

  describe('cache key generation', () => {
    it('should generate same key for equivalent objects', async () => {
      const args1 = { a: 1, b: 2 };
      const args2 = { a: 1, b: 2 };
      
      mockFunction.mockResolvedValue('result');
      
      await cache.get(mockFunction, args1);
      await cache.get(mockFunction, args2);
      
      // Should only call function once since args are equivalent
      expect(mockFunction).toHaveBeenCalledTimes(1);
    });

    it('should handle different argument types', async () => {
      const stringArg = 'test';
      const numberArg = 42;
      const objectArg = { a: 1, b: 2 };
      const arrayArg = [1, 2, 3];
      
      mockFunction.mockResolvedValue('result');
      
      await cache.get(mockFunction, stringArg);
      await cache.get(mockFunction, numberArg);
      await cache.get(mockFunction, objectArg);
      await cache.get(mockFunction, arrayArg);
      
      expect(mockFunction).toHaveBeenCalledTimes(4);
      expect(cache.cache.size).toBe(4);
    });
  });
});
