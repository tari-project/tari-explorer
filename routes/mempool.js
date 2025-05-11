// Copyright 2022 The Tari Project
// SPDX-License-Identifier: BSD-3-Clause

import express from "express";
import { createClient } from "../baseNodeClient.js";
import cacheSettings from "../cacheSettings.js";
const router = express.Router();

/* GET mempool page. */
router.get("/:excessSigs", async function (req, res) {
  res.setHeader("Cache-Control", cacheSettings.mempool);
  const client = createClient();
  const txId = req.params.excessSigs.split("+");
  const mempool = await client.getMempoolTransactions({});
  let tx = null;
  for (let i = 0; i < mempool.length; i++) {
    for (let j = 0; j < mempool[i].transaction.body.kernels.length; j++) {
      for (let k = 0; k < txId.length; k++) {
        if (
          txId[k] ===
          Buffer.from(
            mempool[i].transaction.body.kernels[j].excess_sig.signature,
          ).toString("hex")
        ) {
          tx = mempool[i].transaction;
          break;
        }
      }
      if (tx) {
        break;
      }
    }
  }

  if (!tx) {
    res.status(404);
    if (req.query.json !== undefined) {
      res.json({ error: "Tx not found" });
    } else {
      res.render("error", { error: "Tx not found" });
    }
    return;
  }
  const json = { tx };
  if (req.query.json !== undefined) {
    res.json(json);
  } else {
    res.render("Mempool", json);
  }
});

export default router;
