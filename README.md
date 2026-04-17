# compliant-empty-mcp

An entirely empty MCP server that passes protocol conformance.

This is a rhetorical artifact: a fully-valid Model Context Protocol server that advertises zero tools, zero resources, and zero prompts. It exists to demonstrate that **"we have an MCP" is a valueless claim**. MCP is a protocol, not a product. A server can be 100% conformant and do absolutely nothing.

## Run it (stdio)

```bash
npx -y github:shinytoyrobots/compliant-empty-mcp
```

Or clone and build:

```bash
git clone https://github.com/shinytoyrobots/compliant-empty-mcp
cd compliant-empty-mcp
npm install
npm run build
npm start
```

The server speaks JSON-RPC 2.0 over stdio. It responds to `initialize`, `tools/list`, `resources/list`, and `prompts/list` — the last three with empty arrays. Any other method returns JSON-RPC error `-32601` ("Method not found").

## Run it (HTTP)

```bash
npm run start:http
```

This starts a Streamable HTTP transport on port 3000 (or `$PORT`). The MCP endpoint is `POST /mcp`.

```bash
curl -X POST http://localhost:3000/mcp \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-06-18","capabilities":{},"clientInfo":{"name":"curl","version":"0.1"}}}'
```

### Deploy it

The HTTP server runs on any platform that hosts Node.js. A `Dockerfile` is included.

**Render** (free tier): connect this repo, set build command `npm install && npm run build`, start command `npm run start:http`.

**Fly.io**: `fly launch` auto-detects the Dockerfile.

**Railway**: import from GitHub, it auto-detects Node.js.

## Verify conformance

```bash
npm run conformance
```

Output:

```
MCP conformance probe — compliant-empty-mcp

  [PASS] AC-2: initialize returns valid InitializeResult with serverInfo.name
  [PASS] AC-3: tools/list returns { tools: [] }
  [PASS] AC-4: resources/list returns { resources: [] }
  [PASS] AC-5: prompts/list returns { prompts: [] }
  [PASS] AC-6: zero tools, zero resources, zero prompts at all times
  [PASS] AC-7: unsupported method returns error -32601
  [PASS] AC-9: stdio transport is the default and functional
  [PASS] AC-1: server terminates cleanly after stdin close

8/8 checks passed.
```

You can also point the [official MCP Inspector](https://github.com/modelcontextprotocol/inspector) at it — every check will pass because there is nothing to break.

## How empty is it?

The full implementation fits in one file:

```ts
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  ListToolsRequestSchema,
  ListResourcesRequestSchema,
  ListPromptsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

const server = new Server(
  { name: "compliant-empty-mcp", version: "0.1.0" },
  { capabilities: { tools: {}, resources: {}, prompts: {} } },
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: [] }));
server.setRequestHandler(ListResourcesRequestSchema, async () => ({ resources: [] }));
server.setRequestHandler(ListPromptsRequestSchema, async () => ({ prompts: [] }));

await server.connect(new StdioServerTransport());
```

That is the entire product. It is a valid MCP server. It does nothing.

## The point

Next time a vendor tells you they "have an MCP," ask what's in it.

## License

MIT
