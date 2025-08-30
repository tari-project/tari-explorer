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
  spent_timestamp?: string;
  output_hash?: Buffer;
  search_type: string;
}

interface HashData {
  hexHash: string;
  binaryHash: Buffer;
  assigned: boolean;
}

interface HeightData {
  height: bigint;
  assigned: boolean;
}

router.get("/", async function (req: express.Request, res: express.Response) {
  res.setHeader("Cache-Control", cacheSettings.newBlocks);
  const client = createClient();

  // Input processing - all inputs
  const all_inputs = Array.from(
    new Set(
      ((req.query.hash_or_number || "") as string)
        .split(",")
        .filter((ref) => ref !== "") // Remove empty strings
        .map((ref) => ref.trim().toLowerCase()), // Remove extra spaces
    ),
  );

  // Input processing - extract hashes
  const hashes = Array.from(
    new Set(
      ((req.query.hash_or_number || "") as string)
        .split(",")
        .filter((ref) => ref !== "") // Remove empty strings
        .map((ref) => ref.trim().toLowerCase()) // Remove extra spaces
        .filter((ref) => /^[a-fA-F0-9]{64}$/.test(ref)), // Validate format
    ),
  );
  const hashesMap: Map<string, HashData> = new Map();
  for (const hash of hashes) {
    const entry: HashData = {
      hexHash: hash,
      binaryHash: Buffer.from(hash, "hex"),
      assigned: false,
    };
    hashesMap.set(hash, entry);
  }

  // Input processing - extract heights
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
  const heightsMap: Map<bigint, HeightData> = new Map();
  for (const height of heights) {
    const entry: HeightData = {
      height: height,
      assigned: false,
    };
    heightsMap.set(height, entry);
  }

  // Input processing - basic validation
  if (hashesMap.size === 0 && heightsMap.size === 0) {
    res.status(404);
    if (req.query.json !== undefined) {
      res.json({ error: "no input hashes or heights provided" });
    } else {
      res.render("error", { error: "no input hashes or heights provided" });
    }
    return;
  }
  if (all_inputs.length !== hashesMap.size + heightsMap.size) {
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

  // Searching for blocks by height
  const headerByHeightResult: SearchResult[] = [];
  let headerByHeightError: string | undefined;
  if (heightsMap.size !== 0) {
    for (const height of heights) {
      try {
        const blocks = await collectAsyncIterable(
          client.getBlocks({ heights: [height] }),
        );
        for (const historical_block of blocks) {
          const mapped = {
            payment_reference_hex: undefined,
            block_height: historical_block.block?.header?.height.toString(),
            block_hash: historical_block.block?.header?.hash,
            mined_timestamp:
              historical_block.block?.header?.timestamp.toString(),
            commitment: undefined,
            is_spent: undefined,
            spent_height: undefined,
            spent_block_hash: undefined,
            min_value_promise: undefined,
            spent_timestamp: undefined,
            output_hash: undefined,
            search_type: "#height",
          };
          headerByHeightResult.push(mapped);
          // Mark this height as assigned
          const heightData = heightsMap.get(height);
          if (heightData) {
            heightData.assigned = true;
          }
        }
      } catch (error) {
        headerByHeightError = `Error fetching block for height: ${height}: ${error}`;
      }
    }
    if (headerByHeightResult.length === 0) {
      headerByHeightError =
        "no blocks found at height(s): " + heights.join(", ");
    }
  }

  // Searching for blocks by hash
  let binaryHashes: Buffer[] = Array.from(hashesMap.values())
    .filter((hashData) => !hashData.assigned)
    .map((hashData) => hashData.binaryHash);
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
          spent_timestamp: undefined,
          output_hash: undefined,
          search_type: "#hash",
        };
        headerByHashResult.push(result);
        // Mark this hash as assigned
        const hashData = hashesMap.get(hash.toString("hex"));
        if (hashData) {
          hashData.assigned = true;
        }
      }
    } catch (error) {
      headerByHashError = `Error fetching header for hash ${hash}: ${error}`;
    }
  }
  if (headerByHashResult.length === 0) {
    headerByHashError = `No headers found for hash(es)`;
  }

  // Searching for outputs by payref
  const hexHashes: string[] = Array.from(hashesMap.values())
    .filter((hashData) => !hashData.assigned)
    .map((hashData) => hashData.hexHash);
  let payrefResult: SearchResult[] = [];
  let payrefError: string | undefined;
  try {
    const result = await collectAsyncIterable(
      client.searchPaymentReferences({
        payment_reference_hex: hexHashes,
        include_spent: true,
      }),
    );
    payrefResult = result.map((output: any) => ({
      payment_reference_hex: output.payment_reference_hex,
      block_height: output.block_height.toString(),
      block_hash: output.block_hash,
      mined_timestamp:
        output.mined_timestamp > 0
          ? output.mined_timestamp.toString()
          : undefined,
      commitment: output.commitment,
      is_spent: output.is_spent || false,
      spent_height: output.spent_height ? output.spent_height.toString() : "0",
      spent_block_hash: output.spent_block_hash || Buffer.alloc(0),
      min_value_promise: output.min_value_promise.toString(),
      spent_timestamp:
        output.spent_timestamp > 0
          ? output.spent_timestamp.toString()
          : undefined,
      output_hash: output.output_hash,
      search_type: "Payref",
    }));
    // Mark these hashes as assigned
    for (const output of payrefResult) {
      if (output.payment_reference_hex != null) {
        const hashData = hashesMap.get(output.payment_reference_hex);
        if (hashData) {
          hashData.assigned = true;
        }
      }
    }
  } catch (error) {
    payrefError = "no outputs via payref(s): " + error;
  }

  // Searching for outputs by output hash
  binaryHashes = Array.from(hashesMap.values())
    .filter((hashData) => !hashData.assigned)
    .map((hashData) => hashData.binaryHash);
  let outputHashesResult: SearchResult[] = [];
  let outputHashesError: string | undefined;
  try {
    const result = await collectAsyncIterable(
      client.searchPaymentReferencesViaOutputHash({
        hashes: binaryHashes,
      }),
    );
    outputHashesResult = result.map((output: any) => ({
      payment_reference_hex: output.payment_reference_hex,
      block_height: output.block_height.toString(),
      block_hash: output.block_hash,
      mined_timestamp:
        output.mined_timestamp > 0
          ? output.mined_timestamp.toString()
          : undefined,
      commitment: output.commitment,
      is_spent: output.is_spent || false,
      spent_height: output.spent_height ? output.spent_height.toString() : "0",
      spent_block_hash: output.spent_block_hash || Buffer.alloc(0),
      min_value_promise: output.min_value_promise.toString(),
      spent_timestamp:
        output.spent_timestamp > 0
          ? output.spent_timestamp.toString()
          : undefined,
      output_hash: output.output_hash,
      search_type: "OutputHash",
    }));
    // Mark these hashes as assigned
    for (const output of outputHashesResult) {
      if (output.output_hash != null) {
        const hashData = hashesMap.get(output.output_hash.toString("hex"));
        if (hashData) {
          hashData.assigned = true;
        }
      }
    }
  } catch (error) {
    outputHashesError = "no outputs via payref(s): " + error;
  }

  // Searching for outputs by commitment
  binaryHashes = Array.from(hashesMap.values())
    .filter((hashData) => !hashData.assigned)
    .map((hashData) => hashData.binaryHash);
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
          spent_timestamp: undefined,
          output_hash: output.hash,
          search_type: "Commitment",
        })),
    );
    // Mark these hashes as assigned
    for (const output of commitmentResult) {
      if (output.commitment != null) {
        const hashData = hashesMap.get(output.commitment.toString("hex"));
        if (hashData) {
          hashData.assigned = true;
        }
      }
    }
  } catch (error) {
    commitmentError = "no outputs via commitment(s): " + error;
  }

  if (
    headerByHeightError !== undefined &&
    headerByHashError !== undefined &&
    payrefError !== undefined &&
    outputHashesError !== undefined &&
    commitmentError !== undefined
  ) {
    res.status(404);
    if (req.query.json !== undefined) {
      res.json({
        error:
          headerByHeightError ||
          headerByHashError ||
          payrefError ||
          outputHashesError ||
          commitmentError,
      });
    } else {
      res.render("error", {
        error:
          headerByHeightError ||
          headerByHashError ||
          payrefError ||
          outputHashesError ||
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
        [
          ...(payrefResult || []),
          ...(outputHashesResult || []),
          ...(commitmentResult || []),
        ].map((item) => [item.payment_reference_hex, item]),
      ).values(),
    ].sort((a, b) => Number(b.block_height) - Number(a.block_height)), // Parse block_height as a number
    heights_not_found: Array.from(heightsMap.values())
      .filter((heightData) => !heightData.assigned)
      .map((heightData) => heightData.height.toString()),
    hashes_not_found: Array.from(hashesMap.values())
      .filter((hashData) => !hashData.assigned)
      .map((hashData) => hashData.hexHash),
  };

  if (req.query.json !== undefined) {
    res.json(combined_json);
  } else {
    res.render("search_by_hash_or_height", sanitizeBigInts(combined_json));
  }
});

export default router;
