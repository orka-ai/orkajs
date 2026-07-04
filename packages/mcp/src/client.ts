/**
 * MCP Client
 * 
 * Connects to MCP servers and provides access to tools, resources, and prompts.
 * 
 * @example
 * ```typescript
 * import { MCPClient } from '@orka-js/mcp';
 * 
 * const client = new MCPClient({
 *   endpoint: 'http://localhost:3000/mcp',
 *   apiKey: process.env.MCP_API_KEY,
 * });
 * 
 * await client.connect();
 * 
 * // List available tools
 * const tools = await client.listTools();
 * 
 * // Call a tool
 * const result = await client.callTool('get_customer', { id: '123' });
 * ```
 */

import { generateId, OrkaError, OrkaErrorCode } from '@orka-js/core';
import type {
  MCPClientConfig,
  MCPClientInfo,
  MCPServerInfo,
  MCPTool,
  MCPResource,
  MCPPrompt,
  MCPToolCall,
  MCPToolResult,
  MCPContent,
  MCPRequest,
  MCPResponse,
  MCPConnectionState,
  MCPEvent,
  MCPEventListener,
  MCPEventType,
  MCPPromptMessage,
} from './types.js';

/**
 * MCP Client for connecting to MCP servers
 */
export class MCPClient {
  /**
   * JSON-RPC methods that are safe to retry automatically. Only read-only /
   * idempotent methods are listed; mutating calls (tools/call,
   * resources/subscribe, resources/unsubscribe) are never blind-retried to
   * avoid duplicating side effects when a response is lost after execution.
   */
  private static readonly IDEMPOTENT_METHODS: ReadonlySet<string> = new Set([
    'initialize',
    'tools/list',
    'resources/list',
    'resources/read',
    'prompts/list',
    'prompts/get',
    'ping',
  ]);

  private config: MCPClientConfig;
  private serverInfo: MCPServerInfo | null = null;
  private connectionState: MCPConnectionState = 'disconnected';
  private pendingRequests: Map<string | number, {
    resolve: (value: unknown) => void;
    reject: (error: Error) => void;
    timeout: ReturnType<typeof setTimeout>;
  }> = new Map();
  private eventListeners: Map<MCPEventType, Set<MCPEventListener>> = new Map();
  private toolsCache: MCPTool[] | null = null;
  private resourcesCache: MCPResource[] | null = null;
  private promptsCache: MCPPrompt[] | null = null;

  constructor(config: MCPClientConfig) {
    this.config = {
      timeoutMs: 30000,
      retry: {
        maxRetries: 3,
        initialDelayMs: 1000,
        maxDelayMs: 10000,
      },
      ...config,
    };
  }

  /**
   * Get client info
   */
  getClientInfo(): MCPClientInfo {
    return {
      name: 'orka-mcp-client',
      version: '1.0.0',
      protocolVersion: '2024-11-05',
      capabilities: {
        roots: { listChanged: true },
        sampling: {},
      },
    };
  }

  /**
   * Get current connection state
   */
  getConnectionState(): MCPConnectionState {
    return this.connectionState;
  }

  /**
   * Get server info (after connection)
   */
  getServerInfo(): MCPServerInfo | null {
    return this.serverInfo;
  }

  /**
   * Connect to the MCP server
   */
  async connect(): Promise<MCPServerInfo> {
    if (this.connectionState === 'connected' && this.serverInfo) {
      return this.serverInfo;
    }

    this.connectionState = 'connecting';
    this.emit('connection:open', { endpoint: this.config.endpoint });

    try {
      const response = await this.sendRequest('initialize', {
        protocolVersion: '2024-11-05',
        capabilities: this.getClientInfo().capabilities,
        clientInfo: {
          name: this.getClientInfo().name,
          version: this.getClientInfo().version,
        },
      });

      // The MCP 2024-11-05 InitializeResult nests name/version under a
      // `serverInfo` envelope; translate it into our internal MCPServerInfo.
      const initResult = response as {
        protocolVersion?: string;
        capabilities?: MCPServerInfo['capabilities'];
        serverInfo?: { name?: string; version?: string };
      };
      this.serverInfo = {
        name: initResult.serverInfo?.name ?? 'unknown',
        version: initResult.serverInfo?.version ?? 'unknown',
        protocolVersion: initResult.protocolVersion ?? '2024-11-05',
        capabilities: initResult.capabilities ?? {},
      };
      this.connectionState = 'connected';

      // Send initialized notification
      await this.sendNotification('notifications/initialized', {});

      if (this.config.verbose) {
        console.log(`[MCP Client] Connected to ${this.serverInfo.name} v${this.serverInfo.version}`);
      }

      return this.serverInfo;
    } catch (error) {
      this.connectionState = 'error';
      this.emit('connection:error', { error });
      throw error;
    }
  }

  /**
   * Disconnect from the MCP server
   */
  async disconnect(): Promise<void> {
    if (this.connectionState === 'disconnected') {
      return;
    }

    // Cancel all pending requests
    for (const [id, pending] of this.pendingRequests) {
      clearTimeout(pending.timeout);
      pending.reject(new OrkaError('Connection closed', OrkaErrorCode.NETWORK_ERROR, 'mcp'));
      this.pendingRequests.delete(id);
    }

    this.connectionState = 'disconnected';
    this.serverInfo = null;
    this.toolsCache = null;
    this.resourcesCache = null;
    this.promptsCache = null;

    this.emit('connection:close', {});

    if (this.config.verbose) {
      console.log('[MCP Client] Disconnected');
    }
  }

  /**
   * List available tools from the server
   */
  async listTools(forceRefresh = false): Promise<MCPTool[]> {
    this.ensureConnected();

    if (this.toolsCache && !forceRefresh) {
      return this.toolsCache;
    }

    const response = await this.sendRequest('tools/list', {});
    this.toolsCache = (response as { tools: MCPTool[] }).tools;
    return this.toolsCache;
  }

  /**
   * Call a tool on the server
   */
  async callTool(name: string, args: Record<string, unknown> = {}): Promise<MCPToolResult> {
    this.ensureConnected();

    const toolCall: MCPToolCall = { name, arguments: args };
    
    this.emit('tool:call', { tool: name, args });

    try {
      const response = await this.sendRequest('tools/call', { name: toolCall.name, arguments: toolCall.arguments });

      // The MCP spec's CallToolResult is { content, isError }; translate it to
      // our internal MCPToolResult so callers can rely on `success`/`error`.
      const raw = response as {
        content?: MCPContent[];
        isError?: boolean;
        error?: string;
        metadata?: MCPToolResult['metadata'];
      };
      const content = raw.content ?? [];
      const isError = raw.isError === true;
      const result: MCPToolResult = {
        success: !isError,
        content,
        error:
          raw.error ??
          (isError
            ? content.flatMap(c => (c.type === 'text' ? [c.text] : [])).join('\n') || undefined
            : undefined),
        metadata: raw.metadata,
      };

      this.emit('tool:result', { tool: name, result });
      
      return result;
    } catch (error) {
      this.emit('tool:error', { tool: name, error });
      throw error;
    }
  }

  /**
   * List available resources from the server
   */
  async listResources(forceRefresh = false): Promise<MCPResource[]> {
    this.ensureConnected();

    if (this.resourcesCache && !forceRefresh) {
      return this.resourcesCache;
    }

    const response = await this.sendRequest('resources/list', {});
    this.resourcesCache = (response as { resources: MCPResource[] }).resources;
    return this.resourcesCache;
  }

  /**
   * Read a resource from the server
   */
  async readResource(uri: string): Promise<MCPContent[]> {
    this.ensureConnected();

    this.emit('resource:read', { uri });

    const response = await this.sendRequest('resources/read', { uri });
    return (response as { contents: MCPContent[] }).contents;
  }

  /**
   * Subscribe to resource updates
   */
  async subscribeResource(uri: string): Promise<void> {
    this.ensureConnected();

    this.emit('resource:subscribe', { uri });

    await this.sendRequest('resources/subscribe', { uri });
  }

  /**
   * Unsubscribe from resource updates
   */
  async unsubscribeResource(uri: string): Promise<void> {
    this.ensureConnected();

    await this.sendRequest('resources/unsubscribe', { uri });
  }

  /**
   * List available prompts from the server
   */
  async listPrompts(forceRefresh = false): Promise<MCPPrompt[]> {
    this.ensureConnected();

    if (this.promptsCache && !forceRefresh) {
      return this.promptsCache;
    }

    const response = await this.sendRequest('prompts/list', {});
    this.promptsCache = (response as { prompts: MCPPrompt[] }).prompts;
    return this.promptsCache;
  }

  /**
   * Get a prompt from the server
   */
  async getPrompt(name: string, args: Record<string, string> = {}): Promise<MCPPromptMessage[]> {
    this.ensureConnected();

    this.emit('prompt:get', { name, args });

    const response = await this.sendRequest('prompts/get', { name, arguments: args });
    return (response as { messages: MCPPromptMessage[] }).messages;
  }

  /**
   * Add an event listener
   */
  on(event: MCPEventType, listener: MCPEventListener): void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, new Set());
    }
    this.eventListeners.get(event)!.add(listener);
  }

  /**
   * Remove an event listener
   */
  off(event: MCPEventType, listener: MCPEventListener): void {
    this.eventListeners.get(event)?.delete(listener);
  }

  /**
   * Emit an event
   */
  private emit(type: MCPEventType, data: unknown): void {
    const event: MCPEvent = {
      type,
      timestamp: new Date(),
      data,
    };

    this.eventListeners.get(type)?.forEach(listener => {
      try {
        listener(event);
      } catch (error) {
        console.error(`[MCP Client] Event listener error:`, error);
      }
    });
  }

  /**
   * Ensure the client is connected
   */
  private ensureConnected(): void {
    if (this.connectionState !== 'connected') {
      throw new OrkaError(
        'MCP client is not connected. Call connect() first.',
        OrkaErrorCode.INVALID_STATE,
        'mcp'
      );
    }
  }

  /**
   * Send a JSON-RPC request
   */
  private async sendRequest(method: string, params: Record<string, unknown>): Promise<unknown> {
    const id = generateId();
    const request: MCPRequest = {
      jsonrpc: '2.0',
      id,
      method,
      params,
    };

    const idempotent = MCPClient.IDEMPOTENT_METHODS.has(method);

    return this.executeWithRetry(async () => {
      const response = await this.httpRequest(request);

      if (response.error) {
        throw new OrkaError(
          response.error.message,
          OrkaErrorCode.EXTERNAL_SERVICE_ERROR,
          'mcp',
          undefined,
          { code: response.error.code, data: response.error.data }
        );
      }

      return response.result;
    }, idempotent);
  }

  /**
   * Send a JSON-RPC notification (no response expected)
   */
  private async sendNotification(method: string, params: Record<string, unknown>): Promise<void> {
    const notification = {
      jsonrpc: '2.0' as const,
      method,
      params,
    };

    await this.httpRequest(notification, false);
  }

  /**
   * Execute HTTP request to MCP server
   */
  private async httpRequest(
    body: MCPRequest | { jsonrpc: '2.0'; method: string; params: Record<string, unknown> },
    expectResponse = true
  ): Promise<MCPResponse> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.config.timeoutMs);

    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        ...this.config.headers,
      };

      if (this.config.apiKey) {
        headers['Authorization'] = `Bearer ${this.config.apiKey}`;
      }

      const response = await fetch(this.config.endpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new OrkaError(
          `HTTP error: ${response.status} ${response.statusText}`,
          OrkaErrorCode.NETWORK_ERROR,
          'mcp'
        );
      }

      if (!expectResponse) {
        return { jsonrpc: '2.0', id: 0, result: null };
      }

      const data = await response.json();
      return data as MCPResponse;
    } finally {
      clearTimeout(timeout);
    }
  }

  /**
   * Execute with retry logic
   */
  private async executeWithRetry<T>(fn: () => Promise<T>, idempotent: boolean): Promise<T> {
    const { maxRetries = 3, initialDelayMs = 1000, maxDelayMs = 10000 } = this.config.retry || {};

    let lastError: Error | null = null;
    let delay = initialDelayMs;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error as Error;

        // Never retry non-idempotent methods (e.g. tools/call): re-sending
        // could duplicate side effects if the server already executed the
        // call before the response was lost. Only retry transport-level
        // failures on idempotent methods; JSON-RPC application errors are
        // deterministic and are not retried.
        if (!idempotent || !this.isRetryableTransportError(error)) {
          throw error;
        }

        if (attempt < maxRetries) {
          if (this.config.verbose) {
            console.log(`[MCP Client] Retry ${attempt + 1}/${maxRetries} after ${delay}ms`);
          }
          await this.sleep(delay);
          delay = Math.min(delay * 2, maxDelayMs);
        }
      }
    }

    throw lastError;
  }

  /**
   * Whether an error is a retryable transport-level failure. Request timeouts
   * abort fetch with an AbortError, and HTTP failures surface as NETWORK_ERROR;
   * both are transient. JSON-RPC application errors (EXTERNAL_SERVICE_ERROR) are
   * deterministic server responses and are never retried.
   */
  private isRetryableTransportError(error: unknown): boolean {
    if (error instanceof Error && error.name === 'AbortError') {
      return true;
    }
    return error instanceof OrkaError && error.code === OrkaErrorCode.NETWORK_ERROR;
  }

  /**
   * Sleep helper
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

/**
 * Create an MCP client
 */
export function createMCPClient(config: MCPClientConfig): MCPClient {
  return new MCPClient(config);
}
