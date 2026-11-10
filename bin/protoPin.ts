// Copyright 2025 The Tari Project
// SPDX-License-Identifier: BSD-3-Clause

// Shared helpers for the vendored Tari protobuf snapshot.
//
// The .proto files under `protoPath` are vendored into this repo rather than
// fetched during the image build, so that builds are hermetic and proto changes
// show up in PR diffs. `tari-proto.pin.json` records exactly which upstream
// commit they came from; `npm run proto:check` re-fetches and fails on drift.

import fs from "node:fs";
import path from "node:path";

export const PIN_FILE = "tari-proto.pin.json";

export interface ProtoPin {
  repo: string;
  protoPath: string;
  // Human-readable ref the snapshot was taken from. Informational only -- `sha`
  // is what is actually fetched, since tags and branches can be re-pointed.
  tag: string;
  sha: string;
}

const REPO_SLUG_PATTERN = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/;

export function isSafeProtoFileName(name: string): boolean {
  return (
    name.endsWith(".proto") &&
    name !== ".proto" &&
    path.posix.basename(name) === name &&
    path.win32.basename(name) === name &&
    !name.includes("..") &&
    !name.includes("/") &&
    !name.includes("\\")
  );
}

export function validatePin(pin: ProtoPin, pinFile = PIN_FILE): ProtoPin {
  for (const key of ["repo", "protoPath", "tag", "sha"] as const) {
    if (typeof pin[key] !== "string" || !pin[key].trim()) {
      throw new Error(`${pinFile} is missing required field "${key}"`);
    }
  }
  const [owner, repoName] = pin.repo.split("/");
  if (
    !REPO_SLUG_PATTERN.test(pin.repo) ||
    owner === "." ||
    owner === ".." ||
    repoName === "." ||
    repoName === ".."
  ) {
    throw new Error(
      `${pinFile} "repo" must be a valid "owner/name" slug, got "${pin.repo}"`,
    );
  }
  const normalizedProtoPath = pin.protoPath.replace(/\\/g, "/");
  const segments = normalizedProtoPath.split("/").filter(Boolean);
  if (
    path.posix.isAbsolute(normalizedProtoPath) ||
    path.win32.isAbsolute(pin.protoPath) ||
    segments.length === 0 ||
    segments.some((seg) => seg === "." || seg === "..")
  ) {
    throw new Error(
      `${pinFile} "protoPath" must be a relative subdirectory inside the repository, got "${pin.protoPath}"`,
    );
  }
  if (!/^[0-9a-f]{40}$/.test(pin.sha)) {
    throw new Error(
      `${pinFile} "sha" must be a full 40-character commit SHA, got "${pin.sha}"`,
    );
  }
  return {
    ...pin,
    protoPath: segments.join("/"),
  };
}

export function readPin(): ProtoPin {
  const pin: ProtoPin = JSON.parse(fs.readFileSync(PIN_FILE, "utf8"));
  return validatePin(pin, PIN_FILE);
}

export function writePin(pin: ProtoPin) {
  const validated = validatePin(pin, PIN_FILE);
  fs.writeFileSync(PIN_FILE, `${JSON.stringify(validated, null, 2)}\n`);
}

async function githubJson<T>(url: string): Promise<T> {
  const headers: Record<string, string> = { "User-Agent": "tari-explorer" };
  // Lifts the unauthenticated 60 req/hr limit when running in CI.
  if (process.env.GITHUB_TOKEN) {
    headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  }
  const res = await fetch(url, { headers });
  if (!res.ok) {
    throw new Error(`GitHub request failed: ${res.status} ${res.statusText}`);
  }
  return res.json() as T;
}

/** Resolve a tag or branch name to the immutable commit SHA it points at. */
export async function resolveRef(
  repo: string,
  ref: string,
): Promise<{ sha: string }> {
  const commit = await githubJson<{ sha: string }>(
    `https://api.github.com/repos/${repo}/commits/${encodeURIComponent(ref)}`,
  );
  if (!commit.sha) {
    throw new Error(`Could not resolve ref "${ref}" in ${repo}`);
  }
  return { sha: commit.sha };
}

/** List the .proto file names present at a given commit. */
export async function listProtoFiles(
  pin: Pick<ProtoPin, "repo" | "protoPath">,
  sha: string,
): Promise<string[]> {
  const encodedPath = pin.protoPath
    .split("/")
    .filter(Boolean)
    .map((segment) => encodeURIComponent(segment))
    .join("/");
  const contents = await githubJson<{ name: string; type: string }[]>(
    `https://api.github.com/repos/${pin.repo}/contents/${encodedPath}?ref=${encodeURIComponent(sha)}`,
  );
  if (!Array.isArray(contents)) {
    throw new Error(
      `Expected directory listing at ${pin.repo}:${pin.protoPath}@${sha}`,
    );
  }
  return contents
    .filter((f) => f.type === "file" && isSafeProtoFileName(f.name))
    .map((f) => f.name)
    .sort();
}

/** Download the .proto files at `sha` into `destDir`. Returns the file names. */
export async function downloadProtos(
  pin: Pick<ProtoPin, "repo" | "protoPath">,
  sha: string,
  destDir: string,
): Promise<string[]> {
  const names = await listProtoFiles(pin, sha);
  await fs.promises.mkdir(destDir, { recursive: true });

  for (const name of names) {
    if (!isSafeProtoFileName(name)) {
      throw new Error(`Refusing to write unsafe proto file name "${name}"`);
    }
    const url = `https://raw.githubusercontent.com/${pin.repo}/${sha}/${pin.protoPath}/${encodeURIComponent(name)}`;
    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`Failed to download ${name}: ${res.status}`);
    }
    await fs.promises.writeFile(
      path.join(destDir, name),
      Buffer.from(await res.arrayBuffer()),
    );
  }

  return names;
}
