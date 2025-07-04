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

//WE can probably remove this
// import { collectAsyncIterable } from "@/utils/grpcHelpers.js";
// import { createClient as createBaseNodeClient } from "../baseNodeClient.js";
// import express from "express";
// const router = express.Router();

// router.get(
//   "/:asset_public_key",
//   async function (req: express.Request, res: express.Response) {
//     const baseNodeClient = createBaseNodeClient();
//     const asset_public_key = req.params.asset_public_key;

//     const tokens = await collectAsyncIterable(
//       baseNodeClient.getTokensInCirculation({
//         // heights:
//         asset_public_key: Buffer.from(asset_public_key, "hex"),
//       }),
//     );

//     if (!tokens || tokens.length === 0) {
//       res.status(404);
//       res.render("404", { message: `No tokens for asset found` });
//       return;
//     }

//     const json = {
//       title: `Asset with pub key: ${asset_public_key}`,
//       tokens: tokens,
//     };
//     if (req.query.json !== undefined) {
//       res.json(json);
//     } else {
//       res.render("assets", json);
//     }
//   },
// );

// export default router;
