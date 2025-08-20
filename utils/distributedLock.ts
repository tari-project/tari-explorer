// Copyright 2025 The Tari Project
// SPDX-License-Identifier: BSD-3-Clause

import { getRedisClient } from './redisClient.js';
import { pino } from 'pino';
import { hostname } from 'os';

const logger = pino({ name: 'distributed-lock' });

export class DistributedLock {
  private static instance: DistributedLock;
  private lockRenewals: Map<string, ReturnType<typeof setInterval>> = new Map();

  private constructor() { }

  public static getInstance(): DistributedLock {
    if (!DistributedLock.instance) {
      DistributedLock.instance = new DistributedLock();
    }
    return DistributedLock.instance;
  }

  /**
   * Acquire a distributed lock
   * @param lockKey Redis key for the lock
   * @param lockId Unique identifier for this lock instance (hostname-pid-timestamp)
   * @param ttlSeconds Lock expiration time in seconds
   * @param autoRenew Whether to automatically renew the lock before expiration
   * @returns Promise<boolean> true if lock acquired, false otherwise
   */
  async acquire(
    lockKey: string,
    lockId: string,
    ttlSeconds: number = 300,
    autoRenew: boolean = true
  ): Promise<boolean> {
    try {
      const client = getRedisClient();

      // Use SET with NX (not exists) and EX (expiration) for atomic lock acquisition
      const result = await client.set(lockKey, lockId, 'EX', ttlSeconds, 'NX');

      if (result === 'OK') {
        logger.info(`Lock acquired: ${lockKey} by ${lockId} for ${ttlSeconds}s`);

        // Set up auto-renewal if requested
        if (autoRenew) {
          this.setupAutoRenewal(lockKey, lockId, ttlSeconds);
        }

        return true;
      } else {
        // Lock is held by another instance, check who
        const currentHolder = await client.get(lockKey);
        logger.debug(`Lock ${lockKey} is held by: ${currentHolder}`);
        return false;
      }
    } catch (error) {
      logger.error(error, `Error acquiring lock: ${lockKey}`);
      return false;
    }
  }

  /**
   * Release a distributed lock
   * @param lockKey Redis key for the lock
   * @param lockId Lock identifier that must match the current lock holder
   * @returns Promise<boolean> true if lock released, false if not held by this instance
   */
  async release(lockKey: string, lockId: string): Promise<boolean> {
    // Cancel auto-renewal if it exists
    this.cancelAutoRenewal(lockKey);

    try {
      const client = getRedisClient();

      // Use Lua script to atomically check and delete lock
      // Only delete if the lock is held by this instance (lockId matches)
      const luaScript = `
        if redis.call("GET", KEYS[1]) == ARGV[1] then
          return redis.call("DEL", KEYS[1])
        else
          return 0
        end
      `;

      const result = await client.eval(luaScript, 1, lockKey, lockId) as number;

      if (result === 1) {
        logger.info(`Lock released: ${lockKey} by ${lockId}`);
        return true;
      } else {
        logger.warn(`Failed to release lock ${lockKey} - not held by ${lockId}`);
        return false;
      }
    } catch (error) {
      logger.error(error, `Error releasing lock: ${lockKey}`);
      return false;
    }
  }

  /**
   * Extend the TTL of an existing lock
   * @param lockKey Redis key for the lock
   * @param lockId Lock identifier that must match the current lock holder
   * @param ttlSeconds New TTL in seconds
   * @returns Promise<boolean> true if lock renewed, false otherwise
   */
  async renew(lockKey: string, lockId: string, ttlSeconds: number = 300): Promise<boolean> {
    try {
      const client = getRedisClient();

      // Use Lua script to atomically check ownership and extend TTL
      const luaScript = `
        if redis.call("GET", KEYS[1]) == ARGV[1] then
          return redis.call("EXPIRE", KEYS[1], ARGV[2])
        else
          return 0
        end
      `;

      const result = await client.eval(luaScript, 1, lockKey, lockId, ttlSeconds.toString()) as number;

      if (result === 1) {
        logger.debug(`Lock renewed: ${lockKey} by ${lockId} for ${ttlSeconds}s`);
        return true;
      } else {
        logger.warn(`Failed to renew lock ${lockKey} - not held by ${lockId}`);
        return false;
      }
    } catch (error) {
      logger.error(error, `Error renewing lock: ${lockKey}`);
      return false;
    }
  }

  /**
   * Check if a lock is currently held
   * @param lockKey Redis key for the lock
   * @returns Promise<{held: boolean, holder?: string, ttl?: number}>
   */
  async status(lockKey: string): Promise<{ held: boolean, holder?: string, ttl?: number }> {
    try {
      const client = getRedisClient();

      const [holder, ttl] = await Promise.all([
        client.get(lockKey),
        client.ttl(lockKey)
      ]);

      if (holder && ttl > 0) {
        return { held: true, holder, ttl };
      } else {
        return { held: false };
      }
    } catch (error) {
      logger.error(error, `Error checking lock status: ${lockKey}`);
      return { held: false };
    }
  }

  /**
   * Generate a unique lock identifier for this instance
   * @returns string Format: hostname-pid-timestamp
   */
  generateLockId(): string {
    return `${hostname()}-${process.pid}-${Date.now()}`;
  }

  /**
   * Set up automatic lock renewal
   * @private
   */
  private setupAutoRenewal(lockKey: string, lockId: string, ttlSeconds: number): void {
    // Renew at 70% of TTL to ensure we don't lose the lock
    const renewInterval = Math.floor(ttlSeconds * 0.7 * 1000);

    const renewalTimer = setInterval(async () => {
      const renewed = await this.renew(lockKey, lockId, ttlSeconds);
      if (!renewed) {
        logger.warn(`Failed to auto-renew lock ${lockKey}, cancelling renewal`);
        this.cancelAutoRenewal(lockKey);
      }
    }, renewInterval);

    this.lockRenewals.set(lockKey, renewalTimer);
    logger.debug(`Auto-renewal set up for lock ${lockKey}, interval: ${renewInterval}ms`);
  }

  /**
   * Cancel automatic lock renewal
   * @private
   */
  private cancelAutoRenewal(lockKey: string): void {
    const renewalTimer = this.lockRenewals.get(lockKey);
    if (renewalTimer) {
      clearInterval(renewalTimer);
      this.lockRenewals.delete(lockKey);
      logger.debug(`Auto-renewal cancelled for lock ${lockKey}`);
    }
  }

  /**
   * Clean up all auto-renewals (called on shutdown)
   */
  cleanup(): void {
    for (const [lockKey, timer] of this.lockRenewals) {
      clearInterval(timer);
      logger.debug(`Cleaned up auto-renewal for lock ${lockKey}`);
    }
    this.lockRenewals.clear();
  }
}

// Singleton instance
export default DistributedLock.getInstance();
