#!/usr/bin/env node

/**
 * Module dependencies.
 */

import { app } from "./app.js";
import debugLib from "debug";
import http from "http";
import { getRedisClient } from "./utils/redisClient.js";

import JSONbig from "json-bigint";
const JSONbigFunc = JSONbig({ useNativeBigInt: true });
global.JSON = JSONbigFunc as any;

const debug = debugLib("tari-explorer:server");

// Initialize Redis connection
try {
  getRedisClient();
  console.log('Redis client initialized');
} catch (error) {
  console.warn('Redis initialization failed, will fallback to gRPC only:', error);
}

/**
 * Get port from environment and store in Express.
 */

const port = normalizePort(process.env.PORT || "4000");
app.set("port", port);

/**
 * Create HTTP server.
 */

const server = http.createServer(app);

/**
 * Listen on provided port, on all network interfaces.
 */

server.listen(port);
server.on("error", onError);
server.on("listening", onListening);

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
  const bind =
    typeof addr === "string"
      ? "pipe " + addr
      : "port " + (addr && "port" in addr ? addr.port : "unknown");
  debug("Listening on " + bind);
  console.log("Listening on " + bind);
}
