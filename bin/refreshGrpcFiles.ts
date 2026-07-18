// Copyright 2025 The Tari Project
// SPDX-License-Identifier: BSD-3-Clause

// Refreshes the vendored .proto snapshot.
//
//   npm run proto:refresh              -- restore the protos at the pinned SHA
//   npm run proto:refresh -- v5.5.0    -- move the pin to a new tag/branch
//
// Passing a ref resolves it to an immutable commit SHA and rewrites
// tari-proto.pin.json, so a re-pointed tag can never silently change the build.
// Review the resulting `git diff` -- proto changes routinely break codegen.

import fs from "node:fs";
import path from "node:path";
import { Command } from "commander";
import {
  PIN_FILE,
  downloadProtos,
  readPin,
  resolveRef,
  writePin,
} from "./protoPin.js";

const cli = new Command();
cli
  .name("proto:refresh")
  .description("refresh the vendored Tari proto snapshot")
  .argument(
    "[ref]",
    "tag or branch to move the pin to (e.g. v5.5.0, mainnet). Omit to restore the current pin.",
  );

const ref = cli.parse(process.argv).args[0];

async function main() {
  const pin = readPin();

  let sha = pin.sha;
  let tag = pin.tag;

  if (ref) {
    console.log(`Resolving ${pin.repo}@${ref}...`);
    ({ sha } = await resolveRef(pin.repo, ref));
    tag = ref;
    console.log(`   ${ref} -> ${sha}`);
  } else {
    console.log(`Restoring pinned snapshot ${pin.tag} (${pin.sha})`);
  }

  // Clear the directory first so files deleted upstream do not linger.
  await fs.promises.rm(pin.protoPath, { recursive: true, force: true });
  const names = await downloadProtos(pin, sha, pin.protoPath);

  for (const name of names) {
    console.log(`   downloaded ${path.join(pin.protoPath, name)}`);
  }

  if (ref) {
    writePin({ ...pin, tag, sha });
    console.log(`Updated ${PIN_FILE} -> ${tag} (${sha})`);
  }

  console.log(
    `Done: ${names.length} proto files at ${tag} (${sha.slice(0, 7)}).`,
  );
  console.log("Review `git diff` and run `npm run build` before committing.");
}

main().catch((err) => {
  console.error("Error:", (err as Error).message);
  process.exit(1);
});
