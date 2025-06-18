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

import { HistoricalBlock } from "@/grpc-gen/block.js";

export function miningStats(block: HistoricalBlock | HistoricalBlock[]) {
  // Handle both object and array cases
  const blockData = Array.isArray(block) ? block[0] : block;

  if (
    !blockData ||
    typeof blockData !== "object" ||
    !blockData.block?.body?.outputs ||
    !Array.isArray(blockData.block.body.outputs)
  ) {
    throw new Error("Invalid block data");
  }

  let powAlgo: string;
  if (blockData?.block?.header?.pow?.pow_algo == 0n) {
    powAlgo = "Monero";
  } else {
    powAlgo = "SHA-3";
  }
  const timestampNumber: number = Number(blockData?.block?.header?.timestamp);
  const timestamp = new Date(timestampNumber * 1000).toLocaleString("en-US", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });

  const outputs = blockData.block.body.outputs;
  let totalCoinbase = 0;
  let numCoinbases = 0;

  outputs.forEach((output: any) => {
    if (
      output.features?.output_type === 1 &&
      output.features?.range_proof_type === 1
    ) {
      totalCoinbase += parseInt(output.minimum_value_promise || 0, 10);
      numCoinbases++;
    }
  });

  const numOutputsNoCoinbases = outputs.length - numCoinbases;
  const totalCoinbaseXtm = (totalCoinbase / 1e6).toLocaleString(undefined, {
    minimumFractionDigits: 6,
    maximumFractionDigits: 6,
  });
  const numInputs = blockData.block.body.inputs.length;

  return {
    totalCoinbaseXtm,
    numCoinbases,
    numOutputsNoCoinbases,
    numInputs,
    powAlgo,
    timestamp,
  };
}
