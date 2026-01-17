import { handleGrpcResult } from "./utils/grpcHelpers.js";

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

  async get(
    func: (args: any) => Promise<T> | AsyncIterable<T>,
    args: any,
  ): Promise<T | T[]> {
    const cache_key = JSON.stringify(args);
    if (this.cache.has(cache_key)) {
      const temp = this.cache.get(cache_key)!;
      this.cache.delete(cache_key);
      this.cache.set(cache_key, temp);
      return temp;
    }

    const result = await handleGrpcResult(func(args));
    this.set(cache_key, result as any);
    return result;
  }
}

const cache = new Cache<any>(
  +(process.env.TARI_EXPLORER_OLD_BLOCKS_CACHE_SETTINGS || 1000),
);
export default cache;
