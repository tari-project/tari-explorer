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
const router = express.Router();

router.get("/", async function (req: express.Request, res: express.Response) {
  res.setHeader("Cache-Control", cacheSettings.newBlocks);
  const client = createClient();

  const hashes = Array.from(
    new Set(
      ((req.query.hash || req.query.hashes || req.query.h || "") as string)
        .split(",")
        .map((ref) => ref.trim()) // Remove extra spaces
        .filter((ref) => /^[a-fA-F0-9]{64}$/.test(ref)), // Validate format
    ),
  );

  const binaryHashes: Buffer[] = [];
  for (let i = 0; i < hashes.length; i++) {
    binaryHashes.push(Buffer.from(hashes[i], "hex"));
  }

  if (hashes.length === 0) {
    res.status(404);
    if (req.query.json !== undefined) {
      res.json({ error: "no input hashes provided" });
    } else {
      res.render("error", { error: "no input hashes provided" });
    }
    return;
  }

  let payrefResult;
  let payrefError;
  try {
    payrefResult = await client.searchPaymentReferences({
      payment_reference_hex: hashes,
      include_spent: true,
    });
  } catch (error) {
    payrefError = "no outputs via payref(s): " + error;
  }

  let commitmentResult;
  let commitmentError;
  try {
    commitmentResult = await client.searchUtxos({ commitments: binaryHashes });
    commitmentResult = commitmentResult.flatMap((block: any) =>
      block.block.body.outputs
        .filter((output: any) =>
          binaryHashes.some((hash) => hash.equals(output.commitment)),
        )
        .map((output: any) => ({
          payment_reference_hex: output.payment_reference.toString("hex"),
          block_height: block.block.header.height.toString(),
          block_hash: block.block.header.hash,
          mined_timestamp: block.block.header.timestamp.toString(),
          commitment: output.commitment,
          is_spent: output.is_spent || false,
          spent_height: output.spent_height
            ? output.spent_height.toString()
            : "0",
          spent_block_hash: output.spent_block_hash || Buffer.alloc(0),
          min_value_promise: output.minimum_value_promise.toString(),
        })),
    );
  } catch (error) {
    commitmentError = "no outputs via commitment(s): " + error;
  }

  if (payrefError !== undefined && commitmentError !== undefined) {
    res.status(404);
    if (req.query.json !== undefined) {
      res.json({ error: payrefError || commitmentError });
    } else {
      res.render("error", { error: payrefError || commitmentError });
    }
    return;
  }

  const json = {
    items: [
      ...new Map(
        [...(payrefResult || []), ...(commitmentResult || [])].map((item) => [
          item.payment_reference_hex,
          item,
        ]),
      ).values(),
    ].sort((a, b) => Number(b.block_height) - Number(a.block_height)), // Parse block_height as a number
  };
  if (req.query.json !== undefined) {
    res.json(json);
  } else {
    res.render("search_outputs", json);
  }
});

export default router;
