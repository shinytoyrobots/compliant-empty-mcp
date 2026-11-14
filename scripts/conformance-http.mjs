#!/usr/bin/env node
// HTTP conformance probe. Spawns dist/http.js on a free port and checks the
// Streamable HTTP transport: lifecycle, empty lists, errors, and Origin handling.
//
// Exits 0 if every check passes, 1 otherwise.

import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const entry = resolve(here, "..", "dist", "http.js");
const PORT = String(30000 + Math.floor(Math.random() * 10000));
const base = `http://127.0.0.1:${PORT}`;

const child = spawn("node", [entry], { env: { ...process.env, PORT }, stdio: ["ignore", "ignore", "pipe"] });
await new Promise((ok, fail) => {
  child.stderr.on("data", (d) => String(d).includes("listening") && ok());
  child.on("exit", (c) => fail(new Error(`server exited early (${c})`)));
  setTimeout(() => fail(new Error("server did not start")), 5000);
});

const headers = { "Content-Type": "application/json", Accept: "application/json, text/event-stream" };

async function rpc(method, params = {}, extra = {}) {
  const res = await fetch(`${base}/mcp`, {
    method: "POST",
    headers: { ...headers, ...extra },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  });
  const text = await res.text();
  const data = text.split("\n").find((l) => l.startsWith("data:"))?.slice(5) ?? text;
  let body;
  try { body = JSON.parse(data); } catch { body = undefined; }
  return { res, body };
}

let failed = 0;
function check(label, pass, detail = "") {
  if (!pass) failed++;
  process.stdout.write(`  [${pass ? "PASS" : "FAIL"}] ${label}${detail ? ` — ${detail}` : ""}\n`);
}

try {
  process.stdout.write("MCP HTTP conformance probe — compliant-empty-mcp\n\n");

  const init = await rpc("initialize", {
    protocolVersion: "2025-11-25",
    capabilities: {},
    clientInfo: { name: "http-probe", version: "0.0.1" },
  });
  check("initialize negotiates 2025-11-25 with serverInfo",
    init.body?.result?.protocolVersion === "2025-11-25" &&
      init.body?.result?.serverInfo?.name === "compliant-empty-mcp");

  const notif = await fetch(`${base}/mcp`, {
    method: "POST", headers,
    body: JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized" }),
  });
  check("initialized notification returns 202", notif.status === 202, `status=${notif.status}`);

  const tools = await rpc("tools/list");
  check("tools/list returns []", tools.body?.result?.tools?.length === 0);
  const resources = await rpc("resources/list");
  check("resources/list returns []", resources.body?.result?.resources?.length === 0);
  const prompts = await rpc("prompts/list");
  check("prompts/list returns []", prompts.body?.result?.prompts?.length === 0);

  const unknown = await rpc("nonexistent/method");
  check("unknown method returns -32601", unknown.body?.error?.code === -32601);

  const get = await fetch(`${base}/mcp`);
  check("GET /mcp returns 405 (no SSE stream)", get.status === 405, `status=${get.status}`);
  const del = await fetch(`${base}/mcp`, { method: "DELETE" });
  check("DELETE /mcp returns 405 (stateless)", del.status === 405, `status=${del.status}`);

  const evil = await rpc("tools/list", {}, { Origin: "https://evil.example" });
  check("disallowed Origin is rejected with 403", evil.res.status === 403, `status=${evil.res.status}`);

  const local = await rpc("tools/list", {}, { Origin: "http://localhost:6274" });
  check("localhost Origin is allowed and echoed",
    local.res.status === 200 &&
      local.res.headers.get("access-control-allow-origin") === "http://localhost:6274");

  const preflight = await fetch(`${base}/mcp`, {
    method: "OPTIONS",
    headers: { Origin: "http://localhost:6274", "Access-Control-Request-Method": "POST" },
  });
  check("CORS preflight from allowed Origin returns 204", preflight.status === 204, `status=${preflight.status}`);
} catch (err) {
  failed++;
  process.stdout.write(`\nProbe crashed: ${err.message}\n`);
} finally {
  child.kill();
}

process.stdout.write(failed === 0 ? "\nAll checks passed.\n" : `\n${failed} check(s) failed.\n`);
process.exit(failed === 0 ? 0 : 1);
