// Copyright 2022 The Tari Project
// SPDX-License-Identifier: BSD-3-Clause

import { createClient } from "../baseNodeClient.js";
import { miningStats } from "../utils/stats.js";
import express from "express";
import cacheSettings from "../cacheSettings.js";
import cache from "../cache.js";
const router = express.Router();

/* GET home page. */
router.get("/", async function (req, res) {
  res.setHeader("Cache-Control", cacheSettings.index);
  const from = parseInt(req.query.from || 0);
  let limit = parseInt(req.query.limit || "20");
  if (limit > 100) {
    limit = 100;
  }

  let json = null;
  if (res.locals.backgroundUpdater.isHealthy({ from, limit })) {
    // load the default page from cache
    json = res.locals.backgroundUpdater.getData().indexData;
  } else {
    json = await getIndexData(from, limit);
  }
  if (json === null) {
    res.status(404).send("Block not found");
  }

  if (req.query.json !== undefined) {
    res.json(json);
  } else {
    res.render("index", json);
  }
});

function getHashRates(difficulties, properties) {
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

function getBlockTimes(last100Headers, algo, targetTime) {
  const blocktimes = [];
  let i = 0;
  if (algo === "0" || algo === "1") {
    while (
      i < last100Headers.length &&
      last100Headers[i].pow.pow_algo !== algo
    ) {
      i++;
      blocktimes.push(0);
    }
  }
  if (i >= last100Headers.length) {
    // This happens if there are no blocks for a specific algorithm in last100headers
    return blocktimes;
  }
  let lastBlockTime = parseInt(last100Headers[i].timestamp);
  i++;
  while (i < last100Headers.length && blocktimes.length < 60) {
    if (!algo || last100Headers[i].pow.pow_algo === algo) {
      blocktimes.push(
        (lastBlockTime - parseInt(last100Headers[i].timestamp)) / 60 -
          targetTime,
      );
      lastBlockTime = parseInt(last100Headers[i].timestamp);
    } else {
      blocktimes.push(targetTime);
    }
    i++;
  }
  return blocktimes;
}

export async function getIndexData(from, limit) {
  const client = createClient();

  const tipInfo = await client.getTipInfo({});
  const tipHeight = tipInfo.metadata.best_block_height;
  const [
    version_result,
    listHeaders,
    headersResp,
    mempool,
    lastDifficulties,
    blocks,
  ] = await Promise.all([
    cache.get(client.getVersion, {}),
    cache.get(client.listHeaders, {
      tip_height: tipHeight,
      from_height: 0,
      num_headers: 101,
    }),
    // Get one more header than requested so we can work out the difference in MMR_size
    // TODO: Add cache headers properly here
    cache.get(client.listHeaders, {
      tip_height: tipHeight,
      from_height: from,
      num_headers: limit + 1,
    }),
    cache.get(client.getMempoolTransactions, {}),
    cache.get(client.getNetworkDifficulty, { from_tip: 180 }),
    cache.get(client.getBlocks, {
      heights: Array.from({ length: limit }, (_, i) => tipHeight - i),
    }),
  ]);
  const version = version_result.value?.slice(0, 25);

  // Algo split
  const last100Headers = listHeaders.map((r) => r.header);
  const moneroRx = [0, 0, 0, 0];
  const sha3X = [0, 0, 0, 0];
  const tariRx = [0, 0, 0, 0];

  for (let i = 0; i < last100Headers.length - 1; i++) {
    const algo = last100Headers[i].pow.pow_algo;
    const arr = algo === "0" ? sha3X : algo === "1" ? moneroRx : tariRx;
    if (i < 10) {
      arr[0] += 1;
    }
    if (i < 20) {
      arr[1] += 1;
    }
    if (i < 50) {
      arr[2] += 1;
    }
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
  };

  // Get one more header than requested so we can work out the difference in MMR_size
  const headers = headersResp.map((r) => r.header);
  const pows = { 0: "MoneroRx", 1: "SHA-3X", 2: "TariRx" };
  for (var i = headers.length - 2; i >= 0; i--) {
    headers[i].kernels =
      headers[i].kernel_mmr_size - headers[i + 1].kernel_mmr_size;
    headers[i].outputs =
      headers[i].output_mmr_size - headers[i + 1].output_mmr_size;
    headers[i].powText = pows[headers[i].pow.pow_algo];
  }
  const lastHeader = headers[headers.length - 1];
  if (lastHeader.height === "0") {
    // If the block is the genesis block, then the MMR sizes are the values to use
    lastHeader.kernels = lastHeader.kernel_mmr_size;
    lastHeader.outputs = lastHeader.output_mmr_size;
  } else {
    // Otherwise remove the last one, as we don't want to show it
    headers.splice(headers.length - 1, 1);
  }

  const firstHeight = parseInt(headers[0].height || "0");

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

  // Get mining stats
  if (!blocks || blocks.length === 0) {
    return null;
  }
  const stats = blocks
    .map((block) => ({
      height: block.block.header.height,
      ...miningStats(block),
    }))
    .sort((a, b) => b.height - a.height);

  // Append the stats to the headers array
  for (const header of headers) {
    const stat = stats.find((s) => s.height === header.height);
    if (stat) {
      header.totalCoinbaseXtm = stat.totalCoinbaseXtm;
      header.numCoinbases = stat.numCoinbases;
      header.numOutputsNoCoinbases = stat.numOutputsNoCoinbases;
      header.numInputs = stat.numInputs;
    } else {
      const block = await cache.get(client.getBlocks, {
        heights: [header.height],
      });
      const stat = miningStats(block);
      header.totalCoinbaseXtm = stat.totalCoinbaseXtm;
      header.numCoinbases = stat.numCoinbases;
      header.numOutputsNoCoinbases = stat.numOutputsNoCoinbases;
      header.numInputs = stat.numInputs;
    }
  }

  // list of active validator nodes
  const activeVns = await cache.get(client.getActiveValidatorNodes, {
    height: tipHeight,
  });

  for (let i = 0; i < mempool.length; i++) {
    let sum = 0;
    for (let j = 0; j < mempool[i].transaction.body.kernels.length; j++) {
      sum += parseInt(mempool[i].transaction.body.kernels[j].fee);
      mempool[i].transaction.body.signature =
        mempool[i].transaction.body.kernels[j].excess_sig.signature;
    }
    mempool[i].transaction.body.total_fees = sum;
  }

  const block = await cache.get(client.getBlocks, { heights: [tipHeight] });
  if (!block || block.length === 0) {
    return null;
  }

  return {
    title: "Blocks",
    version,
    tipInfo,
    mempool,
    headers,
    pows,
    nextPage: firstHeight - limit,
    prevPage: firstHeight + limit,
    limit,
    from,
    algoSplit,
    blockTimes: getBlockTimes(last100Headers, null, 2),
    moneroRandomxTimes: getBlockTimes(last100Headers, "0", 6),
    sha3xTimes: getBlockTimes(last100Headers, "1", 6),
    tariRandomxTimes: getBlockTimes(last100Headers, "2", 6),
    currentHashRate: totalHashRates[totalHashRates.length - 1],
    totalHashRates,
    currentSha3xHashRate:
      sha3xHashRates[sha3xHashRates.length - 1].toLocaleString("en-US"),
    sha3xHashRates: sha3xHashRates,
    averageSha3xMiners: Math.floor(
      sha3xHashRates[sha3xHashRates.length - 1] / 200_000_000,
    ).toLocaleString("en-US"), // Hashrate of an NVidia 1070
    currentMoneroRandomxHashRate:
      moneroRandomxHashRates[moneroRandomxHashRates.length - 1].toLocaleString(
        "en-US",
      ),
    averageMoneroRandomxMiners: Math.floor(
      moneroRandomxHashRates[moneroRandomxHashRates.length - 1] / 2700,
    ).toLocaleString("en-US"), // Average apple m1 hashrate
    moneroRandomxHashRates: moneroRandomxHashRates,
    currentTariRandomxHashRate:
      tariRandomxHashRates[tariRandomxHashRates.length - 1].toLocaleString(
        "en-US",
      ),
    averageTariRandomxMiners: Math.floor(
      tariRandomxHashRates[tariRandomxHashRates.length - 1] / 2700,
    ).toLocaleString("en-US"), // Average apple m1 hashrate
    tariRandomxHashRates: tariRandomxHashRates,
    activeVns,
    lastUpdate: new Date(),
    stats,
  };
}

export default router;
