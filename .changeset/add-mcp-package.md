---
"@orka-js/mcp": minor
"orkajs": minor
---

feat(mcp): Add Model Context Protocol (MCP) package

- MCPClient: Connect to MCP servers, list/call tools, read resources, get prompts
- MCPServer: Expose tools, resources, and prompts via MCP protocol
- MCPGateway: Route requests to multiple upstream MCP servers with health checks
- Full JSON-RPC 2.0 implementation
- Event system for monitoring tool calls and results
- Authentication support via API keys
