#!/usr/bin/env node
/** serve.mjs — Local-only static server for the dashboard. No external deps. */
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve, normalize, extname } from "node:path";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const PORT = Number(process.env.PORT || 4173);
const TYPES = { ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".json": "application/json; charset=utf-8", ".svg": "image/svg+xml", ".md": "text/markdown; charset=utf-8" };

createServer(async (req, res) => {
  try {
    let p = decodeURIComponent((req.url || "/").split("?")[0]);
    if (p === "/") p = "/index.html";
    const full = normalize(join(ROOT, p));
    if (!full.startsWith(ROOT)) { res.writeHead(403).end("forbidden"); return; }
    const body = await readFile(full);
    res.writeHead(200, { "content-type": TYPES[extname(full)] || "application/octet-stream" });
    res.end(body);
  } catch {
    res.writeHead(404, { "content-type": "text/plain; charset=utf-8" }).end("not found");
  }
}).listen(PORT, "127.0.0.1", () => {
  console.log(`● Blumark24 dashboard على http://localhost:${PORT} (محلي فقط — Ctrl+C للإيقاف)`);
});
