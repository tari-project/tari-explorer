class Cache {
  constructor(limit) {
    this.limit = limit;
    this.cache = new Map();
  }

  set(key, value) {
    if (this.cache.size >= this.limit) {
      const firstItemKey = this.cache.keys().next().value;
      this.cache.delete(firstItemKey);
    }
    this.cache.set(key, value);
  }

  async get(func, args) {
    const cache_key = JSON.stringify(args);
    if (this.cache.has(cache_key)) {
      const temp = this.cache.get(cache_key);
      this.cache.delete(cache_key);
      this.cache.set(cache_key, temp);
      return temp;
    }
    const result = await func(args);
    // console.log("Cache: Actual call", args);
    this.set(cache_key, result);
    return result;
  }
}

const cache = new Cache(
  +process.env.TARI_EXPLORER_OLD_BLOCKS_CACHE_SETTINGS || 1000,
);
export default cache;
