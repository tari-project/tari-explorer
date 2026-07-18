import { handleGrpcResult } from "./utils/grpcHelpers.js";
import JSONbig from "json-bigint";
JSONbig({ useNativeBigInt: true });

const DEFAULT_CACHE_SIZE = 1000;

class Cache<T> {
  limit: number;
  cache: Map<string, T>;
  constructor(limit: number) {
    // A non-numeric or non-positive limit would silently disable eviction --
    // every `size >= NaN` comparison is false -- so fall back to the default.
    this.limit =
      Number.isFinite(limit) && limit > 0
        ? Math.floor(limit)
        : DEFAULT_CACHE_SIZE;
    this.cache = new Map();
  }

  set(key: string, value: T) {
    while (this.cache.size >= this.limit) {
      const firstItemKey = this.cache.keys().next().value;
      if (firstItemKey === undefined) break;
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
  +(process.env.TARI_EXPLORER_BLOCK_CACHE_SIZE || DEFAULT_CACHE_SIZE),
);
export default cache;
