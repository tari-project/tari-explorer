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

var { createClient } = require("../baseNodeClient");

var express = require("express");
const cache = require("../cache");
const cacheSettings = require("../cacheSettings");
var router = express.Router();

function fromHexString(hexString) {
  let res = [];
  for (let i = 0; i < hexString.length; i += 2) {
    res.push(Number("0x" + hexString.substring(i, i + 2)));
  }
  return res;
}

router.get("/:height_or_hash", async function (req, res) {
    let from = +(req.query.from || 0);
    let to = +(req.query.to || 10);
    let what = req.query.what;
    if (what === undefined) {
      res.status(404);
      res.render("404", { message: `Invalid request` });
      return;
    }
    let client = createClient();
    let height_or_hash = req.params.height_or_hash;
    let block;
    let height;
    if (height_or_hash.length === 64) {
      block = await client.getHeaderByHash({
        hash: fromHexString(height_or_hash),
      });
      if (!block) {
        res.status(404);
        res.render("404", {
          message: `Block with hash ${height_or_hash} not found`,
        });
        return;
      }
      height = parseInt(block.header.height);
    } else {
      height = parseInt(height_or_hash);
    }

    let request = { heights: [height] };
    block = await cache.get(client.getBlocks, request);
    if (!block || block.length === 0) {
      res.status(404);
      res.render("404", { message: `Block at height ${height} not found` });
      return;
    }

    let body = {
      length: block[0].block.body[what].length,
      data: block[0].block.body[what].slice(from, to),
    };

    let tipInfo = await client.getTipInfo({});
    let tipHeight = parseInt(tipInfo.metadata.best_block_height);

    if (height + cacheSettings.oldBlockDeltaTip <= tipHeight) {
      res.setHeader("Cache-Control", cacheSettings.oldBlocks);
    } else {
      res.setHeader("Cache-Control", cacheSettings.newBlocks);
    }

    let json = {
      height,
      body: body,
    };
    res.json(json);
});

module.exports = router;
