// Copyright 2022 The Tari Project
// SPDX-License-Identifier: BSD-3-Clause

import { Client } from "@tariproject/base-node-grpc-client";

function createClient() {
  return Client.connect(process.env.BASE_NODE_GRPC_URL || "localhost:18182");
}

export { createClient };
