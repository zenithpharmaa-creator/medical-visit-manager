import { createServer } from "node:http";
import { createReadStream, statSync } from "node:fs";
import { extname, join, normalize } from "node:path";

const root = process.argv[2] ?? "/tmp/medical-web-export";
const port = Number(process.env.STATIC_PORT ?? 8090);
const types = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".png": "image/png", ".svg": "image/svg+xml", ".ico": "image/x-icon", ".woff2": "font/woff2" };

const server = createServer((request, response) => {
  const requested = decodeURIComponent((request.url ?? "/").split("?")[0]);
  const relative = requested === "/" ? "/index.html" : requested;
  const file = join(root, normalize(relative).replace(/^\.\.[/\\]/, ""));
  try {
    const stat = statSync(file);
    if (!stat.isFile()) throw new Error("not a file");
    response.writeHead(200, { "Content-Type": types[extname(file)] ?? "application/octet-stream", "Cache-Control": "no-store" });
    createReadStream(file).pipe(response);
  } catch {
    const fallback = join(root, "index.html");
    try {
      response.writeHead(200, { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" });
      createReadStream(fallback).pipe(response);
    } catch {
      response.writeHead(404);
      response.end("Not found");
    }
  }
});
server.listen(port, "127.0.0.1", () => console.log(`[static-server] serving ${root} at http://127.0.0.1:${port}`));
for (const signal of ["SIGINT", "SIGTERM"]) process.once(signal, () => server.close(() => process.exit(0)));
