import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { Readable } from "node:stream";
import { finished } from "node:stream/promises";
import AdmZip from "adm-zip";

const PLATFORM = os.platform(); // 'linux', 'darwin', 'win32'
const HARDWARE_ARCH = os.arch(); // 'x64', 'arm64', etc.
const REPO = "tari-project/tari";
const TARI_SUITE_PATTERN = new RegExp(`tari_suite-.*-${getTariArch()}\\.zip`);
const PROTO_BRANCH_REF = "mainnet";
const MINOTARI_NODE_EXEC_NAME = "minotari_node";
const MINOTARI_NODE_PATH = "./applications/minotari-node";

interface GithubFileType {
  name: string;
  type: string;
  download_url: string;
}

interface GithubAssetJson {
  assets: {
    name: string;
    browser_download_url;
  }[];
}

function getTariArch() {
  let tariPlatform: string = PLATFORM;
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

const getJSON = <T>(url) =>
  fetch(url, {
    headers: { "User-Agent": "node.js" },
  }).then((res) => res.json() as T);

const downloadFile = async (url, destination) => {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to download file: ${response.status}`);
  }

  if (!response.body) {
    throw new Error("Failed to find the body of the file");
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

  const files: GithubFileType[] = await getJSON(contentsUrl);

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

async function fetchMinotariNode() {
  const apiUrl = `https://api.github.com/repos/${REPO}/releases/latest`;
  const json: GithubAssetJson = await getJSON(apiUrl);

  const tariSuiteForHw = json.assets.find((a) =>
    TARI_SUITE_PATTERN.test(a.name),
  );
  if (!tariSuiteForHw) {
    console.error(`❌ No asset found matching pattern ${TARI_SUITE_PATTERN}`);
    process.exit(1);
  }

  const tariSuiteFileName = path.basename(tariSuiteForHw.browser_download_url);

  console.log(`   ⬇️ Downloading Tari Suite: ${tariSuiteFileName}...`);
  await fs.promises.mkdir(MINOTARI_NODE_PATH, {
    recursive: true,
  });

  const tariSuiteLocalPath = path.join(MINOTARI_NODE_PATH, tariSuiteFileName);

  await downloadFile(tariSuiteForHw.browser_download_url, tariSuiteLocalPath);
  console.log(`✅ Downloaded Tari Suite: ./${tariSuiteFileName}`);

  //Extract minotari Node
  var zip = new AdmZip(tariSuiteLocalPath);

  const zipEntries = zip.getEntries();
  const minotariNodeEntry = zipEntries.find(
    (entry) => (entry.name as string) === MINOTARI_NODE_EXEC_NAME,
  );

  if (!minotariNodeEntry) {
    throw new Error(`no ${MINOTARI_NODE_EXEC_NAME} found as executable`);
  }

  zip.extractEntryTo(minotariNodeEntry, MINOTARI_NODE_PATH, true, true);
  console.log(`✅ Exctracted Minotari Node to: ${MINOTARI_NODE_PATH}`);

  //Delete suite
  fs.unlinkSync(tariSuiteLocalPath);
}

async function fetchLatestSuite() {
  try {
    await fetchProtoFiles();
    await fetchMinotariNode();
  } catch (err) {
    console.error("🚨 Error:", (err as Error).message);
    process.exit(1);
  }
}

fetchLatestSuite();
