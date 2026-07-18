// Copyright 2025 The Tari Project
// SPDX-License-Identifier: BSD-3-Clause

// Downloads a minotari_node binary to run locally for development.
//
// This is a dev-runtime convenience and has nothing to do with proto codegen --
// see bin/refreshGrpcFiles.ts for that. By default it fetches the node matching
// the pinned proto tag, so the local node speaks the API the client is built
// against.

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { Readable } from "node:stream";
import { finished } from "node:stream/promises";
import AdmZip from "adm-zip";
import { Command } from "commander";
import { readPin } from "./protoPin.js";

const MINOTARI_NODE_EXEC_NAME = "minotari_node";
const MINOTARI_NODE_PATH = "./applications/minotari-node";

const cli = new Command();
cli
  .name("node:download")
  .description("download a minotari_node binary for local development")
  .argument(
    "[tag]",
    "release tag to download. Defaults to the tag in tari-proto.pin.json.",
  );

const tagArg = cli.parse(process.argv).args[0];

/** Map Node's platform/arch onto the naming used by Tari release assets. */
function getTariArch(): string {
  const platform = os.platform();
  const arch = os.arch();

  const platformName =
    platform === "win32"
      ? "windows"
      : platform === "darwin"
        ? "macos"
        : platform;

  // arm64 and riscv64 are named identically on both sides.
  const archName = arch === "x64" ? "x86_64" : arch;

  return `${platformName}-${archName}`;
}

async function downloadFile(url: string, destination: string) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to download file: ${response.status}`);
  }
  if (!response.body) {
    throw new Error("Failed to find the body of the file");
  }
  await finished(
    Readable.fromWeb(response.body as never).pipe(
      fs.createWriteStream(destination),
    ),
  );
}

async function main() {
  const pin = readPin();
  const tag = tagArg || pin.tag;
  const suitePattern = new RegExp(`tari_suite-.*-${getTariArch()}\\.zip`);

  const release = await fetch(
    `https://api.github.com/repos/${pin.repo}/releases/tags/${tag}`,
    { headers: { "User-Agent": "tari-explorer" } },
  ).then((res) => {
    if (!res.ok) {
      throw new Error(`No release found for tag ${tag} (${res.status})`);
    }
    return res.json() as Promise<{
      assets: { name: string; browser_download_url: string }[];
    }>;
  });

  const asset = release.assets.find((a) => suitePattern.test(a.name));
  if (!asset) {
    throw new Error(
      `No asset in ${tag} matching ${suitePattern}. Available: ${release.assets
        .map((a) => a.name)
        .join(", ")}`,
    );
  }

  await fs.promises.mkdir(MINOTARI_NODE_PATH, { recursive: true });
  const localPath = path.join(
    MINOTARI_NODE_PATH,
    path.basename(asset.browser_download_url),
  );

  console.log(`Downloading ${asset.name} (${tag})...`);
  await downloadFile(asset.browser_download_url, localPath);

  const zip = new AdmZip(localPath);
  const entry = zip
    .getEntries()
    .find((e) => e.name === MINOTARI_NODE_EXEC_NAME);
  if (!entry) {
    throw new Error(`no ${MINOTARI_NODE_EXEC_NAME} found in ${asset.name}`);
  }

  zip.extractEntryTo(entry, MINOTARI_NODE_PATH, true, true);
  fs.unlinkSync(localPath);

  console.log(
    `Extracted ${MINOTARI_NODE_EXEC_NAME} to ${MINOTARI_NODE_PATH} (${tag})`,
  );
}

main().catch((err) => {
  console.error("Error:", (err as Error).message);
  process.exit(1);
});
