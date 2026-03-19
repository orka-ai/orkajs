# @orka-js/mcp

Model Context Protocol (MCP) implementation for OrkaJS. Provides client, server, and gateway for standardized LLM tool access.

## Installation

```bash
npm install @orka-js/mcp
# or
pnpm add @orka-js/mcp
```

## Features

- 🔌 **MCP Client** - Connect to any MCP-compatible server
- 🖥️ **MCP Server** - Expose tools, resources, and prompts via MCP
- 🌐 **MCP Gateway** - Route requests to multiple upstream servers with load balancing
- 🔄 **Auto-discovery** - Automatically discover tools from connected servers
- 🔒 **Authentication** - API key support for secure connections
- 📊 **Health checks** - Automatic upstream health monitoring
- 🎯 **Events** - Subscribe to tool calls, results, and errors

## Quick Start

### Client

```typescript
import { MCPClient } from '@orka-js/mcp';

const client = new MCPClient({
  endpoint: 'http://localhost:3000/mcp',
  apiKey: process.env.MCP_API_KEY,
});

await client.connect();

// List available tools
const tools = await client.listTools();
console.log('Available tools:', tools.map(t => t.name));

// Call a tool
const result = await client.callTool('get_customer', { id: '123' });
console.log('Result:', result);

// Read a resource
const contents = await client.readResource('file:///data/config.json');

// Get a prompt
const messages = await client.getPrompt('greeting', { name: 'John' });
```

### Server

```typescript
import { MCPServer } from '@orka-js/mcp';

const server = new MCPServer({
  name: 'my-mcp-server',
  port: 3000,
  apiKey: process.env.MCP_API_KEY,
});

// Register a tool
server.tool('get_customer', {
  description: 'Get customer by ID',
  inputSchema: {
    type: 'object',
    properties: {
      id: { type: 'string', description: 'Customer ID' }
    },
    required: ['id']
  }
}, async (args) => {
  const customer = await db.customers.findById(args.id);
  return {
    success: true,
    content: [{ type: 'text', text: JSON.stringify(customer) }]
  };
});

// Register a resource
server.resource('file:///data/config.json', {
  name: 'Configuration',
  description: 'Application configuration',
  mimeType: 'application/json'
}, async (uri) => {
  const config = await fs.readFile('./config.json', 'utf-8');
  return [{ type: 'text', text: config }];
});

// Register a prompt
server.prompt('greeting', {
  description: 'Generate a greeting message',
  arguments: [{ name: 'name', required: true }]
}, async (args) => {
  return [{
    role: 'user',
    content: { type: 'text', text: `Say hello to ${args.name}` }
  }];
});

await server.start();
```

### Gateway

```typescript
import { MCPGateway } from '@orka-js/mcp';

const gateway = new MCPGateway({
  name: 'my-gateway',
  port: 4000,
  upstreams: [
    { name: 'crm', endpoint: 'http://localhost:3001/mcp' },
    { name: 'erp', endpoint: 'http://localhost:3002/mcp' },
    { name: 'docs', endpoint: 'http://localhost:3003/mcp' },
  ],
});

await gateway.start();

// Check upstream status
const status = gateway.getUpstreamStatus();
console.log('Upstreams:', status);
```

## Events

```typescript
// Client events
client.on('tool:call', (event) => {
  console.log('Tool called:', event.data);
});

client.on('tool:result', (event) => {
  console.log('Tool result:', event.data);
});

// Server events
server.on('tool:call', (event) => {
  console.log('Incoming tool call:', event.data);
});

// Gateway events
gateway.on('tool:call', (event) => {
  console.log('Routed tool call:', event.data);
});
```

## Integration with OrkaJS Agents

```typescript
import { ReActAgent } from '@orka-js/agent';
import { MCPClient } from '@orka-js/mcp';

// Connect to MCP server
const mcp = new MCPClient({ endpoint: 'http://localhost:3000/mcp' });
await mcp.connect();

// Get tools from MCP
const mcpTools = await mcp.listTools();

// Convert MCP tools to OrkaJS tools
const tools = mcpTools.map(t => ({
  name: t.name,
  description: t.description,
  parameters: t.inputSchema.properties,
  execute: async (args) => {
    const result = await mcp.callTool(t.name, args);
    return result.content[0]?.text || '';
  }
}));

// Create agent with MCP tools
const agent = new ReActAgent({
  llm,
  tools,
  maxIterations: 10,
});

const result = await agent.run('Get customer 123 and summarize their orders');
```

## API Reference

### MCPClient

| Method | Description |
|--------|-------------|
| `connect()` | Connect to the MCP server |
| `disconnect()` | Disconnect from the server |
| `listTools()` | List available tools |
| `callTool(name, args)` | Call a tool |
| `listResources()` | List available resources |
| `readResource(uri)` | Read a resource |
| `listPrompts()` | List available prompts |
| `getPrompt(name, args)` | Get a prompt |

### MCPServer

| Method | Description |
|--------|-------------|
| `tool(name, options, handler)` | Register a tool |
| `resource(uri, options, handler)` | Register a resource |
| `prompt(name, options, handler)` | Register a prompt |
| `start()` | Start the server |
| `stop()` | Stop the server |

### MCPGateway

| Method | Description |
|--------|-------------|
| `addUpstream(config)` | Add an upstream server |
| `removeUpstream(name)` | Remove an upstream server |
| `getUpstreamStatus()` | Get status of all upstreams |
| `start()` | Start the gateway |
| `stop()` | Stop the gateway |

## License

MIT
