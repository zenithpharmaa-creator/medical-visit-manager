import { spawn } from "node:child_process";
import { existsSync, rmSync } from "node:fs";
import { join } from "node:path";

for (const cachePath of [
  join(process.cwd(), ".metro-cache"),
  join(process.cwd(), "node_modules/.cache/metro"),
  join(process.cwd(), "node_modules/.cache/metro-file-map"),
]) {
  if (existsSync(cachePath)) {
    rmSync(cachePath, { recursive: true, force: true });
    console.log(`[metro-start] removed disposable cache: ${cachePath}`);
  }
}

const port = process.env.EXPO_PORT ?? "8081";
const child = spawn("npx", ["expo", "start", "--web", "--port", port], {
  cwd: process.cwd(),
  env: {
    ...process.env,
    EXPO_NO_METRO_WORKSPACE_ROOT: "1",
    EXPO_NO_DOCTOR: "1",
    METRO_MAX_WORKERS: "1",
    NODE_OPTIONS: process.env.NODE_OPTIONS ?? "--max-old-space-size=640",
  },
  stdio: "inherit",
  shell: false,
});

child.once("error", (error) => {
  console.error(`[metro-start] ${error.message}`);
  process.exitCode = 1;
});
child.once("exit", (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  else process.exitCode = code ?? 1;
});
for (const signal of ["SIGINT", "SIGTERM"]) process.once(signal, () => child.kill(signal));
