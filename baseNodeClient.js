// Copyright 2025 The Tari Project
// SPDX-License-Identifier: BSD-3-Clause

import path from "path";
import grpc from "@grpc/grpc-js";
import protoLoader from "@grpc/proto-loader";
import { promisifyAll } from "grpc-promise";

const packageDefinition = protoLoader.loadSync(
  path.resolve(
    import.meta.dirname,
    "applications/minotari_app_grpc/proto/base_node.proto",
  ),
  {
    keepCase: true,
    longs: String,
    enums: String,
    defaults: true,
    oneofs: true,
  },
);
const protoDescriptor = grpc.loadPackageDefinition(packageDefinition);
const tariGrpc = protoDescriptor.tari.rpc;

function connect(address) {
  const client = new tariGrpc.BaseNode(
    address,
    grpc.credentials.createInsecure(),
    { "grpc.max_receive_message_length": 10 * 1024 * 1024 }, // 10 MB
  );
  promisifyAll(client, { metadata: new grpc.Metadata(), timeout: 10_000 });
  return client;
}

function Client(address = "localhost:18142") {
  this.inner = connect(address);
  const methods = [
    "getVersion",
    "listHeaders",
    "getBlocks",
    "getMempoolTransactions",
    "getTipInfo",
    "searchUtxos",
    "getTokens",
    "getNetworkDifficulty",
    "getActiveValidatorNodes",
    "getHeaderByHash",
    "searchKernels",
  ];
  methods.forEach((method) => {
    this[method] = (arg) => this.inner[method]().sendMessage(arg);
  });
}
const client = new Client(process.env.BASE_NODE_GRPC_URL);

function createClient() {
  return client;
}

export { createClient };
