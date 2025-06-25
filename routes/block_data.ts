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
import express from "express";
import cache from "../cache.js";
import cacheSettings from "../cacheSettings.js";
import { HistoricalBlock } from "@/grpc-gen/block.js";
import { BlockHeaderResponse } from "@/grpc-gen/base_node.js";
import { AggregateBody } from "@/grpc-gen/transaction.js";
const router = express.Router();

function fromHexString(hexString: string): number[] {
  const res: number[] = [];
  for (let i = 0; i < hexString.length; i += 2) {
    res.push(Number("0x" + hexString.substring(i, i + 2)));
  }
  return res;
}

router.get(
  "/:height_or_hash",
  async function (req: express.Request, res: express.Response) {
    const from = +(req.query.from || 0);
    const to = +(req.query.to || 10);
    const what = req.query.what as string | undefined;
    if (what === undefined) {
      res.status(404);
      res.render("404", { message: `Invalid request` });
      return;
    }
    const client = createClient();
    const height_or_hash = req.params.height_or_hash;
    let block: HistoricalBlock[] | BlockHeaderResponse;
    let height: bigint;
    if (height_or_hash.length === 64) {
      block = await client.getHeaderByHash({
        hash: Buffer.from(fromHexString(height_or_hash)),
      });
      if (!block) {
        res.status(404);
        res.render("404", {
          message: `Block with hash ${height_or_hash} not found`,
        });
        return;
      }
      height = block?.header?.height ?? 0n;
    } else {
      height = BigInt(parseInt(height_or_hash));
    }

    const request = { heights: [height] };
    block = (await cache.get(client.getBlocks, request)) as HistoricalBlock[];
    if (!block || block.length === 0) {
      res.status(404);
      res.render("404", { message: `Block at height ${height} not found` });
      return;
    }

    const blockBody: AggregateBody = block[0]?.block?.body as AggregateBody;
    const body = {
      length: blockBody[what as keyof AggregateBody].length,
      data: blockBody[what as keyof AggregateBody]?.slice(from, to),
    };

    const tipInfo = await client.getTipInfo({});
    const tipHeight = tipInfo?.metadata?.best_block_height || 0;

    if (height + BigInt(cacheSettings.oldBlockDeltaTip) <= tipHeight) {
      res.setHeader("Cache-Control", cacheSettings.oldBlocks);
    } else {
      res.setHeader("Cache-Control", cacheSettings.newBlocks);
    }

    const json = {
      height,
      body: body,
    };
    res.json(json);
  },
);

export default router;
