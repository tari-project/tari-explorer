#!/usr/bin/env node

/**
 * Module dependencies.
 */

import { app, updater } from "./app.js";
import debugLib from "debug";
import http from "http";
import { getRedisClient, closeRedisConnection } from "./utils/redisClient.js";

import JSONbig from "json-bigint";
const JSONbigFunc = JSONbig({ useNativeBigInt: true });
global.JSON = JSONbigFunc as any;

const debug = debugLib("tari-explorer:server");

// Initialize Redis connection
try {
  getRedisClient();
  console.log("Redis client initialized");
} catch (error) {
  console.warn("Redis initialization failed, will fallback to gRPC only:", error);
}

/**
 * Get port from environment and store in Express.
 */

const port = normalizePort(process.env.PORT || "4000");
app.set("port", port);

/**
 * Listen on provided port, on all network interfaces.
 */

const server = http.createServer(app);

/**
 * Wait for background updater startup before starting server
 */
console.log("Waiting for background updater to complete initial startup...");
try {
  await Promise.race([
    updater.waitForStartup(),
    new Promise(
      (_, reject) => setTimeout(() => reject(new Error("Startup timeout")), 30000), // 30 second timeout
    ),
  ]);
  console.log("Background updater startup complete, starting server...");
} catch (error) {
  console.warn("Background updater startup timed out or failed, starting server anyway:", error);
}

/**
 * Listen on provided port, on all network interfaces.
 */

server.listen(port);
server.on("error", onError);
server.on("listening", onListening);

/**
 * Graceful shutdown handling
 */
let isShuttingDown = false;

async function gracefulShutdown(signal: string): Promise<void> {
  if (isShuttingDown) {
    console.log("Shutdown already in progress...");
    return;
  }

  isShuttingDown = true;
  console.log(`Received ${signal}, starting graceful shutdown...`);

  try {
    // Set a timeout for graceful shutdown (30 seconds)
    const shutdownTimeout = setTimeout(() => {
      console.error("Graceful shutdown timed out, forcing exit...");
      process.exit(1);
    }, 30000);

    // 1. Stop accepting new connections
    console.log("Stopping HTTP server...");
    await new Promise<void>((resolve) => {
      server.close((err) => {
        if (err) {
          console.error("Error closing HTTP server:", err);
        } else {
          console.log("HTTP server closed");
        }
        resolve();
      });
    });

    // 2. Stop background updater and cleanup locks
    console.log("Cleaning up background updater...");
    await Promise.race([
      updater.cleanup(),
      new Promise((_, reject) => setTimeout(() => reject(new Error("Updater cleanup timeout")), 10000)),
    ]);

    // 3. Close Redis connection
    console.log("Closing Redis connection...");
    await Promise.race([
      closeRedisConnection(),
      new Promise((_, reject) => setTimeout(() => reject(new Error("Redis cleanup timeout")), 5000)),
    ]);

    clearTimeout(shutdownTimeout);
    console.log("Graceful shutdown completed");
    process.exit(0);
  } catch (error) {
    console.error("Error during graceful shutdown:", error);
    console.log("Forcing exit...");
    process.exit(1);
  }
}

// Handle shutdown signals
process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => gracefulShutdown("SIGINT"));

// Handle uncaught exceptions
process.on("uncaughtException", (error) => {
  console.error("Uncaught Exception:", error);
  gracefulShutdown("uncaughtException");
});

process.on("unhandledRejection", (reason, promise) => {
  console.error("Unhandled Rejection at:", promise, "reason:", reason);
  gracefulShutdown("unhandledRejection");
});

/**
 * Normalize a port into a number, string, or false.
 */

function normalizePort(val: string): number | string | false {
  const port = parseInt(val, 10);

  if (isNaN(port)) {
    // named pipe
    return val;
  }

  if (port >= 0) {
    // port number
    return port;
  }

  return false;
}

/**
 * Event listener for HTTP server "error" event.
 */

/* eslint-disable no-undef */
function onError(error: NodeJS.ErrnoException): void {
  if (error.syscall !== "listen") {
    throw error;
  }

  const bind = typeof port === "string" ? "Pipe " + port : "Port " + port;

  // handle specific listen errors with friendly messages
  switch (error.code) {
    case "EACCES":
      console.error(bind + " requires elevated privileges");
      process.exit(1);
      break;
    case "EADDRINUSE":
      console.error(bind + " is already in use");
      process.exit(1);
      break;
    default:
      throw error;
  }
}

/**
 * Event listener for HTTP server "listening" event.
 */

function onListening(): void {
  const addr = server.address();
  console.log("Address: ", addr);
  const bind = typeof addr === "string" ? "pipe " + addr : "port " + (addr && "port" in addr ? addr.port : "unknown");
  debug("Listening on " + bind);
  console.log("Listening on " + bind);
}
