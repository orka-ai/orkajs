/**
 * MCP Server
 * 
 * Exposes tools, resources, and prompts via the MCP protocol.
 * 
 * @example
 * ```typescript
 * import { MCPServer } from '@orka-js/mcp';
 * 
 * const server = new MCPServer({
 *   name: 'my-mcp-server',
 *   port: 3000,
 * });
 * 
 * server.tool('get_customer', {
 *   description: 'Get customer by ID',
 *   inputSchema: {
 *     type: 'object',
 *     properties: { id: { type: 'string' } },
 *     required: ['id']
 *   }
 * }, async (args) => {
 *   return { success: true, content: [{ type: 'text', text: JSON.stringify(args) }] };
 * });
 * 
 * await server.start();
 * ```
 */

import { createServer, type Server, type IncomingMessage, type ServerResponse } from 'http';
import { generateId, OrkaError, OrkaErrorCode } from '@orka-js/core';
import type {
  MCPServerConfig,
  MCPServerInfo,
  MCPServerCapabilities,
  MCPTool,
  MCPResource,
  MCPPrompt,
  MCPToolHandler,
  MCPResourceHandler,
  MCPPromptHandler,
  MCPToolResult,
  MCPContent,
  MCPRequest,
  MCPSchema,
  MCPToolAnnotations,
  MCPResourceAnnotations,
  MCPPromptArgument,
  MCPEvent,
  MCPEventListener,
  MCPEventType,
} from './types.js';

export class MCPServer {
  private config: MCPServerConfig;
  private httpServer: Server | null = null;
  private tools: Map<string, { definition: MCPTool; handler: MCPToolHandler }> = new Map();
  private resources: Map<string, { definition: MCPResource; handler: MCPResourceHandler }> = new Map();
  private prompts: Map<string, { definition: MCPPrompt; handler: MCPPromptHandler }> = new Map();
  private eventListeners: Map<MCPEventType, Set<MCPEventListener>> = new Map();
  private isRunning = false;

  constructor(config: MCPServerConfig) {
    this.config = { version: '1.0.0', port: 3000, host: 'localhost', cors: true, ...config };
  }

  getServerInfo(): MCPServerInfo {
    return {
      name: this.config.name,
      version: this.config.version!,
      protocolVersion: '2024-11-05',
      capabilities: this.getCapabilities(),
    };
  }

  getCapabilities(): MCPServerCapabilities {
    return {
      tools: this.tools.size > 0 ? { listChanged: true } : undefined,
      resources: this.resources.size > 0 ? { subscribe: true, listChanged: true } : undefined,
      prompts: this.prompts.size > 0 ? { listChanged: true } : undefined,
      logging: {},
    };
  }

  tool(name: string, options: { description: string; inputSchema: MCPSchema; annotations?: MCPToolAnnotations }, handler: MCPToolHandler): this {
    this.tools.set(name, { definition: { name, ...options }, handler });
    if (this.config.verbose) console.log(`[MCP Server] Registered tool: ${name}`);
    return this;
  }

  resource(uri: string, options: { name: string; description?: string; mimeType?: string; annotations?: MCPResourceAnnotations }, handler: MCPResourceHandler): this {
    this.resources.set(uri, { definition: { uri, ...options }, handler });
    if (this.config.verbose) console.log(`[MCP Server] Registered resource: ${uri}`);
    return this;
  }

  prompt(name: string, options: { description?: string; arguments?: MCPPromptArgument[] }, handler: MCPPromptHandler): this {
    this.prompts.set(name, { definition: { name, ...options }, handler });
    if (this.config.verbose) console.log(`[MCP Server] Registered prompt: ${name}`);
    return this;
  }

  async start(): Promise<void> {
    if (this.isRunning) return;
    return new Promise((resolve, reject) => {
      this.httpServer = createServer((req, res) => this.handleRequest(req, res).catch(() => this.sendError(res, -32603, 'Internal error')));
      this.httpServer.on('error', reject);
      this.httpServer.listen(this.config.port, this.config.host, () => {
        this.isRunning = true;
        console.log(`[MCP Server] ${this.config.name} running at http://${this.config.host}:${this.config.port}`);
        resolve();
      });
    });
  }

  async stop(): Promise<void> {
    if (!this.isRunning || !this.httpServer) return;
    return new Promise((resolve, reject) => {
      this.httpServer!.close(err => { if (err) reject(err); else { this.isRunning = false; resolve(); } });
    });
  }

  isServerRunning(): boolean { return this.isRunning; }

  private async handleRequest(req: IncomingMessage, res: ServerResponse): Promise<void> {
    if (this.config.cors) {
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
      if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }
    }
    if (req.method !== 'POST') { res.writeHead(405); res.end('Method Not Allowed'); return; }
    if (this.config.apiKey) {
      const auth = req.headers.authorization;
      if (!auth || auth !== `Bearer ${this.config.apiKey}`) { res.writeHead(401); res.end('Unauthorized'); return; }
    }
    const body = await this.parseBody(req);
    if (!body) { this.sendError(res, -32700, 'Parse error'); return; }
    const request = body as MCPRequest;
    if (!request.jsonrpc || request.jsonrpc !== '2.0') { this.sendError(res, -32600, 'Invalid Request'); return; }
    const result = await this.handleMethod(request);
    res.setHeader('Content-Type', 'application/json');
    res.writeHead(200);
    res.end(JSON.stringify({ jsonrpc: '2.0', id: request.id, ...result }));
  }

  private async handleMethod(request: MCPRequest): Promise<{ result?: unknown; error?: { code: number; message: string } }> {
    const { method, params } = request;
    try {
      switch (method) {
        case 'initialize': return { result: this.getServerInfo() };
        case 'notifications/initialized': return { result: {} };
        case 'tools/list': return { result: { tools: Array.from(this.tools.values()).map(t => t.definition) } };
        case 'tools/call': return { result: await this.handleToolCall(params as { name: string; arguments: Record<string, unknown> }) };
        case 'resources/list': return { result: { resources: Array.from(this.resources.values()).map(r => r.definition) } };
        case 'resources/read': return { result: await this.handleResourceRead(params as { uri: string }) };
        case 'resources/subscribe': case 'resources/unsubscribe': return { result: {} };
        case 'prompts/list': return { result: { prompts: Array.from(this.prompts.values()).map(p => p.definition) } };
        case 'prompts/get': return { result: await this.handlePromptGet(params as { name: string; arguments?: Record<string, string> }) };
        case 'ping': return { result: {} };
        default: return { error: { code: -32601, message: `Method not found: ${method}` } };
      }
    } catch (error) { return { error: { code: -32603, message: (error as Error).message } }; }
  }

  private async handleToolCall(params: { name: string; arguments: Record<string, unknown> }): Promise<MCPToolResult> {
    const tool = this.tools.get(params.name);
    if (!tool) return { success: false, content: [{ type: 'text', text: `Tool not found: ${params.name}` }], error: `Tool not found: ${params.name}` };
    const startTime = Date.now();
    this.emit('tool:call', { tool: params.name, args: params.arguments });
    try {
      const result = await tool.handler(params.arguments, { requestId: generateId() });
      this.emit('tool:result', { tool: params.name, result, durationMs: Date.now() - startTime });
      return { ...result, metadata: { ...result.metadata, durationMs: Date.now() - startTime } };
    } catch (error) {
      this.emit('tool:error', { tool: params.name, error });
      return { success: false, content: [{ type: 'text', text: (error as Error).message }], error: (error as Error).message };
    }
  }

  private async handleResourceRead(params: { uri: string }): Promise<{ contents: MCPContent[] }> {
    const resource = this.resources.get(params.uri);
    if (!resource) throw new OrkaError(`Resource not found: ${params.uri}`, OrkaErrorCode.NOT_FOUND, 'mcp');
    this.emit('resource:read', { uri: params.uri });
    return { contents: await resource.handler(params.uri, { requestId: generateId() }) };
  }

  private async handlePromptGet(params: { name: string; arguments?: Record<string, string> }): Promise<{ messages: unknown[] }> {
    const prompt = this.prompts.get(params.name);
    if (!prompt) throw new OrkaError(`Prompt not found: ${params.name}`, OrkaErrorCode.NOT_FOUND, 'mcp');
    this.emit('prompt:get', { name: params.name, args: params.arguments });
    return { messages: await prompt.handler(params.arguments || {}, { requestId: generateId() }) };
  }

  private parseBody(req: IncomingMessage): Promise<unknown> {
    return new Promise(resolve => {
      let body = '';
      req.on('data', chunk => body += chunk.toString());
      req.on('end', () => { try { resolve(JSON.parse(body)); } catch { resolve(null); } });
      req.on('error', () => resolve(null));
    });
  }

  private sendError(res: ServerResponse, code: number, message: string): void {
    res.setHeader('Content-Type', 'application/json');
    res.writeHead(200);
    res.end(JSON.stringify({ jsonrpc: '2.0', id: 0, error: { code, message } }));
  }

  on(event: MCPEventType, listener: MCPEventListener): void {
    if (!this.eventListeners.has(event)) this.eventListeners.set(event, new Set());
    this.eventListeners.get(event)!.add(listener);
  }

  off(event: MCPEventType, listener: MCPEventListener): void { this.eventListeners.get(event)?.delete(listener); }

  private emit(type: MCPEventType, data: unknown): void {
    const event: MCPEvent = { type, timestamp: new Date(), data };
    this.eventListeners.get(type)?.forEach(l => { try { l(event); } catch {} });
  }
}

export function createMCPServer(config: MCPServerConfig): MCPServer { return new MCPServer(config); }
