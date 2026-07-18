// Copyright 2025 The Tari Project
// SPDX-License-Identifier: BSD-3-Clause

// Verifies the vendored .proto files still match the pinned upstream commit.
// Exits non-zero on any difference. Run in CI so a hand-edited or stale
// snapshot cannot reach a build.

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { downloadProtos, readPin } from "./protoPin.js";

async function main() {
  const pin = readPin();
  const tmpDir = await fs.promises.mkdtemp(
    path.join(os.tmpdir(), "tari-proto-"),
  );

  try {
    console.log(`Checking ${pin.protoPath} against ${pin.tag} (${pin.sha})`);
    const upstream = await downloadProtos(pin, pin.sha, tmpDir);
    const vendored = (await fs.promises.readdir(pin.protoPath))
      .filter((n) => n.endsWith(".proto"))
      .sort();

    const problems: string[] = [];

    for (const name of upstream) {
      if (!vendored.includes(name)) {
        problems.push(`missing locally: ${name}`);
        continue;
      }
      const [a, b] = await Promise.all([
        fs.promises.readFile(path.join(pin.protoPath, name)),
        fs.promises.readFile(path.join(tmpDir, name)),
      ]);
      if (!a.equals(b)) {
        problems.push(`differs from upstream: ${name}`);
      }
    }

    for (const name of vendored) {
      if (!upstream.includes(name)) {
        problems.push(`not present upstream: ${name}`);
      }
    }

    if (problems.length > 0) {
      console.error(
        `\nVendored protos do not match ${pin.repo}@${pin.tag} (${pin.sha}):`,
      );
      for (const p of problems) {
        console.error(`  - ${p}`);
      }
      console.error(
        "\nRun `npm run proto:refresh` to restore the pinned snapshot,",
      );
      console.error(
        "or `npm run proto:refresh -- <ref>` to move the pin to a new release.",
      );
      process.exit(1);
    }

    console.log(`OK: ${upstream.length} proto files match the pin.`);
  } finally {
    await fs.promises.rm(tmpDir, { recursive: true, force: true });
  }
}

main().catch((err) => {
  console.error("Error:", (err as Error).message);
  process.exit(1);
});
