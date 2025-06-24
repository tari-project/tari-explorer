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
  const nonces = ((req.query.nonces || "") as string)
    .split(",")
    .map((ref) => ref.trim())
    .filter((ref) => /^[a-fA-F0-9]{64}$/.test(ref));
  const signatures = ((req.query.signatures || "") as string)
    .split(",")
    .map((ref) => ref.trim())
    .filter((ref) => /^[a-fA-F0-9]{64}$/.test(ref));

  if (
    nonces.length === 0 ||
    signatures.length === 0 ||
    nonces.length !== signatures.length
  ) {
    if (req.query.json !== undefined) {
      res.json({});
    } else {
      res.render("search_kernels");
    }
    return;
  }
  const params: { public_nonce: Buffer; signature: Buffer }[] = [];
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
  const json = {
    items: result,
  };
  if (req.query.json !== undefined) {
    res.json(json);
  } else {
    res.render("search", json);
  }
});

export default router;
