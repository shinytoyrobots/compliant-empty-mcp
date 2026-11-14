#!/usr/bin/env node
import express from "express";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import {
  ListToolsRequestSchema,
  ListResourcesRequestSchema,
  ListPromptsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

function createMcpServer(): Server {
  const server = new Server(
    { name: "compliant-empty-mcp", version: "0.2.0" },
    { capabilities: { tools: {}, resources: {}, prompts: {} } },
  );
  server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: [] }));
  server.setRequestHandler(ListResourcesRequestSchema, async () => ({ resources: [] }));
  server.setRequestHandler(ListPromptsRequestSchema, async () => ({ prompts: [] }));
  return server;
}

const app = express();

// Origin validation (MCP spec: servers MUST validate Origin to prevent DNS rebinding).
// Allowed: localhost/127.0.0.1/[::1] on any port, and any
// origin listed in ALLOWED_ORIGINS (comma-separated). Requests with no Origin header
// (non-browser clients like curl) are always allowed.
const extraOrigins = new Set(
  (process.env.ALLOWED_ORIGINS ?? "").split(",").map((o) => o.trim()).filter(Boolean),
);

function isAllowedOrigin(origin: string): boolean {
  if (extraOrigins.has(origin)) return true;
  let url: URL;
  try {
    url = new URL(origin);
  } catch {
    return false;
  }
  if (["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)) return true;
  return false;
}

app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (origin !== undefined) {
    if (!isAllowedOrigin(origin)) {
      res.status(403).json({ error: "Forbidden: Origin not allowed" });
      return;
    }
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS");
    res.setHeader(
      "Access-Control-Allow-Headers",
      "Content-Type, Accept, Mcp-Session-Id, Mcp-Protocol-Version, Last-Event-Id",
    );
    res.setHeader("Access-Control-Expose-Headers", "Mcp-Session-Id");
  }
  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }
  next();
});

app.use(express.json());

app.post("/mcp", async (req, res) => {
  const server = createMcpServer();
  const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });

  res.on("close", () => {
    transport.close();
    server.close();
  });

  await server.connect(transport);
  await transport.handleRequest(req, res, req.body);
});

app.get("/mcp", (_req, res) => {
  res.writeHead(405).end(JSON.stringify({ error: "Method not allowed — stateless mode, no SSE" }));
});

app.delete("/mcp", (_req, res) => {
  res.writeHead(405).end(JSON.stringify({ error: "Method not allowed — stateless mode, no sessions" }));
});

app.get("/", (_req, res) => {
  res.json({
    name: "compliant-empty-mcp",
    description: "An entirely empty MCP server. It does nothing. That is the point.",
    mcp_endpoint: "/mcp",
    transport: "Streamable HTTP (stateless)",
  });
});

const PORT = parseInt(process.env.PORT || "3000", 10);
app.listen(PORT, "0.0.0.0", () => {
  console.error(`Empty MCP server listening on http://0.0.0.0:${PORT}/mcp`);
});
