function miningStats(block) {
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
  console.log("pow", powAlgo);

  let outputs = blockData.block.body.outputs;
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

  let numOutputsNoCoinbases = outputs.length - numCoinbases;
  let totalCoinbaseXtm = (totalCoinbase / 1e6).toLocaleString(undefined, {
    minimumFractionDigits: 6,
    maximumFractionDigits: 6,
  });
  let numInputs = blockData.block.body.inputs.length;

  return {
    totalCoinbaseXtm,
    numCoinbases,
    numOutputsNoCoinbases,
    numInputs,
    powAlgo,
  };
}

module.exports = { miningStats };
