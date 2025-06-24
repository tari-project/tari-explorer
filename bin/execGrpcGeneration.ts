import { exec } from "node:child_process";
import os from "node:os";

const command =
  os.platform() === "win32"
    ? "npm run grpc:generate:win"
    : "npm run grpc:generate:unix";

exec(command, (error, stdout, stderr) => {
  if (error) {
    console.error(`Error: ${error.message}`);
    return;
  }

  if (stderr) {
    console.error(`stderr: ${stderr}`);
  }

  console.log(`${stdout}`);
});
