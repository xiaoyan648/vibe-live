import { existsSync } from "node:fs";
import { mkdir, rename, rm } from "node:fs/promises";
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const apiDir = path.join(root, "src", "app", "api");
const buildDir = path.join(root, ".desktop-build");
const hiddenApiDir = path.join(buildDir, "api-routes");

function run(command, args, env = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: root,
      env: { ...process.env, ...env },
      shell: process.platform === "win32",
      stdio: "inherit",
    });

    child.on("exit", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${command} ${args.join(" ")} exited with ${code}`));
    });
    child.on("error", reject);
  });
}

async function moveApiRoutesOut() {
  await mkdir(buildDir, { recursive: true });
  await rm(hiddenApiDir, { recursive: true, force: true });

  if (existsSync(apiDir)) {
    await rename(apiDir, hiddenApiDir);
  }
}

async function restoreApiRoutes() {
  if (existsSync(hiddenApiDir) && !existsSync(apiDir)) {
    await rename(hiddenApiDir, apiDir);
  }
}

try {
  await moveApiRoutesOut();
  await run("npx", ["next", "build"], {
    NEXT_OUTPUT: "export",
    NEXT_PUBLIC_VIBELIVE_CLIENT_ONLY: "1",
  });
} finally {
  await restoreApiRoutes();
}
