export enum OrkaErrorCode {
  // Adapter errors
  LLM_API_ERROR = 'LLM_API_ERROR',
  LLM_TIMEOUT = 'LLM_TIMEOUT',
  LLM_RATE_LIMIT = 'LLM_RATE_LIMIT',
  EMBEDDING_ERROR = 'EMBEDDING_ERROR',
  VECTORDB_ERROR = 'VECTORDB_ERROR',

  // Agent errors
  AGENT_MAX_STEPS = 'AGENT_MAX_STEPS',
  AGENT_TOOL_NOT_FOUND = 'AGENT_TOOL_NOT_FOUND',
  AGENT_TOOL_BLOCKED = 'AGENT_TOOL_BLOCKED',
  AGENT_PARSE_ERROR = 'AGENT_PARSE_ERROR',
  AGENT_ALREADY_EXISTS = 'AGENT_ALREADY_EXISTS',
  AGENT_NOT_FOUND = 'AGENT_NOT_FOUND',

  // Parser errors
  PARSE_ERROR = 'PARSE_ERROR',
  VALIDATION_ERROR = 'VALIDATION_ERROR',

  // Chain errors
  CHAIN_RETRIEVAL_ERROR = 'CHAIN_RETRIEVAL_ERROR',
  CHAIN_GENERATION_ERROR = 'CHAIN_GENERATION_ERROR',

  // Knowledge errors
  KNOWLEDGE_INGEST_ERROR = 'KNOWLEDGE_INGEST_ERROR',
  KNOWLEDGE_SEARCH_ERROR = 'KNOWLEDGE_SEARCH_ERROR',
  KNOWLEDGE_INVALID_SOURCE = 'KNOWLEDGE_INVALID_SOURCE',

  // Cache errors
  CACHE_ERROR = 'CACHE_ERROR',

  // Config errors
  INVALID_CONFIG = 'INVALID_CONFIG',
  MISSING_DEPENDENCY = 'MISSING_DEPENDENCY',

  // Security errors
  SQL_INJECTION_BLOCKED = 'SQL_INJECTION_BLOCKED',
  SSRF_BLOCKED = 'SSRF_BLOCKED',
  PII_DETECTED = 'PII_DETECTED',

  // Graph errors
  GRAPH_MAX_ITERATIONS = 'GRAPH_MAX_ITERATIONS',
  GRAPH_NODE_ERROR = 'GRAPH_NODE_ERROR',
  GRAPH_INVALID_CONFIG = 'GRAPH_INVALID_CONFIG',

  // General errors
  NOT_FOUND = 'NOT_FOUND',
  INVALID_INPUT = 'INVALID_INPUT',
  INVALID_STATE = 'INVALID_STATE',
  NETWORK_ERROR = 'NETWORK_ERROR',
  EXTERNAL_SERVICE_ERROR = 'EXTERNAL_SERVICE_ERROR',
}

export class OrkaError extends Error {
  public readonly code: OrkaErrorCode;
  public readonly module: string;
  public readonly cause?: Error;
  public readonly metadata?: Record<string, unknown>;

  constructor(
    message: string,
    code: OrkaErrorCode,
    module: string,
    cause?: Error,
    metadata?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'OrkaError';
    this.code = code;
    this.module = module;
    this.cause = cause;
    this.metadata = metadata;

    if (cause && Error.captureStackTrace) {
      Error.captureStackTrace(this, OrkaError);
    }
  }

  toJSON(): Record<string, unknown> {
    return {
      name: this.name,
      code: this.code,
      module: this.module,
      message: this.message,
      cause: this.cause?.message,
      metadata: this.metadata,
    };
  }

  static isOrkaError(error: unknown): error is OrkaError {
    return error instanceof OrkaError;
  }

  static isRetryable(error: unknown): boolean {
    if (!OrkaError.isOrkaError(error)) return false;
    return [
      OrkaErrorCode.LLM_TIMEOUT,
      OrkaErrorCode.LLM_RATE_LIMIT,
      OrkaErrorCode.LLM_API_ERROR,
      OrkaErrorCode.VECTORDB_ERROR,
      OrkaErrorCode.CACHE_ERROR,
      OrkaErrorCode.NETWORK_ERROR,
      OrkaErrorCode.EXTERNAL_SERVICE_ERROR,
    ].includes(error.code);
  }

  isRetryable(): boolean {
    return OrkaError.isRetryable(this);
  }
}
