import assert from "node:assert/strict";
import test from "node:test";
import { sanitizeBigInts } from "./sanitizeObject.js";
import { parseOldBlockDeltaTip } from "../cacheSettings.js";
import { isSafeProtoFileName, validatePin } from "../bin/protoPin.js";
import {
  getMinotariNodeExecName,
  getTariArch,
} from "../bin/downloadMinotariNode.js";

test("sanitizeBigInts converts shared DAG references and cyclic graphs without leaking raw BigInts", () => {
  const shared = { height: 42n, fee: 7n };
  const payload = { first: shared, second: shared, list: [shared] };
  const sanitized = sanitizeBigInts(payload);

  assert.equal(sanitized.first.height, "42");
  assert.equal(sanitized.second.height, "42");
  assert.equal(sanitized.list[0].fee, "7");
  assert.equal(sanitized.first, sanitized.second);
  assert.doesNotThrow(() => JSON.stringify(sanitized));

  const cyclic: Record<string, unknown> = { supply: 1000n };
  cyclic.self = cyclic;
  const sanitizedCyclic = sanitizeBigInts(cyclic);
  assert.equal(sanitizedCyclic.supply, "1000");
  assert.equal(sanitizedCyclic.self, sanitizedCyclic);
});

test("sanitizeBigInts preserves Date, RegExp, and Buffer instances", () => {
  const now = new Date("2026-01-01T00:00:00.000Z");
  const pattern = /tari/i;
  const buf = Buffer.from([1, 2, 3]);
  const sanitized = sanitizeBigInts({
    now,
    pattern,
    buf,
    amount: 99n,
  });

  assert.equal(sanitized.now, now);
  assert.equal(sanitized.pattern, pattern);
  assert.equal(sanitized.buf, buf);
  assert.equal(sanitized.amount, "99");
});

test("parseOldBlockDeltaTip returns numeric values and falls back on invalid input", () => {
  assert.equal(parseOldBlockDeltaTip(undefined), 5040);
  assert.equal(parseOldBlockDeltaTip("1200"), 1200);
  assert.equal(parseOldBlockDeltaTip("  0  "), 0);
  assert.equal(parseOldBlockDeltaTip("-10"), 5040);
  assert.equal(parseOldBlockDeltaTip("abc"), 5040);
  assert.equal(parseOldBlockDeltaTip(""), 5040);
});

test("validatePin and isSafeProtoFileName reject unsafe repo slugs, path traversal, and invalid filenames", () => {
  const validPin = {
    repo: "tari-project/tari",
    protoPath: "applications/minotari_app_grpc/proto",
    tag: "v5.2.0",
    sha: "0123456789abcdef0123456789abcdef01234567",
  };
  assert.deepEqual(validatePin(validPin), validPin);

  assert.throws(
    () => validatePin({ ...validPin, protoPath: "." }),
    /relative subdirectory/,
  );
  assert.throws(
    () => validatePin({ ...validPin, protoPath: "../outside" }),
    /relative subdirectory/,
  );
  assert.throws(
    () => validatePin({ ...validPin, protoPath: "/etc/passwd" }),
    /relative subdirectory/,
  );
  assert.throws(
    () => validatePin({ ...validPin, repo: "../evil" }),
    /valid "owner\/name" slug/,
  );

  assert.equal(isSafeProtoFileName("base_node.proto"), true);
  assert.equal(isSafeProtoFileName("../base_node.proto"), false);
  assert.equal(isSafeProtoFileName("sub/base_node.proto"), false);
  assert.equal(isSafeProtoFileName("base_node.txt"), false);
});

test("getMinotariNodeExecName and getTariArch map platforms accurately", () => {
  assert.equal(getMinotariNodeExecName("win32"), "minotari_node.exe");
  assert.equal(getMinotariNodeExecName("darwin"), "minotari_node");
  assert.equal(getMinotariNodeExecName("linux"), "minotari_node");

  assert.equal(getTariArch("win32", "x64"), "windows-x86_64");
  assert.equal(getTariArch("darwin", "arm64"), "macos-arm64");
  assert.equal(getTariArch("linux", "x64"), "linux-x86_64");
});
