const fs = require("fs");
const path = require("path");
const os = require("os");

const PLATFORM = os.platform(); // 'linux', 'darwin', 'win32'
const HARDWARE_ARCH = os.arch(); // 'x64', 'arm64', etc.

const REPO = "tari-project/tari";
// const ARCH = `${PLATFORM}-${HARDWARE_ARCH}`; // Change this to your architecture
const PATTERN = new RegExp(`tari_suite-.*-${getTariArch()}\\.zip`);

console.log(`Platform: ${PLATFORM}`);
console.log(`Architecture: ${HARDWARE_ARCH}`);
function getTariArch() {
  let tariPlatform = PLATFORM;
  let tariArch = HARDWARE_ARCH;

  // Normalize platform names
  if (tariPlatform === "win32") {
    tariPlatform = "windows";
    if (tariArch === "x64") {
      tariArch = "x64";
    }
  } else if (tariPlatform === "darwin") {
    tariPlatform = "macos";
    if (tariArch === "x64") {
      tariArch = "x86_64";
    }
    // Note: arm64 stays as arm64
  } else if (tariPlatform === "linux") {
    if (tariArch === "x64") {
      tariArch = "x86_64";
    }
    // Note: arm64 stays as arm64
    // Note: riscv64 stays as riscv64
  }

  return `${tariPlatform}-${tariArch}`;
}

const getJSON = (url) =>
  fetch(url, {
    headers: { "User-Agent": "node.js" },
  }).then((res) => res.json());

const downloadFile = async (url, destination) => {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to download file: ${response.status}`);
  }
  const fileStream = fs.createWriteStream(destination);
  await new Promise((resolve, reject) => {
    const stream = response.body.pipe(fileStream);
    stream.on("finish", resolve);
    stream.on("error", reject);
  });
};

async function fetchLatestSuite() {
  try {
    const apiUrl = `https://api.github.com/repos/${REPO}/releases/latest`;
    const json = await getJSON(apiUrl);

    const asset = json.assets.find((a) => PATTERN.test(a.name));
    if (!asset) {
      console.error(`❌ No asset found matching pattern ${PATTERN}`);
      process.exit(1);
    }

    const fileName = path.basename(asset.browser_download_url);
    console.log(`⬇️ Downloading ${fileName}...`);
    await downloadFile(asset.browser_download_url, fileName);
    console.log(`✅ Downloaded to ./${fileName}`);
  } catch (err) {
    console.error("🚨 Error:", err.message);
    process.exit(1);
  }
}

fetchLatestSuite();
