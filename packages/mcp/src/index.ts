/**
 * @orka-js/mcp
 * 
 * Model Context Protocol (MCP) implementation for OrkaJS.
 * Provides client, server, and gateway for standardized LLM tool access.
 * 
 * @example Client usage
 * ```typescript
 * import { MCPClient } from '@orka-js/mcp';
 * 
 * const client = new MCPClient({ endpoint: 'http://localhost:3000/mcp' });
 * await client.connect();
 * const tools = await client.listTools();
 * const result = await client.callTool('get_customer', { id: '123' });
 * ```
 * 
 * @example Server usage
 * ```typescript
 * import { MCPServer } from '@orka-js/mcp';
 * 
 * const server = new MCPServer({ name: 'my-server', port: 3000 });
 * server.tool('get_customer', { description: '...', inputSchema: {...} }, async (args) => {
 *   return { success: true, content: [{ type: 'text', text: '...' }] };
 * });
 * await server.start();
 * ```
 * 
 * @example Gateway usage
 * ```typescript
 * import { MCPGateway } from '@orka-js/mcp';
 * 
 * const gateway = new MCPGateway({
 *   name: 'my-gateway',
 *   upstreams: [
 *     { name: 'crm', endpoint: 'http://localhost:3001/mcp' },
 *     { name: 'erp', endpoint: 'http://localhost:3002/mcp' },
 *   ],
 * });
 * await gateway.start();
 * ```
 */

// Types
export type {
  MCPTool,
  MCPSchema,
  MCPSchemaProperty,
  MCPToolAnnotations,
  MCPResource,
  MCPResourceAnnotations,
  MCPPrompt,
  MCPPromptArgument,
  MCPToolCall,
  MCPToolResult,
  MCPContent,
  MCPTextContent,
  MCPImageContent,
  MCPResourceContent,
  MCPResultMetadata,
  MCPServerCapabilities,
  MCPClientCapabilities,
  MCPServerInfo,
  MCPClientInfo,
  MCPRequest,
  MCPResponse,
  MCPNotification,
  MCPError,
  MCPTransport,
  MCPClientConfig,
  MCPServerConfig,
  MCPGatewayConfig,
  MCPUpstreamConfig,
  MCPToolHandler,
  MCPToolContext,
  MCPResourceHandler,
  MCPResourceContext,
  MCPPromptHandler,
  MCPPromptContext,
  MCPPromptMessage,
  MCPConnectionState,
  MCPConnectionEvent,
  MCPEventType,
  MCPEvent,
  MCPEventListener,
} from './types.js';

export { MCPErrorCodes } from './types.js';

// Client
export { MCPClient, createMCPClient } from './client.js';

// Server
export { MCPServer, createMCPServer } from './server.js';

// Gateway
export { MCPGateway, createMCPGateway } from './gateway.js';
