// Copyright 2025 The Tari Project
// SPDX-License-Identifier: BSD-3-Clause

import grpc from "@grpc/grpc-js";
import {
  BaseNodeDefinition,
  type BaseNodeClient,
} from "./grpc-gen/base_node.js";
import { createChannel, createClient as newClient } from "nice-grpc";

// grpc-js targets are `host:port`, not URLs -- an `https://` scheme is not a
// registered resolver and does not by itself select TLS. Strip the scheme and
// use it to pick credentials, defaulting to the scheme's usual port.
function resolveTarget(address: string) {
  const match = /^(https?):\/\/(.*)$/.exec(address);
  if (!match) {
    return { target: address, secure: false };
  }
  const secure = match[1] === "https";
  const host = match[2].replace(/\/+$/, "");
  const target = host.includes(":") ? host : `${host}:${secure ? 443 : 80}`;
  return { target, secure };
}

function connect(address: string) {
  const { target, secure } = resolveTarget(address);
  const credentials = secure
    ? grpc.credentials.createSsl()
    : grpc.credentials.createInsecure();
  const channel = createChannel(target, credentials, {
    "grpc.max_receive_message_length": 10 * 1024 * 1024,
  }); // 10 MB);
  const client: BaseNodeClient = newClient(BaseNodeDefinition, channel);
  return client;
}

const client = connect(process.env.BASE_NODE_GRPC_URL || "localhost:18142");

function createClient() {
  return client;
}

export { createClient };
