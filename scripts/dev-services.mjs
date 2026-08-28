import { spawn } from "node:child_process";

const services = [
  {
    name: "api",
    command: "pnpm",
    args: ["run", "dev:server:standalone"],
    delay: 1500,
  },
  {
    name: "metro",
    command: "pnpm",
    args: ["run", "dev:metro:standalone"],
    delay: 2500,
  },
];

const children = new Map();
const retryCount = new Map();
let shuttingDown = false;

function startService(service) {
  if (shuttingDown) return;
  const attempt = retryCount.get(service.name) ?? 0;
  const child = spawn(service.command, service.args, {
    cwd: process.cwd(),
    env: { ...process.env },
    stdio: "inherit",
    shell: false,
  });
  children.set(service.name, child);
  console.log(`[dev-services] ${service.name} started (pid ${child.pid})`);

  child.once("error", (error) => {
    console.error(`[dev-services] ${service.name} error: ${error.message}`);
  });
  child.once("exit", (code, signal) => {
    children.delete(service.name);
    if (shuttingDown) return;
    const nextAttempt = attempt + 1;
    retryCount.set(service.name, nextAttempt);
    const backoff = Math.min(service.delay * 2 ** Math.min(nextAttempt - 1, 4), 30_000);
    console.error(`[dev-services] ${service.name} exited (code=${code ?? "-"}, signal=${signal ?? "-"}); restarting in ${backoff}ms`);
    setTimeout(() => startService(service), backoff).unref();
  });
}

function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`[dev-services] ${signal}; stopping API and Metro`);
  for (const child of children.values()) child.kill("SIGTERM");
  setTimeout(() => {
    for (const child of children.values()) child.kill("SIGKILL");
    process.exit(0);
  }, 5000).unref();
}

process.once("SIGINT", () => shutdown("SIGINT"));
process.once("SIGTERM", () => shutdown("SIGTERM"));
for (const service of services) startService(service);
