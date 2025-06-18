// Copyright 2025 The Tari Project
// SPDX-License-Identifier: BSD-3-Clause

import grpc from "@grpc/grpc-js";
import {
  BaseNodeDefinition,
  type BaseNodeClient,
} from "./grpc-gen/base_node.js";
import { createChannel, createClient as newClient } from "nice-grpc";

function connect(address: string) {
  const channel = createChannel(address, grpc.credentials.createInsecure(), {
    "grpc.max_receive_message_length": 10 * 1024 * 1024,
  }); // 10 MB);
  const client: BaseNodeClient = newClient(BaseNodeDefinition, channel);
  return client;
}

const client = connect(process.env.BASE_NODE_GRPC_URL || "");

function createClient() {
  return client;
}

export { createClient };
