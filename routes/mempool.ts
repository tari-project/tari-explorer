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

import express from "express";
import { createClient } from "../baseNodeClient.js";
import cacheSettings from "../cacheSettings.js";
import { collectAsyncIterable } from "../utils/grpcHelpers.js";
import { Transaction } from "../grpc-gen/transaction.js";
import { sanitizeBigInts } from "../utils/sanitizeObject.js";
const router = express.Router();

/* GET mempool page. */
router.get(
  "/:excessSigs",
  async function (req: express.Request, res: express.Response) {
    res.setHeader("Cache-Control", cacheSettings.mempool);
    const client = createClient();
    const txId = req.params.excessSigs.split("+");
    const mempool = await collectAsyncIterable(
      client.getMempoolTransactions({}),
    );
    let tx: Transaction | undefined = undefined;
    for (let i = 0; i < mempool.length; i++) {
      for (
        let j = 0;
        j < (mempool[i]?.transaction?.body?.kernels?.length || 0);
        j++
      ) {
        for (let k = 0; k < txId.length; k++) {
          if (
            txId[k] ===
            Buffer.from(
              mempool[i]?.transaction?.body?.kernels[j]?.excess_sig
                ?.signature || Buffer.from([]),
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

    tx.body?.outputs.forEach((output: any) => {
      if (output.features.range_proof_type === 0) {
        // BulletProofPlus
        const proofHex = Buffer.from(output.range_proof.proof_bytes).toString(
          "hex",
        );
        output.range_proof = proofHex;
      } else {
        // RevealedValue
        output.range_proof = "RevealedValue";
      }
    });

    const json = { tx };
    if (req.query.json !== undefined) {
      res.json(json);
    } else {
      res.render("mempool", sanitizeBigInts(json));
    }
  },
);

export default router;
