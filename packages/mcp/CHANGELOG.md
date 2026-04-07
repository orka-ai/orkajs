# @orka-js/mcp

## 1.1.3

### Patch Changes

- chore: update packages
- Updated dependencies
  - @orka-js/core@1.5.1

## 1.1.2

### Patch Changes

- Fix: Replace workspace:\* dependencies with actual npm versions

  This fixes a critical bug where packages were published with workspace:\*
  dependencies that cannot be resolved when installed from npm.

## 1.1.1

### Patch Changes

- Updated dependencies
  - @orka-js/core@1.3.2

## 1.1.0

### Minor Changes

- 93651a4: feat(mcp): Add Model Context Protocol (MCP) package

  - MCPClient: Connect to MCP servers, list/call tools, read resources, get prompts
  - MCPServer: Expose tools, resources, and prompts via MCP protocol
  - MCPGateway: Route requests to multiple upstream MCP servers with health checks
  - Full JSON-RPC 2.0 implementation
  - Event system for monitoring tool calls and results
  - Authentication support via API keys

### Patch Changes

- Updated dependencies [93651a4]
  - @orka-js/core@1.3.1
