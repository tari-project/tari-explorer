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

var express = require("express");
const { createClient } = require("../baseNodeClient");
const cache = require("../cache");
const { miningStats } = require("../utils/stats");
var router = express.Router();

const NUM_BLOCKS = 100;

router.get("/", async function (req, res) {
  const client = createClient();
  const tipInfo = await client.getTipInfo({});

  if (!tipInfo || !tipInfo.metadata || !tipInfo.metadata.best_block_height) {
    throw new Error("Invalid tipInfo response");
  }

  const tipHeight = tipInfo.metadata.best_block_height;
  const request = {
    heights: Array.from({ length: NUM_BLOCKS }, (_, i) => tipHeight - i),
  };

  const blocks = await cache.get(client.getBlocks, request);
  if (!blocks || blocks.length === 0) {
    res.status(404);
    res.render("404", { message: `Blocks not found` });
    return;
  }

  // Calculate statistics
  const stats = blocks
    .map((block) => ({
      height: block.block.header.height,
      ...miningStats(block),
    }))
    .sort((a, b) => b.height - a.height);

  const json = { stats };
  if (req.query.json !== undefined) {
    res.json(json);
  } else {
    res.render("stats", json);
  }
});

module.exports = router;
