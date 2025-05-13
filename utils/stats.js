export function miningStats(block) {
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

  let powAlgo;
  if (blockData.block.header.pow.pow_algo == "0") {
    powAlgo = "Monero";
  } else {
    powAlgo = "SHA-3";
  };
  let timestamp = blockData.block.header.timestamp;
  timestamp = new Date(timestamp * 1000).toLocaleString("en-US", {
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

  outputs.forEach((output) => {
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
