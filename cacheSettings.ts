const cacheSettings = {
  index:
    process.env.TARI_EXPLORER_INDEX_CACHE_SETTINGS ||
    "public, max-age=120, s-maxage=60, stale-while-revalidate=30",
  mempool:
    process.env.TARI_EXPLORER_MEMPOOL_CACHE_SETTINGS ||
    "public, max-age=15, s-maxage=15, stale-while-revalidate=15",
  oldBlocks:
    process.env.TARI_EXPLORER_OLD_BLOCKS_CACHE_SETTINGS ||
    "public, max-age=604800, s-maxage=604800, stale-while-revalidate=604800",
  newBlocks:
    process.env.TARI_EXPLORER_NEW_BLOCKS_CACHE_SETTINGS ||
    "public, max-age=120, s-maxage=60, stale-while-revalidate=30",
  oldBlockDeltaTip: (process.env.TARI_EXPLORER_OLD_BLOCK_DELTA_TIP ||
    30 * 24 * 7) as number,
};

export default cacheSettings;
