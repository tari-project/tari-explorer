//  Copyright 2021. The Tari Project
//
//  Redistribution and use in source and binary forms, with or without modification, are permitted provided that the
//  following conditions are met:
//
//  1. Redistributions of source code must retain the above copyright notice, this list of conditions and the following
//  disclaimer.
//
//  2. Redistributions in binary form must reproduce the above copyright notice, this list of conditions and the
//  following disclaimer in the documentation and/or other materials provided with the distribution.
//
//  3. Neither the name of the copyright holder nor the names of its contributors may be used to endorse or promote
//  products derived from this software without specific prior written permission.
//
//  THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND ANY EXPRESS OR IMPLIED WARRANTIES,
//  INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
//  DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL,
//  SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR
//  SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY,
//  WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE
//  USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.

import { createClient } from "../baseNodeClient.js";
import express from "express";
import cacheSettings from "../cacheSettings.js";
import cache from "../cache.js";
const router = express.Router();

router.get("/", async function (req: express.Request, res: express.Response) {
  res.setHeader("Cache-Control", cacheSettings.index);
  const client = createClient();
  const lastDifficulties = await client.getNetworkDifficulty({ from_tip: 720 });

  const data: any = {
    num_blocks: lastDifficulties.length,
    difficulties: lastDifficulties,
    extras: [],
    unique_ids: {},
    os: {},
    versions: {},
    now: Math.floor(Date.now() / 1000),
  };

  for (let i = 0; i < lastDifficulties.length; i++) {
    let extra = lastDifficulties[i].coinbase_extras.join("|");
    const split = extra.split(",");

    let unique_id =
      lastDifficulties[i].first_coinbase_extra === ""
        ? "Non-universe miner"
        : lastDifficulties[i].first_coinbase_extra;
    let os = "Non-universe miner";
    let version = "Non-universe miner";

    if (split.length >= 6) {
      unique_id = split[1];
      os = split[4];
      version = split[5];
    }

    if (data.unique_ids[unique_id] === undefined) {
      data.unique_ids[unique_id] = {
        sha: {
          count: 0,
          version: version,
          os: os,
          last_block_time: 0,
          time_since_last_block: null,
          recent_blocks: 0,
        },
        randomx: {
          count: 0,
          version: version,
          os: os,
          last_block_time: 0,
          time_since_last_block: null,
          recent_blocks: 0,
        },
      };
    }
    data.unique_ids[unique_id][
      lastDifficulties[i].pow_algo === "0" ? "randomx" : "sha"
    ].count += 1;
    data.unique_ids[unique_id][
      lastDifficulties[i].pow_algo === "0" ? "randomx" : "sha"
    ].version = version;
    data.unique_ids[unique_id][
      lastDifficulties[i].pow_algo === "0" ? "randomx" : "sha"
    ].last_block_time = lastDifficulties[i].timestamp;
    data.unique_ids[unique_id][
      lastDifficulties[i].pow_algo === "0" ? "randomx" : "sha"
    ].time_since_last_block = Math.ceil(
      (data.now - lastDifficulties[i].timestamp) / 60,
    );

    if (
      data.unique_ids[unique_id][
        lastDifficulties[i].pow_algo === "0" ? "randomx" : "sha"
      ].time_since_last_block < 120
    ) {
      data.unique_ids[unique_id][
        lastDifficulties[i].pow_algo === "0" ? "randomx" : "sha"
      ].recent_blocks += 1;
    }

    if (data.os[os] === undefined) {
      data.os[os] = 0;
    }
    data.os[os] += 1;
    if (data.versions[version] === undefined) {
      data.versions[version] = 0;
    }
    data.versions[version] += 1;

    data.extras.push({
      height: lastDifficulties[i].height,
      extra: extra,
      unique_id,
      os,
      version,
    });
  }

  data.active_miners = {};
  for (const unique_id of Object.keys(data.unique_ids)) {
    console.log(unique_id);
    const miner = data.unique_ids[unique_id];
    console.log(miner);
    if (
      (miner.sha.time_since_last_block || 1000) < 120 ||
      (miner.randomx.time_since_last_block || 1000) < 120
    ) {
      data.active_miners[unique_id] = miner;
    }
  }

  if (req.query.json !== undefined) {
    res.json(data);
  } else {
    res.render("miners", data);
  }
});

export default router;
