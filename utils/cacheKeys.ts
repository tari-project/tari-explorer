// Copyright 2025 The Tari Project
// SPDX-License-Identifier: BSD-3-Clause

const CACHE_PREFIX = 'tari';

export const CacheKeys = {
  // Dashboard data - aggregated info for main page
  DASHBOARD_DATA: `${CACHE_PREFIX}:dashboard:data`,
  
  // Recent blocks with pagination
  RECENT_BLOCKS: (from: number, limit: number) => 
    `${CACHE_PREFIX}:blocks:recent:${from}:${limit}`,
  
  // Current mempool transactions
  MEMPOOL_CURRENT: `${CACHE_PREFIX}:mempool:current`,
  
  // Recent mining statistics
  MINING_STATS_RECENT: `${CACHE_PREFIX}:mining:stats:recent`,
  
  // Current blockchain tip
  TIP_CURRENT: `${CACHE_PREFIX}:tip:current`,
  
  // Network difficulty and hash rates
  NETWORK_STATS: `${CACHE_PREFIX}:network:stats`,
  
  // Active validator nodes
  VALIDATOR_NODES: `${CACHE_PREFIX}:validators:active`,
  
  // Search results cache (if needed)
  SEARCH_RESULT: (query: string) => 
    `${CACHE_PREFIX}:search:${query}`,
} as const;

export default CacheKeys;