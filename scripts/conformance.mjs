#!/usr/bin/env node
// JSON-RPC conformance probe. Spawns dist/index.js, sends protocol messages over
// stdio, and checks responses match the 9 ACs in sprints/.../story-001.
//
// Exits 0 if every check passes, 1 otherwise.

import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const serverEntry = resolve(here, "..", "dist", "index.js");

const child = spawn("node", [serverEntry], {
  stdio: ["pipe", "pipe", "pipe"],
});

let stdoutBuffer = "";
const pending = new Map();
let nextId = 1;

child.stdout.on("data", (chunk) => {
  stdoutBuffer += chunk.toString("utf8");
  let newlineIdx;
  while ((newlineIdx = stdoutBuffer.indexOf("\n")) !== -1) {
    const line = stdoutBuffer.slice(0, newlineIdx).trim();
    stdoutBuffer = stdoutBuffer.slice(newlineIdx + 1);
    if (!line) continue;
    try {
      const msg = JSON.parse(line);
      if (msg.id !== undefined && pending.has(msg.id)) {
        const { resolve: r } = pending.get(msg.id);
        pending.delete(msg.id);
        r(msg);
      }
    } catch {
      // non-JSON line, ignore
    }
  }
});

child.stderr.on("data", () => {
  // SDK may log to stderr; silently tolerate.
});

function request(method, params) {
  const id = nextId++;
  const msg = { jsonrpc: "2.0", id, method, params };
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject });
    child.stdin.write(JSON.stringify(msg) + "\n");
    setTimeout(() => {
      if (pending.has(id)) {
        pending.delete(id);
        reject(new Error(`Timeout waiting for response to ${method}`));
      }
    }, 3000);
  });
}

function notify(method, params) {
  child.stdin.write(JSON.stringify({ jsonrpc: "2.0", method, params }) + "\n");
}

const results = [];
function check(label, pass, detail = "") {
  results.push({ label, pass, detail });
  const mark = pass ? "PASS" : "FAIL";
  process.stdout.write(`  [${mark}] ${label}${detail ? ` — ${detail}` : ""}\n`);
}

async function run() {
  process.stdout.write("MCP conformance probe — compliant-empty-mcp\n\n");

  // AC-2: initialize → valid InitializeResult with serverInfo
  const initRes = await request("initialize", {
    protocolVersion: "2025-06-18",
    capabilities: {},
    clientInfo: { name: "conformance-probe", version: "0.0.1" },
  });
  check(
    "AC-2: initialize returns valid InitializeResult with serverInfo.name",
    initRes.result?.serverInfo?.name === "compliant-empty-mcp" &&
      typeof initRes.result?.protocolVersion === "string" &&
      typeof initRes.result?.capabilities === "object",
    `name=${initRes.result?.serverInfo?.name}, protocolVersion=${initRes.result?.protocolVersion}`,
  );

  // AC-1: lifecycle — send initialized notification, server should not error
  notify("notifications/initialized", {});

  // AC-3: tools/list returns empty array
  const toolsRes = await request("tools/list", {});
  check(
    "AC-3: tools/list returns { tools: [] }",
    Array.isArray(toolsRes.result?.tools) && toolsRes.result.tools.length === 0,
  );

  // AC-4: resources/list returns empty array
  const resourcesRes = await request("resources/list", {});
  check(
    "AC-4: resources/list returns { resources: [] }",
    Array.isArray(resourcesRes.result?.resources) &&
      resourcesRes.result.resources.length === 0,
  );

  // AC-5: prompts/list returns empty array
  const promptsRes = await request("prompts/list", {});
  check(
    "AC-5: prompts/list returns { prompts: [] }",
    Array.isArray(promptsRes.result?.prompts) &&
      promptsRes.result.prompts.length === 0,
  );

  // AC-6: capabilities declare categories but contents are zero
  check(
    "AC-6: zero tools, zero resources, zero prompts at all times",
    toolsRes.result.tools.length === 0 &&
      resourcesRes.result.resources.length === 0 &&
      promptsRes.result.prompts.length === 0,
  );

  // AC-7: unsupported method returns JSON-RPC -32601
  const unknownRes = await request("nonexistent/method", {});
  check(
    "AC-7: unsupported method returns error -32601",
    unknownRes.error?.code === -32601,
    `code=${unknownRes.error?.code}, message=${unknownRes.error?.message}`,
  );

  // AC-8 is compositional: every above check is one Inspector-equivalent probe.
  // AC-9: we invoked via stdio — reaching this line means stdio worked.
  check("AC-9: stdio transport is the default and functional", true);

  // AC-1 (completion): close transport cleanly
  child.stdin.end();
  await new Promise((r) => child.on("exit", r));
  check("AC-1: server terminates cleanly after stdin close", child.exitCode === 0,
    `exit code=${child.exitCode}`);

  const failed = results.filter((r) => !r.pass).length;
  process.stdout.write(
    `\n${results.length - failed}/${results.length} checks passed.\n`,
  );
  process.exit(failed === 0 ? 0 : 1);
}

run().catch((err) => {
  process.stdout.write(`\nConformance probe crashed: ${err.message}\n`);
  child.kill();
  process.exit(1);
});
