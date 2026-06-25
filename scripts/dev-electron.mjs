import { spawn } from "node:child_process";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const port = Number(process.env.PORT || 3000);
const startUrl = `http://localhost:${port}`;

function spawnProcess(command, args, env = {}) {
  return spawn(command, args, {
    cwd: root,
    env: { ...process.env, ...env },
    shell: process.platform === "win32",
    stdio: "inherit",
  });
}

function waitForServer(url, timeoutMs = 45_000) {
  const startedAt = Date.now();

  return new Promise((resolve, reject) => {
    const tick = () => {
      const req = http.get(url, (res) => {
        res.resume();
        resolve();
      });

      req.on("error", () => {
        if (Date.now() - startedAt > timeoutMs) {
          reject(new Error(`Timed out waiting for ${url}`));
          return;
        }

        setTimeout(tick, 450);
      });
    };

    tick();
  });
}

const next = spawnProcess("npx", ["next", "dev", "-p", String(port)], {
  NEXT_PUBLIC_VIBELIVE_CLIENT_ONLY: "1",
});

const shutdown = () => {
  next.kill("SIGTERM");
};

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

await waitForServer(startUrl);

const electron = spawnProcess("npx", ["electron", "."], {
  ELECTRON_START_URL: startUrl,
  NEXT_PUBLIC_VIBELIVE_CLIENT_ONLY: "1",
});

electron.on("exit", (code) => {
  next.kill("SIGTERM");
  process.exit(code ?? 0);
});
