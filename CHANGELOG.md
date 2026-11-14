# Changelog

All notable changes to this project. Format follows [Keep a Changelog](https://keepachangelog.com/).

## [0.2.0] - 2026-11-14

### Added
- HTTP conformance probe (`npm run conformance:http`) covering lifecycle, empty lists, `-32601`, 405s, Origin handling, and CORS preflight (#7).
- `Origin` header validation on the HTTP transport, per the MCP spec's DNS-rebinding guidance. Allowed: `localhost`, `127.0.0.1`, `[::1]` on any port, plus origins in the `ALLOWED_ORIGINS` env var (comma-separated). Others get 403 (#7).
- stdio probe asserts negotiation of protocol `2025-11-25` (#7).

### Changed
- Targets MCP protocol version `2025-11-25` (#7).
- Dependencies: `@modelcontextprotocol/sdk` 1.32.2 (pinned), `express` 5.3, TypeScript 7, `@types/node` 26. `npm audit` reports 0 vulnerabilities (#7).
- Docker base image is `node:24-slim` (#7).
- CORS now echoes the allowed origin instead of `*`, and allows the `Mcp-Protocol-Version` header (#7).
- **Minimum Node version is now 20** (was 18), required by the updated dependencies (#7).

### Removed
- Stale reference to a sprint story file in the stdio probe's header comment (#7).

## 0.1.0 - 2026-04-17

### Added
- Entirely empty MCP server over stdio: `initialize`, plus empty `tools/list`, `resources/list`, `prompts/list` (#1).
- stdio conformance probe (#1).
- Streamable HTTP transport (stateless, `POST /mcp`) and Dockerfile (#3).
- Multi-stage Docker build so `tsc` is available during compile (#4).
- CORS headers for MCP Inspector cross-origin access (#5).
- README with live instance, testing guides, and deploy instructions (#6).
