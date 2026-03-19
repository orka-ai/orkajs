/**
 * MCP (Model Context Protocol) Types
 * 
 * This module defines the types for the MCP protocol implementation.
 * MCP standardizes how LLMs access tools, resources, and context.
 */

/**
 * MCP Tool definition - describes a callable tool
 */
export interface MCPTool {
  /** Unique tool name */
  name: string;
  /** Human-readable description */
  description: string;
  /** JSON Schema for input parameters */
  inputSchema: MCPSchema;
  /** Optional annotations for tool behavior */
  annotations?: MCPToolAnnotations;
}

/**
 * JSON Schema definition for MCP
 */
export interface MCPSchema {
  type: 'object' | 'string' | 'number' | 'boolean' | 'array';
  properties?: Record<string, MCPSchemaProperty>;
  required?: string[];
  items?: MCPSchemaProperty;
  description?: string;
}

/**
 * Schema property definition
 */
export interface MCPSchemaProperty {
  type: 'string' | 'number' | 'boolean' | 'array' | 'object';
  description?: string;
  enum?: (string | number)[];
  default?: unknown;
  items?: MCPSchemaProperty;
  properties?: Record<string, MCPSchemaProperty>;
  required?: string[];
}

/**
 * Tool annotations for behavior hints
 */
export interface MCPToolAnnotations {
  /** Tool is read-only (no side effects) */
  readOnly?: boolean;
  /** Tool is idempotent */
  idempotent?: boolean;
  /** Estimated execution time in ms */
  estimatedDurationMs?: number;
  /** Tool requires confirmation before execution */
  requiresConfirmation?: boolean;
  /** Custom annotations */
  [key: string]: unknown;
}

/**
 * MCP Resource - represents accessible data/context
 */
export interface MCPResource {
  /** Unique resource URI */
  uri: string;
  /** Human-readable name */
  name: string;
  /** Resource description */
  description?: string;
  /** MIME type of the resource */
  mimeType?: string;
  /** Resource annotations */
  annotations?: MCPResourceAnnotations;
}

/**
 * Resource annotations
 */
export interface MCPResourceAnnotations {
  /** Resource is read-only */
  readOnly?: boolean;
  /** Resource size in bytes */
  sizeBytes?: number;
  /** Last modified timestamp */
  lastModified?: string;
  /** Custom annotations */
  [key: string]: unknown;
}

/**
 * MCP Prompt template
 */
export interface MCPPrompt {
  /** Unique prompt name */
  name: string;
  /** Prompt description */
  description?: string;
  /** Prompt arguments */
  arguments?: MCPPromptArgument[];
}

/**
 * Prompt argument definition
 */
export interface MCPPromptArgument {
  /** Argument name */
  name: string;
  /** Argument description */
  description?: string;
  /** Whether the argument is required */
  required?: boolean;
}

/**
 * Tool call request
 */
export interface MCPToolCall {
  /** Tool name to call */
  name: string;
  /** Tool arguments */
  arguments: Record<string, unknown>;
}

/**
 * Tool call result
 */
export interface MCPToolResult {
  /** Whether the call was successful */
  success: boolean;
  /** Result content */
  content: MCPContent[];
  /** Error message if failed */
  error?: string;
  /** Execution metadata */
  metadata?: MCPResultMetadata;
}

/**
 * Content types for MCP responses
 */
export type MCPContent = MCPTextContent | MCPImageContent | MCPResourceContent;

/**
 * Text content
 */
export interface MCPTextContent {
  type: 'text';
  text: string;
}

/**
 * Image content
 */
export interface MCPImageContent {
  type: 'image';
  data: string;
  mimeType: string;
}

/**
 * Resource reference content
 */
export interface MCPResourceContent {
  type: 'resource';
  uri: string;
  mimeType?: string;
  text?: string;
  blob?: string;
}

/**
 * Result metadata
 */
export interface MCPResultMetadata {
  /** Execution duration in ms */
  durationMs?: number;
  /** Token usage if applicable */
  tokenUsage?: {
    input?: number;
    output?: number;
  };
  /** Custom metadata */
  [key: string]: unknown;
}

/**
 * MCP Server capabilities
 */
export interface MCPServerCapabilities {
  /** Supported tools */
  tools?: {
    listChanged?: boolean;
  };
  /** Supported resources */
  resources?: {
    subscribe?: boolean;
    listChanged?: boolean;
  };
  /** Supported prompts */
  prompts?: {
    listChanged?: boolean;
  };
  /** Logging support */
  logging?: Record<string, never>;
  /** Experimental features */
  experimental?: Record<string, unknown>;
}

/**
 * MCP Client capabilities
 */
export interface MCPClientCapabilities {
  /** Root capabilities */
  roots?: {
    listChanged?: boolean;
  };
  /** Sampling support */
  sampling?: Record<string, never>;
  /** Experimental features */
  experimental?: Record<string, unknown>;
}

/**
 * MCP Server info
 */
export interface MCPServerInfo {
  /** Server name */
  name: string;
  /** Server version */
  version: string;
  /** Protocol version */
  protocolVersion: string;
  /** Server capabilities */
  capabilities: MCPServerCapabilities;
}

/**
 * MCP Client info
 */
export interface MCPClientInfo {
  /** Client name */
  name: string;
  /** Client version */
  version: string;
  /** Protocol version */
  protocolVersion: string;
  /** Client capabilities */
  capabilities: MCPClientCapabilities;
}

/**
 * JSON-RPC request
 */
export interface MCPRequest {
  jsonrpc: '2.0';
  id: string | number;
  method: string;
  params?: Record<string, unknown>;
}

/**
 * JSON-RPC response
 */
export interface MCPResponse {
  jsonrpc: '2.0';
  id: string | number;
  result?: unknown;
  error?: MCPError;
}

/**
 * JSON-RPC notification (no response expected)
 */
export interface MCPNotification {
  jsonrpc: '2.0';
  method: string;
  params?: Record<string, unknown>;
}

/**
 * MCP Error
 */
export interface MCPError {
  code: number;
  message: string;
  data?: unknown;
}

/**
 * Standard MCP error codes
 */
export const MCPErrorCodes = {
  PARSE_ERROR: -32700,
  INVALID_REQUEST: -32600,
  METHOD_NOT_FOUND: -32601,
  INVALID_PARAMS: -32602,
  INTERNAL_ERROR: -32603,
  // MCP-specific errors
  TOOL_NOT_FOUND: -32001,
  RESOURCE_NOT_FOUND: -32002,
  PERMISSION_DENIED: -32003,
  RATE_LIMITED: -32004,
  TIMEOUT: -32005,
} as const;

/**
 * MCP Transport interface
 */
export interface MCPTransport {
  /** Send a message */
  send(message: MCPRequest | MCPResponse | MCPNotification): Promise<void>;
  /** Receive messages */
  onMessage(handler: (message: MCPRequest | MCPResponse | MCPNotification) => void): void;
  /** Close the transport */
  close(): Promise<void>;
  /** Check if connected */
  isConnected(): boolean;
}

/**
 * MCP Client configuration
 */
export interface MCPClientConfig {
  /** Server endpoint URL */
  endpoint: string;
  /** API key for authentication */
  apiKey?: string;
  /** Request timeout in ms */
  timeoutMs?: number;
  /** Retry configuration */
  retry?: {
    maxRetries?: number;
    initialDelayMs?: number;
    maxDelayMs?: number;
  };
  /** Custom headers */
  headers?: Record<string, string>;
  /** Enable verbose logging */
  verbose?: boolean;
}

/**
 * MCP Server configuration
 */
export interface MCPServerConfig {
  /** Server name */
  name: string;
  /** Server version */
  version?: string;
  /** Port to listen on */
  port?: number;
  /** Host to bind to */
  host?: string;
  /** Enable CORS */
  cors?: boolean;
  /** API key for authentication */
  apiKey?: string;
  /** Enable verbose logging */
  verbose?: boolean;
}

/**
 * MCP Gateway configuration
 */
export interface MCPGatewayConfig {
  /** Gateway name */
  name: string;
  /** Port to listen on */
  port?: number;
  /** Host to bind to */
  host?: string;
  /** Upstream MCP servers */
  upstreams?: MCPUpstreamConfig[];
  /** Enable CORS */
  cors?: boolean;
  /** API key for authentication */
  apiKey?: string;
  /** Enable verbose logging */
  verbose?: boolean;
  /** Load balancing strategy */
  loadBalancing?: 'round-robin' | 'random' | 'least-connections';
}

/**
 * Upstream server configuration
 */
export interface MCPUpstreamConfig {
  /** Upstream name */
  name: string;
  /** Upstream endpoint */
  endpoint: string;
  /** API key for upstream */
  apiKey?: string;
  /** Weight for load balancing */
  weight?: number;
  /** Health check interval in ms */
  healthCheckIntervalMs?: number;
}

/**
 * Tool handler function type
 */
export type MCPToolHandler = (
  args: Record<string, unknown>,
  context?: MCPToolContext
) => Promise<MCPToolResult> | MCPToolResult;

/**
 * Tool execution context
 */
export interface MCPToolContext {
  /** Request ID */
  requestId: string;
  /** Client info */
  client?: MCPClientInfo;
  /** Abort signal for cancellation */
  signal?: AbortSignal;
  /** Custom context data */
  [key: string]: unknown;
}

/**
 * Resource handler function type
 */
export type MCPResourceHandler = (
  uri: string,
  context?: MCPResourceContext
) => Promise<MCPContent[]> | MCPContent[];

/**
 * Resource context
 */
export interface MCPResourceContext {
  /** Request ID */
  requestId: string;
  /** Client info */
  client?: MCPClientInfo;
  /** Abort signal for cancellation */
  signal?: AbortSignal;
}

/**
 * Prompt handler function type
 */
export type MCPPromptHandler = (
  args: Record<string, string>,
  context?: MCPPromptContext
) => Promise<MCPPromptMessage[]> | MCPPromptMessage[];

/**
 * Prompt context
 */
export interface MCPPromptContext {
  /** Request ID */
  requestId: string;
  /** Client info */
  client?: MCPClientInfo;
}

/**
 * Prompt message
 */
export interface MCPPromptMessage {
  role: 'user' | 'assistant' | 'system';
  content: MCPContent;
}

/**
 * Connection state
 */
export type MCPConnectionState = 'disconnected' | 'connecting' | 'connected' | 'error';

/**
 * Connection event
 */
export interface MCPConnectionEvent {
  type: 'connected' | 'disconnected' | 'error' | 'reconnecting';
  timestamp: Date;
  error?: Error;
}

/**
 * MCP event types
 */
export type MCPEventType = 
  | 'tool:call'
  | 'tool:result'
  | 'tool:error'
  | 'resource:read'
  | 'resource:subscribe'
  | 'prompt:get'
  | 'connection:open'
  | 'connection:close'
  | 'connection:error';

/**
 * MCP event
 */
export interface MCPEvent {
  type: MCPEventType;
  timestamp: Date;
  data?: unknown;
}

/**
 * MCP event listener
 */
export type MCPEventListener = (event: MCPEvent) => void;
