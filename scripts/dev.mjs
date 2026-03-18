import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import http from "node:http";

const root = process.cwd();
const electronBinary = resolve(root, "node_modules", ".bin", "electron.cmd");

const children = [];

function run(command, args, env = {}) {
  const child = spawn(command, args, {
    cwd: root,
    stdio: "inherit",
    env: { ...process.env, ...env },
    shell: false
  });

  children.push(child);
  child.on("exit", (code) => {
    if (code && code !== 0) {
      process.exitCode = code;
      shutdown();
    }
  });

  return child;
}

function waitForFile(filePath) {
  return new Promise((resolveWait) => {
    const timer = setInterval(() => {
      if (existsSync(filePath)) {
        clearInterval(timer);
        resolveWait(undefined);
      }
    }, 250);
  });
}

function waitForUrl(url) {
  return new Promise((resolveWait) => {
    const tick = () => {
      const req = http.get(url, () => {
        req.destroy();
        resolveWait(undefined);
      });
      req.on("error", () => setTimeout(tick, 300));
    };
    tick();
  });
}

function shutdown() {
  while (children.length > 0) {
    const child = children.pop();
    if (child && !child.killed) {
      child.kill();
    }
  }
}

process.on("SIGINT", () => {
  shutdown();
  process.exit(0);
});

process.on("SIGTERM", () => {
  shutdown();
  process.exit(0);
});

run("npm.cmd", ["run", "build:electron", "--", "--watch"]);
run("npm.cmd", ["run", "build:renderer", "--", "--watch"]);

await Promise.all([
  waitForFile(resolve(root, "dist", "main", "app.js")),
  waitForUrl("http://127.0.0.1:5173")
]);

run(electronBinary, ["."], { VITE_DEV_SERVER_URL: "http://127.0.0.1:5173" });
