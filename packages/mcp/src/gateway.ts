/**
 * MCP Gateway
 * 
 * Routes requests to multiple upstream MCP servers with load balancing.
 * 
 * @example
 * ```typescript
 * import { MCPGateway } from '@orka-js/mcp';
 * 
 * const gateway = new MCPGateway({
 *   name: 'my-gateway',
 *   port: 4000,
 *   upstreams: [
 *     { name: 'crm', endpoint: 'http://localhost:3001/mcp' },
 *     { name: 'erp', endpoint: 'http://localhost:3002/mcp' },
 *   ],
 * });
 * 
 * await gateway.start();
 * ```
 */

import { createServer, type Server, type IncomingMessage, type ServerResponse } from 'http';
import { generateId, OrkaError, OrkaErrorCode } from '@orka-js/core';
import type {
  MCPGatewayConfig,
  MCPUpstreamConfig,
  MCPServerInfo,
  MCPTool,
  MCPResource,
  MCPPrompt,
  MCPRequest,
  MCPResponse,
  MCPToolResult,
  MCPContent,
  MCPEvent,
  MCPEventListener,
  MCPEventType,
} from './types.js';

interface UpstreamState {
  config: MCPUpstreamConfig;
  healthy: boolean;
  lastCheck: Date;
  tools: MCPTool[];
  resources: MCPResource[];
  prompts: MCPPrompt[];
  connections: number;
}

export class MCPGateway {
  private config: MCPGatewayConfig;
  private httpServer: Server | null = null;
  private upstreams: Map<string, UpstreamState> = new Map();
  private toolToUpstream: Map<string, string> = new Map();
  private resourceToUpstream: Map<string, string> = new Map();
  private promptToUpstream: Map<string, string> = new Map();
  private eventListeners: Map<MCPEventType, Set<MCPEventListener>> = new Map();
  private isRunning = false;
  private healthCheckInterval: ReturnType<typeof setInterval> | null = null;
  private healthCheckRunning = false;
  /** Default timeout for proxied requests to an upstream (ms). */
  private readonly UPSTREAM_TIMEOUT_MS = 30000;
  /** Shorter timeout for health-check pings so one wedged upstream can't stall others (ms). */
  private readonly HEALTH_CHECK_TIMEOUT_MS = 5000;
  /** Maximum accepted request body size (bytes); larger bodies are rejected to prevent memory-exhaustion DoS. */
  private readonly MAX_REQUEST_BODY_BYTES = 4 * 1024 * 1024;
  /** Idle timeout for reading a request body (ms); a connection that stalls or never ends is dropped. */
  private readonly BODY_READ_TIMEOUT_MS = 30000;

  constructor(config: MCPGatewayConfig) {
    this.config = { port: 4000, host: 'localhost', cors: true, loadBalancing: 'round-robin', ...config };
  }

  getGatewayInfo(): MCPServerInfo {
    return {
      name: this.config.name,
      version: '1.0.0',
      protocolVersion: '2024-11-05',
      capabilities: {
        tools: { listChanged: true },
        resources: { subscribe: true, listChanged: true },
        prompts: { listChanged: true },
        logging: {},
      },
    };
  }

  /**
   * Translate the gateway's MCPServerInfo into the MCP 2024-11-05
   * InitializeResult wire shape, which nests name/version under `serverInfo`.
   */
  private toWireGatewayInfo(): { protocolVersion: string; capabilities: MCPServerInfo['capabilities']; serverInfo: { name: string; version: string } } {
    const info = this.getGatewayInfo();
    return {
      protocolVersion: info.protocolVersion,
      capabilities: info.capabilities,
      serverInfo: { name: info.name, version: info.version },
    };
  }

  async start(): Promise<void> {
    if (this.isRunning) return;

    // Initialize upstreams
    for (const upstream of this.config.upstreams || []) {
      await this.addUpstream(upstream);
    }

    return new Promise((resolve, reject) => {
      this.httpServer = createServer((req, res) => this.handleRequest(req, res).catch(() => this.sendError(res, -32603, 'Internal error')));
      this.httpServer.on('error', reject);
      this.httpServer.listen(this.config.port, this.config.host, () => {
        this.isRunning = true;
        this.startHealthChecks();
        console.log(`[MCP Gateway] ${this.config.name} running at http://${this.config.host}:${this.config.port}`);
        console.log(`[MCP Gateway] Connected to ${this.upstreams.size} upstream(s)`);
        resolve();
      });
    });
  }

  async stop(): Promise<void> {
    if (!this.isRunning) return;
    if (this.healthCheckInterval) clearInterval(this.healthCheckInterval);
    return new Promise((resolve, reject) => {
      this.httpServer?.close(err => { if (err) reject(err); else { this.isRunning = false; resolve(); } });
    });
  }

  async addUpstream(config: MCPUpstreamConfig): Promise<void> {
    const state: UpstreamState = {
      config,
      healthy: false,
      lastCheck: new Date(),
      tools: [],
      resources: [],
      prompts: [],
      connections: 0,
    };

    // Register the state before loading so it is tracked (and health-checked)
    // even if the upstream is currently down.
    this.upstreams.set(config.name, state);

    try {
      await this.loadUpstreamCapabilities(state);
      state.healthy = true;
      console.log(`[MCP Gateway] Added upstream: ${config.name} (${state.tools.length} tools, ${state.resources.length} resources, ${state.prompts.length} prompts)`);
    } catch (error) {
      state.healthy = false;
      console.error(`[MCP Gateway] Failed to connect to upstream ${config.name}:`, (error as Error).message);
    }
  }

  /**
   * (Re-)run the initialize handshake, fetch tools/resources/prompts, and
   * rebuild this upstream's name mappings. Used both on initial connect and
   * when a previously unhealthy upstream comes back online, so a recovered
   * upstream that was never initialized still exposes its tools.
   */
  private async loadUpstreamCapabilities(state: UpstreamState): Promise<void> {
    const config = state.config;
    await this.initializeUpstream(config);

    const [tools, resources, prompts] = await Promise.all([
      this.fetchUpstreamTools(config),
      this.fetchUpstreamResources(config),
      this.fetchUpstreamPrompts(config),
    ]);

    // Drop any stale mappings from a previous load before rebuilding them.
    state.tools.forEach(t => this.toolToUpstream.delete(t.name));
    state.resources.forEach(r => this.resourceToUpstream.delete(r.uri));
    state.prompts.forEach(p => this.promptToUpstream.delete(p.name));

    state.tools = tools;
    state.resources = resources;
    state.prompts = prompts;

    tools.forEach(t => this.toolToUpstream.set(t.name, config.name));
    resources.forEach(r => this.resourceToUpstream.set(r.uri, config.name));
    prompts.forEach(p => this.promptToUpstream.set(p.name, config.name));
  }

  async removeUpstream(name: string): Promise<void> {
    const state = this.upstreams.get(name);
    if (!state) return;

    // Remove mappings
    state.tools.forEach(t => this.toolToUpstream.delete(t.name));
    state.resources.forEach(r => this.resourceToUpstream.delete(r.uri));
    state.prompts.forEach(p => this.promptToUpstream.delete(p.name));

    this.upstreams.delete(name);
    console.log(`[MCP Gateway] Removed upstream: ${name}`);
  }

  private async initializeUpstream(config: MCPUpstreamConfig): Promise<MCPServerInfo> {
    const response = await this.sendToUpstream(config, 'initialize', {
      protocolVersion: '2024-11-05',
      capabilities: {},
      clientInfo: { name: 'orka-mcp-gateway', version: '1.0.0' },
    });
    await this.sendToUpstream(config, 'notifications/initialized', {});
    return response as MCPServerInfo;
  }

  private async fetchUpstreamTools(config: MCPUpstreamConfig): Promise<MCPTool[]> {
    try {
      const response = await this.sendToUpstream(config, 'tools/list', {});
      return (response as { tools: MCPTool[] }).tools || [];
    } catch { return []; }
  }

  private async fetchUpstreamResources(config: MCPUpstreamConfig): Promise<MCPResource[]> {
    try {
      const response = await this.sendToUpstream(config, 'resources/list', {});
      return (response as { resources: MCPResource[] }).resources || [];
    } catch { return []; }
  }

  private async fetchUpstreamPrompts(config: MCPUpstreamConfig): Promise<MCPPrompt[]> {
    try {
      const response = await this.sendToUpstream(config, 'prompts/list', {});
      return (response as { prompts: MCPPrompt[] }).prompts || [];
    } catch { return []; }
  }

  private async sendToUpstream(config: MCPUpstreamConfig, method: string, params: Record<string, unknown>, timeoutMs: number = this.UPSTREAM_TIMEOUT_MS): Promise<unknown> {
    const request: MCPRequest = { jsonrpc: '2.0', id: generateId(), method, params };
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (config.apiKey) headers['Authorization'] = `Bearer ${config.apiKey}`;

    // Abort a wedged upstream that accepts the connection but never responds,
    // so proxied calls (and health-check pings) can't hang indefinitely.
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(config.endpoint, { method: 'POST', headers, body: JSON.stringify(request), signal: controller.signal });
      if (!response.ok) throw new OrkaError(`Upstream error: ${response.status}`, OrkaErrorCode.NETWORK_ERROR, 'mcp');

      const data = await response.json() as MCPResponse;
      if (data.error) throw new OrkaError(data.error.message, OrkaErrorCode.EXTERNAL_SERVICE_ERROR, 'mcp');
      return data.result;
    } finally {
      clearTimeout(timeout);
    }
  }

  private startHealthChecks(): void {
    this.healthCheckInterval = setInterval(() => {
      // Guard against overlapping runs: a wedged upstream must not cause a new
      // health-check pass (and a new set of fetches) to pile up every 30s.
      if (this.healthCheckRunning) return;
      this.healthCheckRunning = true;
      void this.runHealthChecks().finally(() => {
        this.healthCheckRunning = false;
      });
    }, 30000);
  }

  private async runHealthChecks(): Promise<void> {
    for (const [, state] of this.upstreams) {
      try {
        await this.sendToUpstream(state.config, 'ping', {}, this.HEALTH_CHECK_TIMEOUT_MS);
        // An upstream that was down (and therefore never initialized, with no
        // tools or mappings) has just come back: re-run the handshake and
        // re-fetch its capabilities before advertising it as healthy.
        if (!state.healthy) {
          await this.loadUpstreamCapabilities(state);
        }
        state.healthy = true;
      } catch {
        state.healthy = false;
      }
      state.lastCheck = new Date();
    }
  }

  private async handleRequest(req: IncomingMessage, res: ServerResponse): Promise<void> {
    if (this.config.cors) {
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
      if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }
    }
    if (req.method !== 'POST') { res.writeHead(405); res.end('Method Not Allowed'); return; }
    if (this.config.apiKey && req.headers.authorization !== `Bearer ${this.config.apiKey}`) {
      res.writeHead(401); res.end('Unauthorized'); return;
    }

    const body = await this.parseBody(req);
    if (!body) { this.sendError(res, -32700, 'Parse error'); return; }

    const request = body as MCPRequest;
    const result = await this.handleMethod(request);

    res.setHeader('Content-Type', 'application/json');
    res.writeHead(200);
    res.end(JSON.stringify({ jsonrpc: '2.0', id: request.id, ...result }));
  }

  private async handleMethod(request: MCPRequest): Promise<{ result?: unknown; error?: { code: number; message: string } }> {
    const { method, params } = request;
    try {
      switch (method) {
        case 'initialize': return { result: this.toWireGatewayInfo() };
        case 'notifications/initialized': return { result: {} };
        case 'tools/list': return { result: { tools: this.getAllTools() } };
        case 'tools/call': return { result: await this.routeToolCall(params as { name: string; arguments: Record<string, unknown> }) };
        case 'resources/list': return { result: { resources: this.getAllResources() } };
        case 'resources/read': return { result: await this.routeResourceRead(params as { uri: string }) };
        case 'prompts/list': return { result: { prompts: this.getAllPrompts() } };
        case 'prompts/get': return { result: await this.routePromptGet(params as { name: string; arguments?: Record<string, string> }) };
        case 'ping': return { result: {} };
        default: return { error: { code: -32601, message: `Method not found: ${method}` } };
      }
    } catch (error) { return { error: { code: -32603, message: (error as Error).message } }; }
  }

  private getAllTools(): MCPTool[] {
    const tools: MCPTool[] = [];
    for (const state of this.upstreams.values()) {
      if (state.healthy) tools.push(...state.tools);
    }
    return tools;
  }

  private getAllResources(): MCPResource[] {
    const resources: MCPResource[] = [];
    for (const state of this.upstreams.values()) {
      if (state.healthy) resources.push(...state.resources);
    }
    return resources;
  }

  private getAllPrompts(): MCPPrompt[] {
    const prompts: MCPPrompt[] = [];
    for (const state of this.upstreams.values()) {
      if (state.healthy) prompts.push(...state.prompts);
    }
    return prompts;
  }

  private async routeToolCall(params: { name: string; arguments: Record<string, unknown> }): Promise<MCPToolResult> {
    const upstreamName = this.toolToUpstream.get(params.name);
    if (!upstreamName) return { success: false, content: [{ type: 'text', text: `Tool not found: ${params.name}` }], error: `Tool not found` };

    const state = this.upstreams.get(upstreamName);
    if (!state?.healthy) return { success: false, content: [{ type: 'text', text: `Upstream unavailable: ${upstreamName}` }], error: `Upstream unavailable` };

    this.emit('tool:call', { tool: params.name, upstream: upstreamName });
    const result = await this.sendToUpstream(state.config, 'tools/call', params);
    this.emit('tool:result', { tool: params.name, upstream: upstreamName, result });
    return result as MCPToolResult;
  }

  private async routeResourceRead(params: { uri: string }): Promise<{ contents: MCPContent[] }> {
    const upstreamName = this.resourceToUpstream.get(params.uri);
    if (!upstreamName) throw new OrkaError(`Resource not found: ${params.uri}`, OrkaErrorCode.NOT_FOUND, 'mcp');

    const state = this.upstreams.get(upstreamName);
    if (!state?.healthy) throw new OrkaError(`Upstream unavailable: ${upstreamName}`, OrkaErrorCode.NETWORK_ERROR, 'mcp');

    this.emit('resource:read', { uri: params.uri, upstream: upstreamName });
    return await this.sendToUpstream(state.config, 'resources/read', params) as { contents: MCPContent[] };
  }

  private async routePromptGet(params: { name: string; arguments?: Record<string, string> }): Promise<{ messages: unknown[] }> {
    const upstreamName = this.promptToUpstream.get(params.name);
    if (!upstreamName) throw new OrkaError(`Prompt not found: ${params.name}`, OrkaErrorCode.NOT_FOUND, 'mcp');

    const state = this.upstreams.get(upstreamName);
    if (!state?.healthy) throw new OrkaError(`Upstream unavailable: ${upstreamName}`, OrkaErrorCode.NETWORK_ERROR, 'mcp');

    this.emit('prompt:get', { name: params.name, upstream: upstreamName });
    return await this.sendToUpstream(state.config, 'prompts/get', params) as { messages: unknown[] };
  }

  private parseBody(req: IncomingMessage): Promise<unknown> {
    return new Promise(resolve => {
      let body = '';
      let size = 0;
      let settled = false;
      const finish = (value: unknown) => { if (settled) return; settled = true; resolve(value); };
      req.setTimeout(this.BODY_READ_TIMEOUT_MS, () => { finish(null); req.destroy(); });
      req.on('data', chunk => {
        size += chunk.length;
        if (size > this.MAX_REQUEST_BODY_BYTES) { finish(null); req.destroy(); return; }
        body += chunk.toString();
      });
      req.on('end', () => { try { finish(JSON.parse(body)); } catch { finish(null); } });
      req.on('error', () => finish(null));
    });
  }

  private sendError(res: ServerResponse, code: number, message: string): void {
    if (res.destroyed) return;
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

  getUpstreamStatus(): { name: string; healthy: boolean; tools: number; resources: number; prompts: number }[] {
    return Array.from(this.upstreams.entries()).map(([name, state]) => ({
      name,
      healthy: state.healthy,
      tools: state.tools.length,
      resources: state.resources.length,
      prompts: state.prompts.length,
    }));
  }
}

export function createMCPGateway(config: MCPGatewayConfig): MCPGateway { return new MCPGateway(config); }
