var { createClient } = require("../baseNodeClient");

var express = require("express");
const { format } = require('@fast-csv/format');
var router = express.Router();
const EXTRA_COLUMN = 8;

router.get("/", async function (req, res) {
    try {
        let client = createClient();
        let lastDifficulties = await client.getNetworkDifficulty({ from_tip: 720 });

        let data = { num_blocks: lastDifficulties.length, difficulties: lastDifficulties, extras: [], unique_ids: {}, os: {}, versions: {}, now: Math.floor(Date.now() / 1000) };

        for (let i = 0; i < lastDifficulties.length; i++) {
            let extra = lastDifficulties[i].first_coinbase_extra.toString();
            console.log(extra);
            let split = extra.split(",");

            let unique_id = "Non-universe miner";
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
                        time_since_last_block: null
                    },
                    randomx: {
                        count: 0,
                        version: version,
                        os: os,
                        last_block_time: 0,
                        time_since_last_block: null
                    }
                };

            }
            data.unique_ids[unique_id][lastDifficulties[i].pow_algo === "0" ? 'randomx' : 'sha'].count += 1;
            data.unique_ids[unique_id][lastDifficulties[i].pow_algo === "0" ? 'randomx' : 'sha'].last_block_time = lastDifficulties[i].timestamp;
            data.unique_ids[unique_id][lastDifficulties[i].pow_algo === "0" ? 'randomx' : 'sha'].time_since_last_block = Math.ceil((data.now - lastDifficulties[i].timestamp) / 60);

            if (data.os[os] === undefined) {
                data.os[os] = 0;
            }
            data.os[os] += 1;
            if (data.versions[version] === undefined) {
                data.versions[version] = 0;
            }
            data.versions[version] += 1;

            data.extras.push({ height: lastDifficulties[i].height, extra: extra, unique_id, os, version });
        }

        if (req.query.json !== undefined) {
            res.json(data);
        } else {
            res.render("miners", data);
        }


    } catch (error) {
        res.status(500);
        if (req.query.json !== undefined) {
            res.json({ error: error });
        } else {
            res.render("error", { error: error });
        }
    }
});

function getHashRates(difficulties, properties) {
    const end_idx = difficulties.length - 1;
    const start_idx = end_idx - 1000;

    return difficulties
        .map((d) =>
            properties.reduce(
                (sum, property) => sum + (parseInt(d[property]) || 0),
                0
            )
        )
        .slice(start_idx, end_idx);
}


module.exports = router;