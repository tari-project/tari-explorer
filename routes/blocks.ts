// Copyright 2021. The Tari Project
//
// Redistribution and use in source and binary forms, with or without modification, are permitted provided that the
// following conditions are met:
//
// 1. Redistributions of source code must retain the above copyright notice, this list of conditions and the following
// disclaimer.
//
// 2. Redistributions in binary form must reproduce the above copyright notice, this list of conditions and the
// following disclaimer in the documentation and/or other materials provided with the distribution.
//
// 3. Neither the name of the copyright holder nor the names of its contributors may be used to endorse or promote
// products derived from this software without specific prior written permission.
//
// THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND ANY EXPRESS OR IMPLIED WARRANTIES,
// INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
// DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL,
// SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR
// SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY,
// WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE
// USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.

import { createClient } from "../baseNodeClient.js";
import express, { Request, Response } from "express";
import cacheSettings from "../cacheSettings.js";
import cacheService from "../utils/cacheService.js";
import CacheKeys from "../utils/cacheKeys.js";
import { miningStats } from "../utils/stats.js";
import { sanitizeBigInts } from "../utils/sanitizeObject.js";
import { collectAsyncIterable } from "@/utils/grpcHelpers.js";
const router = express.Router();

function fromHexString(hexString: string): number[] {
  const res: number[] = [];
  for (let i = 0; i < hexString.length; i += 2) {
    res.push(Number("0x" + hexString.substring(i, i + 2)));
  }
  return res;
}

router.get("/stats", async function (req: Request, res: Response) {
  const stats = await cacheService.get(CacheKeys.MINING_STATS_RECENT);
  res.json(stats);
})

router.get("/:height_or_hash", async function (req: Request, res: Response) {
  const client = createClient();
  const height_or_hash = req.params.height_or_hash;
  let height: bigint;
  if (height_or_hash.length === 64) {
    const block = await client.getHeaderByHash({
      hash: Buffer.from(fromHexString(height_or_hash)),
    });
    if (!block) {
      res.status(404);
      res.render("404", {
        message: `Block with hash ${height_or_hash} not found`,
      });
      return;
    }
    height = block.header?.height || 0n;
  } else {
    height = BigInt(height_or_hash);
  }

  const request = { heights: [height] };

  const block = await collectAsyncIterable(client.getBlocks(request));
  if (!block || block.length === 0) {
    res.status(404);
    res.render("404", { message: `Block at height ${height} not found` });
    return;
  }

  // Calculate statistics
  const { totalCoinbaseXtm, numCoinbases, numOutputsNoCoinbases, numInputs } =
    miningStats(block);

  const outputs_from = +(req.query.outputs_from || 0);
  const outputs_to = +(req.query.outputs_to || 10);
  const inputs_from = +(req.query.inputs_from || 0);
  const inputs_to = +(req.query.inputs_to || 10);
  const kernels_from = +(req.query.kernels_from || 0);
  const kernels_to = +(req.query.kernels_to || 10);
  const body = {
    outputs_length: block[0]?.block?.body?.outputs.length,
    inputs_length: block[0]?.block?.body?.inputs.length,
    kernels_length: block[0]?.block?.body?.kernels.length,
    outputs: block[0]?.block?.body?.outputs.slice(outputs_from, outputs_to),
    inputs: block[0]?.block?.body?.inputs.slice(inputs_from, inputs_to),
    kernels: block[0]?.block?.body?.kernels.slice(kernels_from, kernels_to),
    outputsNext: null as string | null,
    outputsNextLink: null as string | null,
    outputsPrev: null as string | null,
    outputsPrevLink: null as string | null,
    outputsFrom: outputs_from,
    inputsNext: null as string | null,
    inputsNextLink: null as string | null,
    inputsPrev: null as string | null,
    inputsPrevLink: null as string | null,
    inputsFrom: inputs_from,
    kernelsNext: null as string | null,
    kernelsNextLink: null as string | null,
    kernelsPrev: null as string | null,
    kernelsPrevLink: null as string | null,
    kernelsFrom: kernels_from,
  };
  if (outputs_from > 0) {
    body.outputsPrev = `${outputs_from - 10}..${outputs_from - 1}`;
    body.outputsPrevLink =
      "/blocks/" +
      height +
      "?outputs_from=" +
      (outputs_from - 10) +
      "&outputs_to=" +
      (outputs_to - 10) +
      "&inputs_from=" +
      inputs_from +
      "&inputs_to=" +
      inputs_to +
      "&kernels_from=" +
      kernels_from +
      "&kernels_to=" +
      kernels_to;
  }
  if (outputs_to < (body.outputs_length || 0)) {
    body.outputsNext = `${outputs_to}..${outputs_to + 9}`;
    body.outputsNextLink =
      "/blocks/" +
      height +
      "?outputs_from=" +
      (outputs_from + 10) +
      "&outputs_to=" +
      (outputs_to + 10) +
      "&inputs_from=" +
      inputs_from +
      "&inputs_to=" +
      inputs_to +
      "&kernels_from=" +
      kernels_from +
      "&kernels_to=" +
      kernels_to;
  }
  if (inputs_from > 0) {
    body.inputsPrev = `${inputs_from - 10}..${inputs_from - 1}`;
    body.inputsPrevLink =
      "/blocks/" +
      height +
      "?outputs_from=" +
      outputs_from +
      "&outputs_to=" +
      outputs_to +
      "&inputs_from=" +
      (inputs_from - 10) +
      "&inputs_to=" +
      (inputs_to - 10) +
      "&kernels_from=" +
      kernels_from +
      "&kernels_to=" +
      kernels_to;
  }
  if (inputs_to < (body.inputs_length || 0)) {
    body.inputsNext = `${inputs_to}..${inputs_to + 9}`;
    body.inputsNextLink =
      "/blocks/" +
      height +
      "?outputs_from=" +
      outputs_from +
      "&outputs_to=" +
      outputs_to +
      "&inputs_from=" +
      (inputs_from + 10) +
      "&inputs_to=" +
      (inputs_to + 10) +
      "&kernels_from=" +
      kernels_from +
      "&kernels_to=" +
      kernels_to;
  }
  if (kernels_from > 0) {
    body.kernelsPrev = `${kernels_from - 10}..${kernels_from - 1}`;
    body.kernelsPrevLink =
      "/blocks/" +
      height +
      "?outputs_from=" +
      outputs_from +
      "&outputs_to=" +
      outputs_to +
      "&inputs_from=" +
      inputs_from +
      "&inputs_to=" +
      inputs_to +
      "&kernels_from=" +
      (kernels_from - 10) +
      "&kernels_to=" +
      (kernels_to - 10);
  }
  if (kernels_to < (body.kernels_length || 0)) {
    body.kernelsNext = `${kernels_to}..${kernels_to + 9}`;
    body.kernelsNextLink =
      "/blocks/" +
      height +
      "?outputs_from=" +
      outputs_from +
      "&outputs_to=" +
      outputs_to +
      "&inputs_from=" +
      inputs_from +
      "&inputs_to=" +
      inputs_to +
      "&kernels_from=" +
      (kernels_from + 10) +
      "&kernels_to=" +
      (kernels_to + 10);
  }
  const tipInfo = await client.getTipInfo({});
  const tipHeight: bigint = tipInfo?.metadata?.best_block_height || 0n;

  const prevHeight = height - 1n;
  let prevLink: string | null = `/blocks/${prevHeight}`;
  if (height === 0n) prevLink = null;

  const nextHeight = height + 1n;
  let nextLink: string | null = `/blocks/${nextHeight}`;
  if (height === tipHeight) nextLink = null;

  if (tipHeight - height >= cacheSettings.oldBlockDeltaTip) {
    res.setHeader("Cache-Control", cacheSettings.oldBlocks);
  } else {
    res.setHeader("Cache-Control", cacheSettings.newBlocks);
  }

  const json = {
    title: `Block at height: ${block[0]?.block?.header?.height?.toString()}`,
    header: block[0]?.block?.header,
    height,
    prevLink,
    prevHeight,
    nextLink,
    nextHeight,
    body: body,
    pows: { 0: "Monero RandomX", 1: "SHA-3X", 2: "Tari RandomX" },
    numInputs,
    totalCoinbaseXtm,
    numCoinbases,
    numOutputsNoCoinbases,
  };
  if (req.query.json !== undefined) {
    res.json(json);
  } else {
    res.render("blocks", sanitizeBigInts(json));
  }
});

router.get("/tip/height", async function (req: Request, res: Response) {
  let tip: { height: bigint, timestamp: bigint } = {
    height: 0n,
    timestamp: 0n
  };

  const cachedTip = await cacheService.get<{height: bigint, timestamp: bigint}>(CacheKeys.TIP_CURRENT);
  if (cachedTip) {
    tip = {
      height: cachedTip.height,
      timestamp: cachedTip.timestamp
    };
  } else {
    const client = createClient();
    const tipInfo = await client.getTipInfo({});
    tip = {
      height: tipInfo?.metadata?.best_block_height || 0n,
      timestamp: tipInfo?.metadata?.timestamp || 0n,
    };
  }
  res.json(tip);
});

router.get("/:height/header", async function (req: Request, res: Response) {
  const { height } = req.params;
  if (typeof height !== "string" || !/^\d+$/.test(height)) {
    res.status(400).json({ error: "Invalid block height parameter. Must be a non-negative integer." });
    return;
  }
  const client = createClient();
  const headers = client.getBlocks({
    heights: [BigInt(height)],
  });

  const result = { height: null as bigint | null, hash: "" as string | undefined, timestamp: 0n };
  for await (const value of headers) {
    result.height = value.block?.header?.height || null;
    result.hash = value.block?.header?.hash.toString("hex");
    result.timestamp = value.block?.header?.timestamp || 0n;
  }
  res.header("Cache-Control", cacheSettings.oldBlocks);
  res.json(result);
});

export default router;
