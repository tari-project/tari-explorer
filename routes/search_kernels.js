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

var { createClient } = require("../baseNodeClient");

var express = require("express");
var router = express.Router();

router.get("/", async function (req, res) {
  let client = createClient();
  let nonces = (req.query.nonces || "").split(",");
  let signatures = (req.query.signatures || "").split(",");

  if (
    nonces.length === 0 ||
    signatures.length === 0 ||
    nonces.length !== signatures.length
  ) {
    res.status(404);
    return;
  }
  let params = [];
  for (let i = 0; i < nonces.length; i++) {
    params.push({
      public_nonce: Buffer.from(nonces[i], "hex"),
      signature: Buffer.from(signatures[i], "hex"),
    });
  }
  let result;
  try {
    result = await client.searchKernels({ signatures: params });
  } catch (error) {
    res.status(404);
    if (req.query.json !== undefined) {
      res.json({ error: error });
    } else {
      res.render("error", { error: error });
    }
    return;
  }
  let json = {
    items: result,
  };
  if (req.query.json !== undefined) {
    res.json(json);
  } else {
    res.render("search", json);
  }
});

module.exports = router;
