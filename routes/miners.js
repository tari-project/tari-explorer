var { createClient } = require("../baseNodeClient");

var express = require("express");
var router = express.Router();

router.get("/", async function (req, res) {
  const client = createClient();
  const lastDifficulties = await client.getNetworkDifficulty({ from_tip: 720 });

  const data = {
    num_blocks: lastDifficulties.length,
    difficulties: lastDifficulties,
    extras: [],
    unique_ids: {},
    os: {},
    versions: {},
    now: Math.floor(Date.now() / 1000),
  };

  for (let i = 0; i < lastDifficulties.length; i++) {
    const extra = lastDifficulties[i].first_coinbase_extra.toString();
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

module.exports = router;
