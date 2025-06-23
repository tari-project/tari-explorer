import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

describe('cacheSettings', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('should use default values when no environment variables are set', async () => {
    // Clear all cache-related env vars
    delete process.env.TARI_EXPLORER_INDEX_CACHE_SETTINGS;
    delete process.env.TARI_EXPLORER_MEMPOOL_CACHE_SETTINGS;
    delete process.env.TARI_EXPLORER_OLD_BLOCKS_CACHE_SETTINGS;
    delete process.env.TARI_EXPLORER_NEW_BLOCKS_CACHE_SETTINGS;
    delete process.env.TARI_EXPLORER_OLD_BLOCK_DELTA_TIP;

    const cacheSettings = (await import('../cacheSettings.js')).default;

    expect(cacheSettings.index).toBe('public, max-age=120, s-maxage=60, stale-while-revalidate=30');
    expect(cacheSettings.mempool).toBe('public, max-age=15, s-maxage=15, stale-while-revalidate=15');
    expect(cacheSettings.oldBlocks).toBe('public, max-age=604800, s-maxage=604800, stale-while-revalidate=604800');
    expect(cacheSettings.newBlocks).toBe('public, max-age=120, s-maxage=60, stale-while-revalidate=30');
    expect(cacheSettings.oldBlockDeltaTip).toBe(30 * 24 * 7); // 5040
  });

  it('should use environment variables when set', async () => {
    process.env.TARI_EXPLORER_INDEX_CACHE_SETTINGS = 'custom-index-cache';
    process.env.TARI_EXPLORER_MEMPOOL_CACHE_SETTINGS = 'custom-mempool-cache';
    process.env.TARI_EXPLORER_OLD_BLOCKS_CACHE_SETTINGS = 'custom-old-blocks-cache';
    process.env.TARI_EXPLORER_NEW_BLOCKS_CACHE_SETTINGS = 'custom-new-blocks-cache';
    process.env.TARI_EXPLORER_OLD_BLOCK_DELTA_TIP = '1000';

    const cacheSettings = (await import('../cacheSettings.js')).default;

    expect(cacheSettings.index).toBe('custom-index-cache');
    expect(cacheSettings.mempool).toBe('custom-mempool-cache');
    expect(cacheSettings.oldBlocks).toBe('custom-old-blocks-cache');
    expect(cacheSettings.newBlocks).toBe('custom-new-blocks-cache');
    expect(cacheSettings.oldBlockDeltaTip).toBe('1000');
  });

  it('should handle partial environment variable configuration', async () => {
    process.env.TARI_EXPLORER_INDEX_CACHE_SETTINGS = 'custom-index-only';
    process.env.TARI_EXPLORER_OLD_BLOCK_DELTA_TIP = '2000';
    // Leave other env vars undefined

    const cacheSettings = (await import('../cacheSettings.js')).default;

    expect(cacheSettings.index).toBe('custom-index-only');
    expect(cacheSettings.mempool).toBe('public, max-age=15, s-maxage=15, stale-while-revalidate=15'); // default
    expect(cacheSettings.oldBlocks).toBe('public, max-age=604800, s-maxage=604800, stale-while-revalidate=604800'); // default
    expect(cacheSettings.newBlocks).toBe('public, max-age=120, s-maxage=60, stale-while-revalidate=30'); // default
    expect(cacheSettings.oldBlockDeltaTip).toBe('2000');
  });

  it('should handle empty string environment variables', async () => {
    process.env.TARI_EXPLORER_INDEX_CACHE_SETTINGS = '';
    process.env.TARI_EXPLORER_MEMPOOL_CACHE_SETTINGS = '';

    const cacheSettings = (await import('../cacheSettings.js')).default;

    // Empty strings should fallback to defaults due to || operator
    expect(cacheSettings.index).toBe('public, max-age=120, s-maxage=60, stale-while-revalidate=30');
    expect(cacheSettings.mempool).toBe('public, max-age=15, s-maxage=15, stale-while-revalidate=15');
  });

  it('should handle zero value for oldBlockDeltaTip', async () => {
    process.env.TARI_EXPLORER_OLD_BLOCK_DELTA_TIP = '0';

    const cacheSettings = (await import('../cacheSettings.js')).default;

    expect(cacheSettings.oldBlockDeltaTip).toBe('0');
  });

  it('should handle invalid number for oldBlockDeltaTip', async () => {
    process.env.TARI_EXPLORER_OLD_BLOCK_DELTA_TIP = 'invalid-number';

    const cacheSettings = (await import('../cacheSettings.js')).default;

    // The env var is kept as string, not parsed to number
    expect(typeof cacheSettings.oldBlockDeltaTip).toBe('string');
    expect(cacheSettings.oldBlockDeltaTip).toBe('invalid-number');
  });

  describe('default cache values', () => {
    it('should have appropriate cache durations for different content types', async () => {
      delete process.env.TARI_EXPLORER_INDEX_CACHE_SETTINGS;
      delete process.env.TARI_EXPLORER_MEMPOOL_CACHE_SETTINGS;
      delete process.env.TARI_EXPLORER_OLD_BLOCKS_CACHE_SETTINGS;
      delete process.env.TARI_EXPLORER_NEW_BLOCKS_CACHE_SETTINGS;

      const cacheSettings = (await import('../cacheSettings.js')).default;

      // Index: 2 minute cache (frequently changing)
      expect(cacheSettings.index).toContain('max-age=120');
      
      // Mempool: 15 second cache (very frequently changing)
      expect(cacheSettings.mempool).toContain('max-age=15');
      
      // Old blocks: 7 day cache (604800 seconds, immutable)
      expect(cacheSettings.oldBlocks).toContain('max-age=604800');
      
      // New blocks: 2 minute cache (may change due to reorgs)
      expect(cacheSettings.newBlocks).toContain('max-age=120');
    });

    it('should have stale-while-revalidate for all cache types', async () => {
      const cacheSettings = (await import('../cacheSettings.js')).default;

      expect(cacheSettings.index).toContain('stale-while-revalidate=');
      expect(cacheSettings.mempool).toContain('stale-while-revalidate=');
      expect(cacheSettings.oldBlocks).toContain('stale-while-revalidate=');
      expect(cacheSettings.newBlocks).toContain('stale-while-revalidate=');
    });

    it('should default oldBlockDeltaTip to 5040 (30 days * 24 hours * 7)', async () => {
      delete process.env.TARI_EXPLORER_OLD_BLOCK_DELTA_TIP;

      const cacheSettings = (await import('../cacheSettings.js')).default;

      expect(cacheSettings.oldBlockDeltaTip).toBe(5040);
    });
  });
});
