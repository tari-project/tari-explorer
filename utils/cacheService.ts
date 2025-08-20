// Copyright 2025 The Tari Project
// SPDX-License-Identifier: BSD-3-Clause

import { getRedisClient, isRedisConnected, getConnectionStatus } from './redisClient.js';
import { sanitizeBigInts } from './sanitizeObject.js';
import { pino } from 'pino';

const logger = pino({ name: 'cache-service' });

export class CacheService {
  private static instance: CacheService;

  private constructor() {}

  public static getInstance(): CacheService {
    if (!CacheService.instance) {
      CacheService.instance = new CacheService();
    }
    return CacheService.instance;
  }

  async get<T>(key: string): Promise<T | null> {
    if (!isRedisConnected()) {
      logger.warn(`Redis not connected, cannot get key: ${key}`);
      return null;
    }

    try {
      const client = getRedisClient();
      const data = await client.get(key);
      
      if (data === null) {
        logger.debug(`Cache miss for key: ${key}`);
        return null;
      }

      logger.debug(`Cache hit for key: ${key}`);
      return JSON.parse(data) as T;
    } catch (error) {
      logger.error(error, `Error getting cache key: ${key}`);
      return null;
    }
  }

  async set<T>(key: string, value: T, ttlSeconds?: number): Promise<boolean> {
    try {
      const client = getRedisClient();
      
      if (!isRedisConnected()) {
        logger.warn(`Redis not ready, queueing set operation for key: ${key}`);
        // ioredis will queue this command until connection is ready
      }
      
      // Sanitize BigInts before serializing
      const sanitizedValue = sanitizeBigInts(value);
      const serializedValue = JSON.stringify(sanitizedValue);

      if (ttlSeconds) {
        await client.setex(key, ttlSeconds, serializedValue);
      } else {
        await client.set(key, serializedValue);
      }

      logger.debug(`Cache set for key: ${key}${ttlSeconds ? ` (TTL: ${ttlSeconds}s)` : ''}`);
      return true;
    } catch (error) {
      logger.error(error, `Error setting cache key: ${key}`);
      return false;
    }
  }

  async delete(key: string): Promise<boolean> {
    if (!isRedisConnected()) {
      logger.warn(`Redis not connected, cannot delete key: ${key}`);
      return false;
    }

    try {
      const client = getRedisClient();
      const result = await client.del(key);
      logger.debug(`Cache delete for key: ${key}, deleted: ${result > 0}`);
      return result > 0;
    } catch (error) {
      logger.error(error, `Error deleting cache key: ${key}`);
      return false;
    }
  }

  async exists(key: string): Promise<boolean> {
    if (!isRedisConnected()) {
      return false;
    }

    try {
      const client = getRedisClient();
      const result = await client.exists(key);
      return result === 1;
    } catch (error) {
      logger.error(error, `Error checking cache key existence: ${key}`);
      return false;
    }
  }

  async deletePattern(pattern: string): Promise<number> {
    if (!isRedisConnected()) {
      logger.warn(`Redis not connected, cannot delete pattern: ${pattern}`);
      return 0;
    }

    try {
      const client = getRedisClient();
      
      // Use ioredis scanStream for better performance
      const keys: string[] = [];
      const stream = client.scanStream({
        match: pattern,
        count: 100
      });
      
      for await (const resultKeys of stream) {
        keys.push(...resultKeys);
      }

      if (keys.length === 0) {
        return 0;
      }

      // Delete all matching keys
      const deletedCount = await client.del(...keys);
      logger.debug(`Cache delete pattern: ${pattern}, deleted: ${deletedCount} keys`);
      return deletedCount;
    } catch (error) {
      logger.error(error, `Error deleting cache pattern: ${pattern}`);
      return 0;
    }
  }

  async setMultiple<T>(data: Array<{ key: string; value: T; ttlSeconds?: number }>): Promise<number> {
    if (!isRedisConnected()) {
      logger.warn('Redis not connected, cannot set multiple keys');
      return 0;
    }

    let successCount = 0;
    
    for (const item of data) {
      const success = await this.set(item.key, item.value, item.ttlSeconds);
      if (success) {
        successCount++;
      }
    }

    logger.debug(`Cache set multiple: ${successCount}/${data.length} keys set successfully`);
    return successCount;
  }

  isConnected(): boolean {
    return isRedisConnected();
  }
  
  getConnectionStatus(): string {
    return getConnectionStatus();
  }
  
  async ping(): Promise<boolean> {
    try {
      const client = getRedisClient();
      const result = await client.ping();
      return result === 'PONG';
    } catch (error) {
      logger.error(error, 'Redis ping failed');
      return false;
    }
  }
}

export default CacheService.getInstance();
