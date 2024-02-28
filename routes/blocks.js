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
  try {
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

    let outputs_from = +(req.query.outputs_from || 0);
    let outputs_to = +(req.query.outputs_to || 10);
    let inputs_from = req.query.inputs_from || 0;
    let inputs_to = +(req.query.inputs_to || 10);
    let kernels_from = +(req.query.kernels_from || 0);
    let kernels_to = +(req.query.kernels_to || 10);
    let body = {
      outputs_length: block[0].block.body.outputs.length,
      inputs_length: block[0].block.body.inputs.length,
      kernels_length: block[0].block.body.kernels.length,
      outputs: block[0].block.body.outputs.slice(outputs_from, outputs_to),
      inputs: block[0].block.body.inputs.slice(inputs_from, inputs_to),
      kernels: block[0].block.body.kernels.slice(kernels_from, kernels_to),
      outputsNext: null,
      outputsNextLink: null,
      outputsPrev: null,
      outputsPrevLink: null,
      outputsFrom: outputs_from,
      inputsNext: null,
      inputsNextLink: null,
      inputsPrev: null,
      inputsPrevLink: null,
      inputsFrom: inputs_from,
      kernelsNext: null,
      kernelsNextLink: null,
      kernelsPrev: null,
      kernelsPrevLink: null,
      kernelsFrom: kernels_from,
    };
    if (outputs_from > 0) {
      body.outputsPrev = `${outputs_from - 10}..${outputs_from - 1}`;
      body.outputsPrevLink =
        "/blocks/" +
        height +
        "?outputs_from=" +
        (outputs_from - 10) +
        "&outputs_to=" +
        (outputs_to - 10) +
        "&inputs_from=" +
        inputs_from +
        "&inputs_to=" +
        inputs_to +
        "&kernels_from=" +
        kernels_from +
        "&kernels_to=" +
        kernels_to;
    }
    if (outputs_to < body.outputs_length) {
      body.outputsNext = `${outputs_to}..${outputs_to + 9}`;
      body.outputsNextLink =
        "/blocks/" +
        height +
        "?outputs_from=" +
        (outputs_from + 10) +
        "&outputs_to=" +
        (outputs_to + 10) +
        "&inputs_from=" +
        inputs_from +
        "&inputs_to=" +
        inputs_to +
        "&kernels_from=" +
        kernels_from +
        "&kernels_to=" +
        kernels_to;
    }
    if (inputs_from > 0) {
      body.inputsPrev = `${inputs_from - 10}..${inputs_from - 1}`;
      body.inputsPrevLink =
        "/blocks/" +
        height +
        "?outputs_from=" +
        outputs_from +
        "&outputs_to=" +
        outputs_to +
        "&inputs_from=" +
        (inputs_from - 10) +
        "&inputs_to=" +
        (inputs_to - 10) +
        "&kernels_from=" +
        kernels_from +
        "&kernels_to=" +
        kernels_to;
    }
    if (inputs_to < body.inputs_length) {
      body.inputsNext = `${inputs_to}..${inputs_to + 9}`;
      body.inputsNextLink =
        "/blocks/" +
        height +
        "?outputs_from=" +
        outputs_from +
        "&outputs_to=" +
        outputs_to +
        "&inputs_from=" +
        (inputs_from + 10) +
        "&inputs_to=" +
        (inputs_to + 10) +
        "&kernels_from=" +
        kernels_from +
        "&kernels_to=" +
        kernels_to;
    }
    if (kernels_from > 0) {
      body.kernelsPrev = `${kernels_from - 10}..${kernels_from - 1}`;
      body.kernelsPrevLink =
        "/blocks/" +
        height +
        "?outputs_from=" +
        outputs_from +
        "&outputs_to=" +
        outputs_to +
        "&inputs_from=" +
        inputs_from +
        "&inputs_to=" +
        inputs_to +
        "&kernels_from=" +
        (kernels_from - 10) +
        "&kernels_to=" +
        (kernels_to - 10);
    }
    if (kernels_to < body.kernels_length) {
      body.kernelsNext = `${kernels_to}..${kernels_to + 9}`;
      body.kernelsNextLink =
        "/blocks/" +
        height +
        "?outputs_from=" +
        outputs_from +
        "&outputs_to=" +
        outputs_to +
        "&inputs_from=" +
        inputs_from +
        "&inputs_to=" +
        inputs_to +
        "&kernels_from=" +
        (kernels_from + 10) +
        "&kernels_to=" +
        (kernels_to + 10);
    }
    let tipInfo = await client.getTipInfo({});
    let tipHeight = parseInt(tipInfo.metadata.best_block_height);

    let prevHeight = height - 1;
    let prevLink = `/blocks/${prevHeight}`;
    if (height === 0) prevLink = null;

    let nextHeight = height + 1;
    let nextLink = `/blocks/${nextHeight}`;
    if (height === tipHeight) nextLink = null;

    if (height + cacheSettings.oldBlockDeltaTip <= tipHeight) {
      res.setHeader("Cache-Control", cacheSettings.oldBlocks);
    } else {
      res.setHeader("Cache-Control", cacheSettings.newBlocks);
    }

    let json = {
      title: `Block at height: ${block[0].block.header.height}`,
      header: block[0].block.header,
      height,
      prevLink,
      prevHeight,
      nextLink,
      nextHeight,
      body: body,
      pows: { 0: "Monero", 1: "SHA-3" },
    };
    if (req.query.json !== undefined) {
      res.json(json);
    } else {
      res.render("blocks", json);
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

module.exports = router;
