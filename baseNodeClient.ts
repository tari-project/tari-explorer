// Copyright 2025 The Tari Project
// SPDX-License-Identifier: BSD-3-Clause

import grpc from "@grpc/grpc-js";
import { BaseNodeDefinition, type BaseNodeClient } from "./grpc-gen/base_node.js";
import { createChannel, createClient as newClient } from "nice-grpc";

export function isHttpsUrl(url: string): boolean {
  return url.toLowerCase().startsWith("https://");
}

function getCredentials(url: string): grpc.ChannelCredentials {
  if (isHttpsUrl(url)) {
    // Use system root certificates for public HTTPS endpoints
    return grpc.credentials.createSsl();
  } else {
    // Use insecure credentials for HTTP and plain host:port
    return grpc.credentials.createInsecure();
  }
}

export function normalizeGrpcAddress(url: string): string {
  // Remove protocol prefix for gRPC channel connection (case insensitive)
  return url.replace(/^https?:\/\//i, "");
}

function connect(address: string) {
  const credentials = getCredentials(address);
  const normalizedAddress = normalizeGrpcAddress(address);

  const channel = createChannel(normalizedAddress, credentials, {
    "grpc.max_receive_message_length": 10 * 1024 * 1024,
  });

  const client: BaseNodeClient = newClient(BaseNodeDefinition, channel);
  return client;
}

const client = connect(process.env.BASE_NODE_GRPC_URL || "localhost:18142");

function createClient() {
  return client;
}

export { createClient };
