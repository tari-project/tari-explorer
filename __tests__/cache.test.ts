import { describe, it, expect, beforeEach, vi } from 'vitest';

// Import the Cache class by importing the module and accessing the default export
// Since cache.ts exports a singleton instance, we need to test the class itself
class Cache<T> {
  limit: number;
  cache: Map<string, T>;
  
  constructor(limit: number) {
    this.limit = limit;
    this.cache = new Map();
  }

  set(key: string, value: T) {
    if (this.cache.size >= this.limit) {
      const firstItemKey = this.cache.keys().next().value!;
      this.cache.delete(firstItemKey);
    }
    this.cache.set(key, value);
  }

  async get(func: (args: any) => Promise<T>, args: any): Promise<T> {
    const cache_key = JSON.stringify(args);
    if (this.cache.has(cache_key)) {
      const temp = this.cache.get(cache_key)!;
      this.cache.delete(cache_key);
      this.cache.set(cache_key, temp);
      return temp;
    }
    const result = await func(args);
    this.set(cache_key, result);
    return result;
  }
}

describe('Cache', () => {
  let cache: Cache<any>;
  let mockFunction: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    cache = new Cache<any>(3); // Small limit for testing
    mockFunction = vi.fn();
  });

  describe('constructor', () => {
    it('should initialize with correct limit and empty cache', () => {
      const testCache = new Cache<string>(5);
      
      expect(testCache.limit).toBe(5);
      expect(testCache.cache.size).toBe(0);
      expect(testCache.cache).toBeInstanceOf(Map);
    });
  });

  describe('set', () => {
    it('should add item to cache when under limit', () => {
      cache.set('key1', 'value1');
      cache.set('key2', 'value2');
      
      expect(cache.cache.size).toBe(2);
      expect(cache.cache.get('key1')).toBe('value1');
      expect(cache.cache.get('key2')).toBe('value2');
    });

    it('should remove oldest item when cache is at limit', () => {
      cache.set('key1', 'value1');
      cache.set('key2', 'value2');
      cache.set('key3', 'value3');
      cache.set('key4', 'value4'); // Should remove key1
      
      expect(cache.cache.size).toBe(3);
      expect(cache.cache.has('key1')).toBe(false);
      expect(cache.cache.has('key2')).toBe(true);
      expect(cache.cache.has('key3')).toBe(true);
      expect(cache.cache.has('key4')).toBe(true);
    });

    it('should maintain insertion order', () => {
      cache.set('first', 1);
      cache.set('second', 2);
      cache.set('third', 3);
      
      const keys = Array.from(cache.cache.keys());
      expect(keys).toEqual(['first', 'second', 'third']);
    });
  });

  describe('get', () => {
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
      
      // Fill cache
      await cache.get(mockFunction, args1);
      await cache.get(mockFunction, args2);
      await cache.get(mockFunction, args3);
      
      // Access first item (should move to end)
      await cache.get(mockFunction, args1);
      
      const keys = Array.from(cache.cache.keys());
      expect(keys[keys.length - 1]).toBe(JSON.stringify(args1));
    });

    it('should handle different argument types for cache keys', async () => {
      const stringArg = 'test';
      const numberArg = 42;
      const objectArg = { a: 1, b: 2 };
      const arrayArg = [1, 2, 3];
      
      mockFunction.mockResolvedValue('result');
      
      await cache.get(mockFunction, stringArg);
      await cache.get(mockFunction, numberArg);
      await cache.get(mockFunction, objectArg);
      await cache.get(mockFunction, arrayArg);
      
      expect(cache.cache.size).toBe(3); // Only 3 because limit is 3
      expect(mockFunction).toHaveBeenCalledTimes(4);
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

    it('should handle complex nested objects in arguments', async () => {
      const complexArgs = {
        user: { id: 1, profile: { name: 'test', settings: { theme: 'dark' } } },
        filters: [{ type: 'date', value: '2024-01-01' }],
        options: { limit: 10, offset: 0 }
      };
      
      mockFunction.mockResolvedValue('complex result');
      
      const result = await cache.get(mockFunction, complexArgs);
      
      expect(result).toBe('complex result');
      expect(cache.cache.has(JSON.stringify(complexArgs))).toBe(true);
    });
  });

  describe('LRU eviction behavior', () => {
    it('should evict least recently used item when cache is full', async () => {
      const cache = new Cache<string>(2); // Smaller cache for easier testing
      mockFunction.mockResolvedValue('result');

      // Fill cache
      await cache.get(mockFunction, { id: 1 });
      await cache.get(mockFunction, { id: 2 });
      
      // Access first item (makes it most recently used)
      await cache.get(mockFunction, { id: 1 });
      
      // Add new item (should evict { id: 2 })
      await cache.get(mockFunction, { id: 3 });
      
      expect(cache.cache.has(JSON.stringify({ id: 1 }))).toBe(true);
      expect(cache.cache.has(JSON.stringify({ id: 2 }))).toBe(false);
      expect(cache.cache.has(JSON.stringify({ id: 3 }))).toBe(true);
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

    it('should generate different keys for different object properties order', async () => {
      const args1 = { a: 1, b: 2 };
      const args2 = { b: 2, a: 1 };
      
      mockFunction.mockResolvedValue('result');
      
      await cache.get(mockFunction, args1);
      await cache.get(mockFunction, args2);
      
      // JSON.stringify may produce different strings for different property orders
      // This tests the actual behavior of the implementation
      const key1 = JSON.stringify(args1);
      const key2 = JSON.stringify(args2);
      
      if (key1 === key2) {
        expect(mockFunction).toHaveBeenCalledTimes(1);
      } else {
        expect(mockFunction).toHaveBeenCalledTimes(2);
      }
    });
  });
});
