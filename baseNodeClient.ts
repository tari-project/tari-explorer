// Copyright 2025 The Tari Project
// SPDX-License-Identifier: BSD-3-Clause

import path from "path";
import grpc from "@grpc/grpc-js";
import protoLoader from "@grpc/proto-loader";
import { promisifyAll } from "grpc-promise";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const pathToProtoFiles = path.resolve(
  __dirname,
  "../applications/minotari_app_grpc/proto/base_node.proto",
);

const packageDefinition = protoLoader.loadSync(pathToProtoFiles, {
  keepCase: true,
  longs: String,
  enums: String,
  defaults: true,
  oneofs: true,
});
const protoDescriptor = grpc.loadPackageDefinition(packageDefinition);
const tariGrpc = (protoDescriptor as any).tari.rpc;

function connect(address: string) {
  const client = new tariGrpc.BaseNode(
    address,
    grpc.credentials.createInsecure(),
    { "grpc.max_receive_message_length": 10 * 1024 * 1024 }, // 10 MB
  );
  promisifyAll(client, { metadata: new grpc.Metadata(), timeout: 10_000 });
  return client;
}

class Client {
  inner: any;
  [key: string]: any;
  constructor(address: string = "localhost:18142") {
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
      this[method] = (arg: any) => this.inner[method]().sendMessage(arg);
    });
  }
}
const client = new Client(process.env.BASE_NODE_GRPC_URL);

function createClient() {
  return client;
}

export { createClient };
