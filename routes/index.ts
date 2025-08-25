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
import { miningStats } from "../utils/stats.js";
import express, { Request, Response } from "express";
import cacheSettings from "../cacheSettings.js";
import cache from "../cache.js";
import { collectAsyncIterable } from "../utils/grpcHelpers.js";
import { AggregateBody } from "../grpc-gen/transaction.js";
import { BlockHeaderResponse } from "@/grpc-gen/base_node.js";
import { BlockHeader, HistoricalBlock } from "@/grpc-gen/block.js";
import { sanitizeBigInts } from "../utils/sanitizeObject.js";

const router = express.Router();

type AggregateBodyExtended = AggregateBody & {
  signature: Buffer<ArrayBufferLike> | undefined;
  total_fees: bigint;
};

type BlockHeaderExtended = BlockHeader & {
  kernels: bigint;
  outputs: bigint;
  powText: bigint;
};

/* GET home page. */
router.get("/", async function (req: Request, res: Response) {
  res.setHeader("Cache-Control", cacheSettings.index);
  const from = parseInt((req.query.from as string | undefined) || "0");
  let limit = parseInt((req.query.limit as string | undefined) || "20");
  if (limit > 100) {
    limit = 100;
  }

  let json: Record<string, unknown> | undefined;
  if (res.locals.backgroundUpdater.isHealthy({ from, limit })) {
    // load the default page from cache
    json = res.locals.backgroundUpdater.getData().indexData;
  } else {
    json = (await getIndexData(from, limit)) ?? undefined;
  }
  if (json === null) {
    res.status(404).send("Block not found");
  }

  if (req.query.json !== undefined) {
    (json?.stats as []).map((x: any) => (x.height = x.height.toString()));
    res.json(json);
  } else {
    res.render("index", sanitizeBigInts(json));
  }
});

function getHashRates(difficulties: any[], properties: string[]): number[] {
  const end_idx = difficulties.length - 1;
  const start_idx = end_idx - 720;

  const hashRates = difficulties
    .map((d) =>
      properties.reduce(
        (sum, property) => sum + (parseInt(d[property]) || 0),
        0,
      ),
    )
    ?.slice(start_idx, end_idx);

  // Assign zero values to the next non-zero value
  for (let i = hashRates.length - 2; i >= 0; i--) {
    if (hashRates[i] === 0) {
      hashRates[i] = hashRates[i + 1];
    }
  }

  return hashRates;
}

function getBlockTimes(
  last100Headers: any[],
  this_algo: string | null,
  targetTime: number,
) {
  // Filter headers for the specific algorithm if provided
  let filteredHeaders = last100Headers;
  if (this_algo) {
    filteredHeaders = last100Headers.filter(
      (header) => Number(header.pow.pow_algo) === Number(this_algo),
    );
  }

  // Calculate block times as the difference between consecutive timestamps
  const actualBlockTimes: number[] = [];
  const relativeBlockTimes: number[] = [];
  for (let i = 1; i < filteredHeaders.length; i++) {
    const blockTime =
      (parseInt(filteredHeaders[i - 1].timestamp) -
        parseInt(filteredHeaders[i].timestamp)) /
      60;
    actualBlockTimes.push(blockTime);
    relativeBlockTimes.push(blockTime - targetTime);
  }

  // Calculate the average block time
  const average = (
    actualBlockTimes.reduce((sum, time) => sum + time, 0) /
      actualBlockTimes.length || 0
  ).toFixed(2);

  return { series: relativeBlockTimes, average };
}

export async function getIndexData(from: number, limit: number) {
  const client = createClient();

  const tipInfo = await client.getTipInfo({});
  const tipHeight = tipInfo?.metadata?.best_block_height || 0n;
  const [
    version_result,
    listHeaders,
    headersResp,
    mempool,
    lastDifficulties,
    blocks,
  ] = await Promise.all([
    client.getVersion({}),
    collectAsyncIterable(
      client.listHeaders({
        num_headers: 121n,
      }),
    ),
    // Get one more header than requested so we can work out the difference in MMR_size
    collectAsyncIterable(
      client.listHeaders({
        from_height: BigInt(from),
        num_headers: BigInt(limit + 1),
      }),
    ),
    collectAsyncIterable(client.getMempoolTransactions({})),
    collectAsyncIterable(client.getNetworkDifficulty({ from_tip: 180n })),
    collectAsyncIterable(
      client.getBlocks({
        heights: Array.from({ length: limit }, (_, i) => tipHeight - BigInt(i)),
      }),
    ),
  ]);
  const version = version_result.version?.slice(0, 25);

  // Algo split
  const last100Headers = listHeaders.map((r: BlockHeaderResponse) => r.header);
  const moneroRx = [0, 0, 0, 0];
  const sha3X = [0, 0, 0, 0];
  const tariRx = [0, 0, 0, 0];
  const cuckaroo = [0, 0, 0, 0];

  // Correct ternary nesting for algo split
  for (let i = 0; i < last100Headers.length - 1; i++) {
    const algo = last100Headers[i]?.pow?.pow_algo;
    let arr;
    if (algo === 0n) arr = moneroRx;
    else if (algo === 1n) arr = sha3X;
    else if (algo === 2n) arr = tariRx;
    else arr = cuckaroo;
    if (i < 10) arr[0] += 1;
    if (i < 40) arr[1] += 1;
    if (i < 80) arr[2] += 1;
    arr[3] += 1;
  }
  const algoSplit = {
    moneroRx10: moneroRx[0],
    moneroRx20: moneroRx[1],
    moneroRx50: moneroRx[2],
    moneroRx100: moneroRx[3],
    sha3X10: sha3X[0],
    sha3X20: sha3X[1],
    sha3X50: sha3X[2],
    sha3X100: sha3X[3],
    tariRx10: tariRx[0],
    tariRx20: tariRx[1],
    tariRx50: tariRx[2],
    tariRx100: tariRx[3],
    cuckaroo10: cuckaroo[0],
    cuckaroo20: cuckaroo[1],
    cuckaroo50: cuckaroo[2],
    cuckaroo100: cuckaroo[3],
  };

  // Get one more header than requested so we can work out the difference in MMR_size
  const headers = headersResp
    .map((r: BlockHeaderResponse) => r.header)
    .filter((r) => !!r);
  const pows = { 0: "MoneroRx", 1: "SHA-3X", 2: "TariRx", 3: "Cuckaroo" };
  for (var i = headers.length - 2; i >= 0; i--) {
    (headers[i] as any).kernels =
      headers[i]?.kernel_mmr_size - headers[i + 1]?.kernel_mmr_size;
    (headers[i] as any).outputs =
      headers[i].output_mmr_size - headers[i + 1].output_mmr_size;
    (headers[i] as any).powText =
      pows[(headers[i]?.pow?.pow_algo ?? 0n).toString()];
  }
  const lastHeader = headers[headers.length - 1];
  if (lastHeader.height === 0n) {
    // If the block is the genesis block, then the MMR sizes are the values to use
    (lastHeader as BlockHeaderExtended).kernels = lastHeader.kernel_mmr_size;
    (lastHeader as BlockHeaderExtended).outputs = lastHeader.output_mmr_size;
  } else {
    // Otherwise remove the last one, as we don't want to show it
    headers.splice(headers.length - 1, 1);
  }

  const firstHeight = headers[0].height || 0n;

  // estimated hash rates
  const totalHashRates = getHashRates(lastDifficulties, [
    "estimated_hash_rate",
  ]);
  const sha3xHashRates = getHashRates(lastDifficulties, [
    "sha3x_estimated_hash_rate",
  ]);
  const moneroRandomxHashRates = getHashRates(lastDifficulties, [
    "monero_randomx_estimated_hash_rate",
  ]);
  const tariRandomxHashRates = getHashRates(lastDifficulties, [
    "tari_randomx_estimated_hash_rate",
  ]);
  const cuckarooHashRates = getHashRates(lastDifficulties, [
    "cuckaroo_estimated_hash_rate",
  ]);

  // Get mining stats
  if (!blocks || blocks.length === 0) {
    return null;
  }

  // Block rewards corresponding to block header heights
  const headerRewardMap = new Map<bigint, bigint>();
  for (const h of listHeaders) {
    if (h.header?.height !== undefined) {
      headerRewardMap.set(h.header.height, h.reward ?? 0n);
    }
  }

  const stats = blocks
    .map((block: HistoricalBlock) => {
      const height = block?.block?.header?.height || 0n;
      const reward = headerRewardMap.get(height) ?? 0n;
      return {
        height,
        ...miningStats(block, reward),
      };
    })
    .sort((a, b) => Number(b.height - a.height));

  // Append the stats to the headers array
  for (const header of headers) {
    const stat = stats.find((s: any) => s.height === header.height);
    if (stat) {
      (header as any).totalCoinbaseXtm = stat.totalCoinbaseXtm;
      (header as any).numCoinbases = stat.numCoinbases;
      (header as any).numOutputsNoCoinbases = stat.numOutputsNoCoinbases;
      (header as any).numInputs = stat.numInputs;
    } else {
      const block = await cache.get(client.getBlocks, {
        heights: [header.height],
      });
      const headers_with_reward = await collectAsyncIterable(
        client.listHeaders({
          from_height: header.height,
          num_headers: BigInt(1),
        }),
      );
      const stat = miningStats(block, headers_with_reward[0].reward);
      (header as any).totalCoinbaseXtm = stat.totalCoinbaseXtm;
      (header as any).numCoinbases = stat.numCoinbases;
      (header as any).numOutputsNoCoinbases = stat.numOutputsNoCoinbases;
      (header as any).numInputs = stat.numInputs;
    }
  }

  // list of active validator nodes
  const activeVns = await cache.get(client.getActiveValidatorNodes, {
    height: tipHeight,
  });

  for (let i = 0; i < mempool.length; i++) {
    let sum = 0n;
    for (
      let j = 0;
      j < (mempool[i]?.transaction?.body?.kernels?.length || 0);
      j++
    ) {
      sum += mempool[i]?.transaction?.body?.kernels[j]?.fee || 0n;
      //introducing signature prop
      (mempool[i]?.transaction?.body as AggregateBodyExtended).signature =
        mempool[i]?.transaction?.body?.kernels[j]?.excess_sig?.signature;
    }
    (mempool[i]?.transaction?.body as AggregateBodyExtended).total_fees = sum;
  }

  const block = await cache.get(client.getBlocks, { heights: [tipHeight] });
  if (!block || block.length === 0) {
    return null;
  }

  const consensus = await client.getConstants({ block_height: tipHeight });
  const c29Active = Number(consensus.pow_algo_count) >= 4n;
  const algo_target_time = Number(consensus.proof_of_work[0].target_time) / 60;
  const block_target_time = algo_target_time / Number(consensus.pow_algo_count);

  return {
    title: "Blocks",
    version,
    tipInfo,
    mempool,
    headers,
    pows,
    nextPage: firstHeight - BigInt(limit),
    prevPage: firstHeight + BigInt(limit),
    limit,
    from,
    algoSplit,
    blockTimes: getBlockTimes(last100Headers, null, 2),
    moneroRandomxTimes: getBlockTimes(last100Headers, "0", 8),
    sha3xTimes: getBlockTimes(last100Headers, "1", 8),
    tariRandomxTimes: getBlockTimes(last100Headers, "2", 8),
    cuckarooTimes: getBlockTimes(last100Headers, "3", 8),
    currentHashRate: totalHashRates[totalHashRates.length - 1],
    totalHashRates,
    currentSha3xHashRate: sha3xHashRates[sha3xHashRates.length - 1],
    sha3xHashRates: sha3xHashRates,
    averageSha3xMiners: Math.floor(
      sha3xHashRates[sha3xHashRates.length - 1] / 200_000_000,
    ), // Hashrate of an NVidia 1070
    currentMoneroRandomxHashRate:
      moneroRandomxHashRates[moneroRandomxHashRates.length - 1],
    averageMoneroRandomxMiners: Math.floor(
      moneroRandomxHashRates[moneroRandomxHashRates.length - 1] / 2700,
    ), // Average apple m1 hashrate
    moneroRandomxHashRates: moneroRandomxHashRates,
    currentTariRandomxHashRate:
      tariRandomxHashRates[tariRandomxHashRates.length - 1],
    averageTariRandomxMiners: Math.floor(
      tariRandomxHashRates[tariRandomxHashRates.length - 1] / 2700,
    ), // Average apple m1 hashrate
    tariRandomxHashRates: tariRandomxHashRates,
    activeVns,
    lastUpdate: new Date(),
    stats,
    currentCuckarooHashRate: cuckarooHashRates[cuckarooHashRates.length - 1],
    cuckarooHashRates: cuckarooHashRates,
    averageCuckarooMiners: Math.floor(
      cuckarooHashRates[cuckarooHashRates.length - 1] / 3,
    ), // Hashrate (graphs per second - GPS) of a NVidia 1070 GPU
    c29Active,
    algo_target_time,
    block_target_time,
  };
}

export default router;
