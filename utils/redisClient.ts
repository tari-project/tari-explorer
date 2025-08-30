// Copyright 2025 The Tari Project
// SPDX-License-Identifier: BSD-3-Clause

import { Redis } from "ioredis";
import { pino } from "pino";

const logger = pino({ name: "redis-client" });

let client: Redis | null = null;
let connecting = false;

// Create client instance once with optimal configuration
function createRedisClient(): Redis {
  const redisUrl = process.env.REDIS_URL || "redis://localhost:6379";
  const password = process.env.REDIS_PASSWORD;

  const options = {
    // Connection settings
    connectTimeout: 10000,
    commandTimeout: 5000,
    lazyConnect: false, // Connect immediately

    // Retry configuration
    retryDelayOnFailover: 100,
    maxRetriesPerRequest: 3,
    retryStrategy: (times: number) => {
      const delay = Math.min(times * 50, 2000);
      logger.warn(`Redis retry attempt ${times}, waiting ${delay}ms`);
      return delay;
    },

    // Reconnection settings
    enableReadyCheck: true,
    keepAlive: 30000, // Keep connection alive

    // Error handling
    reconnectOnError: (err: Error) => {
      const targetErrors = ["READONLY", "ECONNRESET", "ETIMEDOUT"];
      return targetErrors.some((target) => err.message.includes(target));
    },

    // Performance optimizations
    enableAutoPipelining: true,
    family: 4, // Use IPv4

    // Password if provided
    ...(password && { password }),
  };

  const redisClient = new Redis(redisUrl, options);

  // Set up event listeners
  redisClient.on("connect", () => {
    logger.info("Redis client connected");
  });

  redisClient.on("ready", () => {
    logger.info("Redis client ready");
    connecting = false;
  });

  redisClient.on("error", (err) => {
    logger.error(err, "Redis client error");
    connecting = false;
  });

  redisClient.on("close", () => {
    logger.warn("Redis client disconnected");
  });

  redisClient.on("reconnecting", (ms: number) => {
    logger.info(`Redis client reconnecting in ${ms}ms`);
  });

  return redisClient;
}

// Singleton pattern with proper connection management
export function getRedisClient(): Redis {
  if (!client) {
    if (connecting) {
      // If we're in the middle of connecting, wait a bit and return the client
      // ioredis handles queuing commands until connection is ready
      return client!;
    }

    connecting = true;
    client = createRedisClient();
    logger.info("Redis client instance created");
  }

  return client;
}

// Check connection status using ioredis built-in status
export function isRedisConnected(): boolean {
  return client?.status === "ready";
}

// Get connection status for monitoring
export function getConnectionStatus(): string {
  return client?.status || "not-initialized";
}

// Graceful shutdown
export async function closeRedisConnection(): Promise<void> {
  if (client) {
    try {
      await client.disconnect(false); // false = don't reconnect
      logger.info("Redis connection closed gracefully");
    } catch (error) {
      logger.error(error, "Error closing Redis connection");
    } finally {
      client = null;
      connecting = false;
    }
  }
}
