import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { Readable } from "node:stream";
import { finished } from "node:stream/promises";

const PLATFORM = os.platform(); // 'linux', 'darwin', 'win32'
const HARDWARE_ARCH = os.arch(); // 'x64', 'arm64', etc.
const REPO = "tari-project/tari";
const TARI_SUITE_PATTERN = new RegExp(`tari_suite-.*-${getTariArch()}\\.zip`);
const PROTO_BRANCH_REF = "mainnet";

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
  await finished(Readable.fromWeb(response.body).pipe(fileStream));
};

async function fetchProtoFiles() {
  const protoDir = path.join("./applications/minotari_app_grpc/proto");

  // Ensure the proto directory exists
  await fs.promises.mkdir(protoDir, { recursive: true });

  console.log("📥 Fetching proto files list...");

  // Get the contents of the proto directory from GitHub API
  const contentsUrl = `https://api.github.com/repos/${REPO}/contents/applications/minotari_app_grpc/proto?ref=${PROTO_BRANCH_REF}`;
  const files = await getJSON(contentsUrl);

  console.log(`Found ${files.length} proto files`);

  for (const file of files) {
    if (file.type === "file" && file.name.endsWith(".proto")) {
      const destination = path.join(protoDir, file.name);
      console.log(`   ⬇️ Downloading ${file.name}...`);
      await downloadFile(file.download_url, destination);
    }
  }

  console.log("✅ All proto files downloaded successfully");
}

async function fetchLatestSuite() {
  try {
    // Download proto files first
    await fetchProtoFiles();

    //Download minotari_node latest
    const apiUrl = `https://api.github.com/repos/${REPO}/releases/latest`;
    const json = await getJSON(apiUrl);

    const tariSuiteForHw = json.assets.find((a) =>
      TARI_SUITE_PATTERN.test(a.name),
    );
    if (!tariSuiteForHw) {
      console.error(`❌ No asset found matching pattern ${TARI_SUITE_PATTERN}`);
      process.exit(1);
    }

    const tariSuiteFileName = path.basename(
      tariSuiteForHw.browser_download_url,
    );

    console.log(`   ⬇️ Downloading Tari Suite: ${tariSuiteFileName}...`);
    await fs.promises.mkdir("./applications/minotari-node", {
      recursive: true,
    });
    await downloadFile(
      tariSuiteForHw.browser_download_url,
      path.join("./applications/minotari-node", tariSuiteFileName),
    );
    console.log(`✅ Downloaded Tari Suite: ./${tariSuiteFileName}`);
  } catch (err) {
    console.error("🚨 Error:", err.message);
    process.exit(1);
  }
}

fetchLatestSuite();
