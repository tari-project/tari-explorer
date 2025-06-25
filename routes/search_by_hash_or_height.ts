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
import { sanitizeBigInts } from "../utils/sanitizeObject.js";
import { collectAsyncIterable } from "../utils/grpcHelpers.js";
const router = express.Router();

export interface SearchResult {
  payment_reference_hex?: string;
  block_height?: string;
  block_hash?: Buffer;
  mined_timestamp?: string;
  commitment?: Buffer;
  is_spent?: boolean;
  spent_height?: string;
  spent_block_hash?: Buffer;
  min_value_promise?: string;
  search_type: string;
}

router.get("/", async function (req: express.Request, res: express.Response) {
  res.setHeader("Cache-Control", cacheSettings.newBlocks);
  const client = createClient();

  const all_inputs = Array.from(
    new Set(
      ((req.query.hash_or_number || "") as string)
        .split(",")
        .filter((ref) => ref !== "") // Remove empty strings
        .map((ref) => ref.trim().toLowerCase()), // Remove extra spaces
    ),
  );

  const hashes = Array.from(
    new Set(
      ((req.query.hash_or_number || "") as string)
        .split(",")
        .filter((ref) => ref !== "") // Remove empty strings
        .map((ref) => ref.trim().toLowerCase()) // Remove extra spaces
        .filter((ref) => /^[a-fA-F0-9]{64}$/.test(ref)), // Validate format
    ),
  );

  const heights = Array.from(
    new Set(
      ((req.query.hash_or_number || "") as string)
        .split(",")
        .filter((ref) => ref !== "") // Remove empty strings
        .map((ref) => ref.trim()) // Remove extra spaces
        .filter(
          (ref) =>
            /^[0-9]+$/.test(ref) && // Validate numeric format
            BigInt(ref) <= BigInt("18446744073709551615"), // Ensure within u64 range
        )
        .map(Number)
        .map(BigInt),
    ),
  );

  if (hashes.length === 0 && heights.length === 0) {
    res.status(404);
    if (req.query.json !== undefined) {
      res.json({ error: "no input hashes or heights provided" });
    } else {
      res.render("error", { error: "no input hashes or heights provided" });
    }
    return;
  }
  if (all_inputs.length !== hashes.length + heights.length) {
    res.status(404);
    // Compile am error msg that contains the invalid inputs
    const invalid = all_inputs
      .filter(
        (input) =>
          !(
            (
              /^[a-fA-F0-9]{64}$/.test(input) || // Valid hash format
              (/^[0-9]+$/.test(input) &&
                BigInt(input) <= BigInt("18446744073709551615"))
            ) // Valid height format
          ),
      )
      .join(", ");

    if (req.query.json !== undefined) {
      res.json({ error: "invalid hashes or heights: " + invalid });
    } else {
      res.render("error", { error: "invalid hashes or heights: " + invalid });
    }
    return;
  }

  const binaryHashes: Buffer[] = hashes.map((hash) => Buffer.from(hash, "hex"));

  let headerByHeightResult: SearchResult[] = [];
  let headerByHeightError: string | undefined;
  if (heights.length !== 0) {
    for (const height of heights) {
      try {
        let blocks = await cache.get(client.getBlocks, { heights: [height] });
        for (const historical_block of blocks) {
          const mapped = {
            payment_reference_hex: undefined,
            block_height: historical_block.block.header.height.toString(),
            block_hash: historical_block.block.header.hash,
            mined_timestamp: historical_block.block.header.timestamp.toString(),
            commitment: undefined,
            is_spent: undefined,
            spent_height: undefined,
            spent_block_hash: undefined,
            min_value_promise: undefined,
            search_type: "#height",
          };
          headerByHeightResult.push(mapped);
        }
      } catch (error) {
        headerByHeightError = `Error fetching blocks for height(s): ${heights.join(", ")}: ${error}`;
      }
    }
    if (headerByHeightResult.length === 0) {
      headerByHeightError =
        "no blocks found at height(s): " + heights.join(", ");
    }
  }

  let headerByHashResult: SearchResult[] = [];
  let headerByHashError: string | undefined;
  for (const hash of binaryHashes) {
    try {
      const block_header = await client.getHeaderByHash({ hash: hash });
      if (block_header !== undefined) {
        const result = {
          payment_reference_hex: undefined,
          block_height: block_header?.header?.height.toString(),
          block_hash: block_header?.header?.hash,
          mined_timestamp: block_header?.header?.timestamp?.toString(),
          commitment: undefined,
          is_spent: undefined,
          spent_height: undefined,
          spent_block_hash: undefined,
          min_value_promise: undefined,
          search_type: "#hash",
        };
        headerByHashResult.push(result);
      }
    } catch (error) {
      headerByHashError = `Error fetching header for hash ${hash}: ${error}`;
    }
  }
  if (headerByHashResult.length === 0) {
    headerByHashError = `No headers found for hash(es): ${hashes.join(", ")}`;
  }

  let payrefResult: SearchResult[] = [];
  let payrefError: string | undefined;
  try {
    const payrefOutputs = await collectAsyncIterable(
      client.searchPaymentReferences({
        payment_reference_hex: hashes,
        include_spent: true,
      }),
    );
    payrefResult = payrefOutputs.map((output: any) => ({
      payment_reference_hex: output.payment_reference_hex,
      block_height: output.block_height.toString(),
      block_hash: output.block_hash,
      mined_timestamp: output.mined_timestamp.toString(),
      commitment: output.commitment,
      is_spent: output.is_spent || false,
      spent_height: output.spent_height ? output.spent_height.toString() : "0",
      spent_block_hash: output.spent_block_hash || Buffer.alloc(0),
      min_value_promise: output.min_value_promise.toString(),
      search_type: "Payref",
    }));
  } catch (error) {
    payrefError = "no outputs via payref(s): " + error;
  }

  let commitmentResult: SearchResult[] = [];
  let commitmentError: string | undefined;
  try {
    const result = await collectAsyncIterable(
      client.searchUtxos({ commitments: binaryHashes }),
    );
    commitmentResult = result.flatMap((block: any) =>
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
          search_type: "Commit",
        })),
    );
  } catch (error) {
    commitmentError = "no outputs via commitment(s): " + error;
  }

  if (
    headerByHeightError !== undefined &&
    headerByHashError !== undefined &&
    payrefError !== undefined &&
    commitmentError !== undefined
  ) {
    res.status(404);
    if (req.query.json !== undefined) {
      res.json({
        error:
          headerByHeightError ||
          headerByHashError ||
          payrefError ||
          commitmentError,
      });
    } else {
      res.render("error", {
        error:
          headerByHeightError ||
          headerByHashError ||
          payrefError ||
          commitmentError,
      });
    }
    return;
  }

  const combined_json = {
    items: [
      ...new Map(
        [...(headerByHeightResult || []), ...(headerByHashResult || [])].map(
          (item) => [item.block_hash, item],
        ),
      ).values(),
      ...new Map(
        [...(payrefResult || []), ...(commitmentResult || [])].map((item) => [
          item.payment_reference_hex,
          item,
        ]),
      ).values(),
    ].sort((a, b) => Number(b.block_height) - Number(a.block_height)), // Parse block_height as a number
  };

  if (req.query.json !== undefined) {
    res.json(combined_json);
  } else {
    res.render("search_by_hash_or_height", sanitizeBigInts(combined_json));
  }
});

export default router;
