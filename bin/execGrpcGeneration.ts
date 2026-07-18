// Copyright 2025 The Tari Project
// SPDX-License-Identifier: BSD-3-Clause

// Runs protoc for the current platform. The two npm scripts differ only in how
// the ts_proto plugin is referenced (Windows needs the .cmd shim).
//
// stdio is inherited and the exit status is propagated: a codegen failure must
// fail `npm run build` rather than leaving stale generated code in grpc-gen/.

import { spawnSync } from "node:child_process";
import os from "node:os";

const script =
  os.platform() === "win32" ? "grpc:generate:win" : "grpc:generate:unix";

const result = spawnSync("npm", ["run", script], {
  stdio: "inherit",
  shell: os.platform() === "win32",
});

if (result.error) {
  console.error(`Failed to run ${script}: ${result.error.message}`);
  process.exit(1);
}

if (result.status !== 0) {
  console.error(
    `gRPC code generation failed (${script} exited ${result.status})`,
  );
  process.exit(result.status ?? 1);
}
