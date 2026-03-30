/**
 * CallbackManager - Centralized callback management for OrkaJS
 * Handles events from LLM streaming, tool execution, and agent actions
 */

import type { LLMStreamEvent } from './streaming.js';
import type { LLMGenerateOptions } from './types.js';

/**
 * Callback event types
 */
export type CallbackEventType =
  // Token/Streaming events
  | 'token_start'
  | 'token'
  | 'token_end'
  // Tool events
  | 'tool_start'
  | 'tool_end'
  | 'tool_error'
  // Agent events
  | 'agent_action'
  | 'agent_observation'
  | 'agent_finish'
  | 'agent_error'
  // Chain events
  | 'chain_start'
  | 'chain_end'
  | 'chain_error'
  // LLM events
  | 'llm_start'
  | 'llm_end'
  | 'llm_error'
  // Retrieval events
  | 'retrieval_start'
  | 'retrieval_end';

/**
 * Base callback event
 */
export interface CallbackEvent {
  type: CallbackEventType;
  timestamp: number;
  runId: string;
  parentRunId?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Token start event - streaming is beginning
 */
export interface TokenStartEvent extends CallbackEvent {
  type: 'token_start';
  prompt: string;
  model?: string;
}

/**
 * Token event - individual token received
 */
export interface TokenCallbackEvent extends CallbackEvent {
  type: 'token';
  token: string;
  index: number;
  content: string;
}

/**
 * Token end event - streaming completed
 */
export interface TokenEndEvent extends CallbackEvent {
  type: 'token_end';
  content: string;
  tokenCount: number;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  durationMs: number;
}

/**
 * Tool start event
 */
export interface ToolStartEvent extends CallbackEvent {
  type: 'tool_start';
  toolName: string;
  input: unknown;
}

/**
 * Tool end event
 */
export interface ToolEndEvent extends CallbackEvent {
  type: 'tool_end';
  toolName: string;
  input: unknown;
  output: unknown;
  durationMs: number;
}

/**
 * Tool error event
 */
export interface ToolErrorEvent extends CallbackEvent {
  type: 'tool_error';
  toolName: string;
  input: unknown;
  error: Error;
}

/**
 * Agent action event - agent decided to take an action
 */
export interface AgentActionEvent extends CallbackEvent {
  type: 'agent_action';
  action: string;
  actionInput: unknown;
  thought?: string;
}

/**
 * Agent observation event - agent received observation from tool
 */
export interface AgentObservationEvent extends CallbackEvent {
  type: 'agent_observation';
  action: string;
  observation: string;
}

/**
 * Agent finish event - agent completed
 */
export interface AgentFinishEvent extends CallbackEvent {
  type: 'agent_finish';
  output: unknown;
  intermediateSteps?: Array<{
    action: string;
    actionInput: unknown;
    observation: string;
  }>;
  durationMs: number;
}

/**
 * Agent error event
 */
export interface AgentErrorEvent extends CallbackEvent {
  type: 'agent_error';
  error: Error;
  intermediateSteps?: Array<{
    action: string;
    actionInput: unknown;
    observation: string;
  }>;
}

/**
 * Chain start event
 */
export interface ChainStartEvent extends CallbackEvent {
  type: 'chain_start';
  chainName: string;
  input: unknown;
}

/**
 * Chain end event
 */
export interface ChainEndEvent extends CallbackEvent {
  type: 'chain_end';
  chainName: string;
  output: unknown;
  durationMs: number;
}

/**
 * Chain error event
 */
export interface ChainErrorEvent extends CallbackEvent {
  type: 'chain_error';
  chainName: string;
  error: Error;
}

/**
 * LLM start event
 */
export interface LLMStartEvent extends CallbackEvent {
  type: 'llm_start';
  prompt: string;
  model: string;
  options?: LLMGenerateOptions;
}

/**
 * LLM end event
 */
export interface LLMEndEvent extends CallbackEvent {
  type: 'llm_end';
  content: string;
  model: string;
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  durationMs: number;
  cost?: number;
}

/**
 * LLM error event
 */
export interface LLMErrorEvent extends CallbackEvent {
  type: 'llm_error';
  error: Error;
  model: string;
}

/**
 * Retrieval start event
 */
export interface RetrievalStartEvent extends CallbackEvent {
  type: 'retrieval_start';
  query: string;
  collection?: string;
}

/**
 * Retrieval end event
 */
export interface RetrievalEndEvent extends CallbackEvent {
  type: 'retrieval_end';
  query: string;
  results: Array<{ content: string; score: number; metadata?: Record<string, unknown> }>;
  durationMs: number;
}

/**
 * Union of all callback events
 */
export type AnyCallbackEvent =
  | TokenStartEvent
  | TokenCallbackEvent
  | TokenEndEvent
  | ToolStartEvent
  | ToolEndEvent
  | ToolErrorEvent
  | AgentActionEvent
  | AgentObservationEvent
  | AgentFinishEvent
  | AgentErrorEvent
  | ChainStartEvent
  | ChainEndEvent
  | ChainErrorEvent
  | LLMStartEvent
  | LLMEndEvent
  | LLMErrorEvent
  | RetrievalStartEvent
  | RetrievalEndEvent;

/**
 * Callback handler interface
 */
export interface CallbackHandler {
  /** Handler name for identification */
  name: string;
  
  /** Event types this handler is interested in (empty = all) */
  eventTypes?: CallbackEventType[];
  
  /** Handle an event */
  handleEvent(event: AnyCallbackEvent): void | Promise<void>;
  
  /** Handle a stream event (from LLM streaming) */
  handleStreamEvent?(event: LLMStreamEvent): void | Promise<void>;
}

/**
 * Callback handler shortcuts
 */
export interface CallbackHandlerCallbacks {
  onTokenStart?: (event: TokenStartEvent) => void | Promise<void>;
  onToken?: (token: string, index: number, content: string) => void | Promise<void>;
  onTokenEnd?: (event: TokenEndEvent) => void | Promise<void>;
  onToolStart?: (event: ToolStartEvent) => void | Promise<void>;
  onToolEnd?: (event: ToolEndEvent) => void | Promise<void>;
  onToolError?: (event: ToolErrorEvent) => void | Promise<void>;
  onAgentAction?: (event: AgentActionEvent) => void | Promise<void>;
  onAgentObservation?: (event: AgentObservationEvent) => void | Promise<void>;
  onAgentFinish?: (event: AgentFinishEvent) => void | Promise<void>;
  onAgentError?: (event: AgentErrorEvent) => void | Promise<void>;
  onChainStart?: (event: ChainStartEvent) => void | Promise<void>;
  onChainEnd?: (event: ChainEndEvent) => void | Promise<void>;
  onChainError?: (event: ChainErrorEvent) => void | Promise<void>;
  onLLMStart?: (event: LLMStartEvent) => void | Promise<void>;
  onLLMEnd?: (event: LLMEndEvent) => void | Promise<void>;
  onLLMError?: (event: LLMErrorEvent) => void | Promise<void>;
  onRetrievalStart?: (event: RetrievalStartEvent) => void | Promise<void>;
  onRetrievalEnd?: (event: RetrievalEndEvent) => void | Promise<void>;
}

/**
 * Create a callback handler from shortcut callbacks
 */
export function createCallbackHandler(
  name: string,
  callbacks: CallbackHandlerCallbacks
): CallbackHandler {
  const eventTypes: CallbackEventType[] = [];
  
  if (callbacks.onTokenStart) eventTypes.push('token_start');
  if (callbacks.onToken) eventTypes.push('token');
  if (callbacks.onTokenEnd) eventTypes.push('token_end');
  if (callbacks.onToolStart) eventTypes.push('tool_start');
  if (callbacks.onToolEnd) eventTypes.push('tool_end');
  if (callbacks.onToolError) eventTypes.push('tool_error');
  if (callbacks.onAgentAction) eventTypes.push('agent_action');
  if (callbacks.onAgentObservation) eventTypes.push('agent_observation');
  if (callbacks.onAgentFinish) eventTypes.push('agent_finish');
  if (callbacks.onAgentError) eventTypes.push('agent_error');
  if (callbacks.onChainStart) eventTypes.push('chain_start');
  if (callbacks.onChainEnd) eventTypes.push('chain_end');
  if (callbacks.onChainError) eventTypes.push('chain_error');
  if (callbacks.onLLMStart) eventTypes.push('llm_start');
  if (callbacks.onLLMEnd) eventTypes.push('llm_end');
  if (callbacks.onLLMError) eventTypes.push('llm_error');
  if (callbacks.onRetrievalStart) eventTypes.push('retrieval_start');
  if (callbacks.onRetrievalEnd) eventTypes.push('retrieval_end');

  return {
    name,
    eventTypes: eventTypes.length > 0 ? eventTypes : undefined,
    async handleEvent(event: AnyCallbackEvent) {
      switch (event.type) {
        case 'token_start':
          await callbacks.onTokenStart?.(event);
          break;
        case 'token':
          await callbacks.onToken?.(event.token, event.index, event.content);
          break;
        case 'token_end':
          await callbacks.onTokenEnd?.(event);
          break;
        case 'tool_start':
          await callbacks.onToolStart?.(event);
          break;
        case 'tool_end':
          await callbacks.onToolEnd?.(event);
          break;
        case 'tool_error':
          await callbacks.onToolError?.(event);
          break;
        case 'agent_action':
          await callbacks.onAgentAction?.(event);
          break;
        case 'agent_observation':
          await callbacks.onAgentObservation?.(event);
          break;
        case 'agent_finish':
          await callbacks.onAgentFinish?.(event);
          break;
        case 'agent_error':
          await callbacks.onAgentError?.(event);
          break;
        case 'chain_start':
          await callbacks.onChainStart?.(event);
          break;
        case 'chain_end':
          await callbacks.onChainEnd?.(event);
          break;
        case 'chain_error':
          await callbacks.onChainError?.(event);
          break;
        case 'llm_start':
          await callbacks.onLLMStart?.(event);
          break;
        case 'llm_end':
          await callbacks.onLLMEnd?.(event);
          break;
        case 'llm_error':
          await callbacks.onLLMError?.(event);
          break;
        case 'retrieval_start':
          await callbacks.onRetrievalStart?.(event);
          break;
        case 'retrieval_end':
          await callbacks.onRetrievalEnd?.(event);
          break;
      }
    },
  };
}

/**
 * Generate a unique run ID
 */
function generateRunId(): string {
  return `run_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
}

/**
 * CallbackManager - centralized callback management
 */
export class CallbackManager {
  private handlers: CallbackHandler[] = [];
  private asyncMode: boolean;
  private verbose: boolean;

  constructor(options: { asyncMode?: boolean; verbose?: boolean } = {}) {
    this.asyncMode = options.asyncMode ?? true;
    this.verbose = options.verbose ?? false;
  }

  /**
   * Add a callback handler
   */
  addHandler(handler: CallbackHandler): this {
    this.handlers.push(handler);
    return this;
  }

  /**
   * Remove a callback handler by name
   */
  removeHandler(name: string): this {
    this.handlers = this.handlers.filter(h => h.name !== name);
    return this;
  }

  /**
   * Get all handlers
   */
  getHandlers(): CallbackHandler[] {
    return [...this.handlers];
  }

  /**
   * Clear all handlers
   */
  clearHandlers(): this {
    this.handlers = [];
    return this;
  }

  /**
   * Create a child manager that inherits handlers
   */
  createChild(): CallbackManager {
    const child = new CallbackManager({ asyncMode: this.asyncMode, verbose: this.verbose });
    for (const handler of this.handlers) {
      child.addHandler(handler);
    }
    return child;
  }

  /**
   * Emit an event to all interested handlers
   */
  async emit(event: AnyCallbackEvent): Promise<void> {
    const relevantHandlers = this.handlers.filter(
      h => !h.eventTypes || h.eventTypes.includes(event.type)
    );

    if (this.verbose) {
      console.log(`[CallbackManager] Emitting ${event.type} to ${relevantHandlers.length} handlers`);
    }

    if (this.asyncMode) {
      // Fire and forget - don't wait for handlers
      for (const handler of relevantHandlers) {
        try {
          Promise.resolve(handler.handleEvent(event)).catch(err => {
            console.error(`[CallbackManager] Handler ${handler.name} error:`, err);
          });
        } catch (err) {
          console.error(`[CallbackManager] Handler ${handler.name} error:`, err);
        }
      }
    } else {
      // Wait for all handlers
      await Promise.all(
        relevantHandlers.map(handler =>
          Promise.resolve(handler.handleEvent(event)).catch(err => {
            console.error(`[CallbackManager] Handler ${handler.name} error:`, err);
          })
        )
      );
    }
  }

  /**
   * Emit a stream event to handlers that support it
   */
  async emitStreamEvent(event: LLMStreamEvent): Promise<void> {
    const streamHandlers = this.handlers.filter(h => h.handleStreamEvent);

    for (const handler of streamHandlers) {
      try {
        await handler.handleStreamEvent?.(event);
      } catch (err) {
        console.error(`[CallbackManager] Stream handler ${handler.name} error:`, err);
      }
    }
  }

  // ============ Convenience methods for emitting events ============

  /**
   * Emit token start event
   */
  async emitTokenStart(
    prompt: string,
    options?: { model?: string; runId?: string; parentRunId?: string; metadata?: Record<string, unknown> }
  ): Promise<string> {
    const runId = options?.runId ?? generateRunId();
    await this.emit({
      type: 'token_start',
      timestamp: Date.now(),
      runId,
      parentRunId: options?.parentRunId,
      prompt,
      model: options?.model,
      metadata: options?.metadata,
    });
    return runId;
  }

  /**
   * Emit token event
   */
  async emitToken(
    runId: string,
    token: string,
    index: number,
    content: string,
    options?: { parentRunId?: string; metadata?: Record<string, unknown> }
  ): Promise<void> {
    await this.emit({
      type: 'token',
      timestamp: Date.now(),
      runId,
      parentRunId: options?.parentRunId,
      token,
      index,
      content,
      metadata: options?.metadata,
    });
  }

  /**
   * Emit token end event
   */
  async emitTokenEnd(
    runId: string,
    content: string,
    tokenCount: number,
    durationMs: number,
    options?: {
      usage?: { promptTokens: number; completionTokens: number; totalTokens: number };
      parentRunId?: string;
      metadata?: Record<string, unknown>;
    }
  ): Promise<void> {
    await this.emit({
      type: 'token_end',
      timestamp: Date.now(),
      runId,
      parentRunId: options?.parentRunId,
      content,
      tokenCount,
      usage: options?.usage,
      durationMs,
      metadata: options?.metadata,
    });
  }

  /**
   * Emit tool start event
   */
  async emitToolStart(
    toolName: string,
    input: unknown,
    options?: { runId?: string; parentRunId?: string; metadata?: Record<string, unknown> }
  ): Promise<string> {
    const runId = options?.runId ?? generateRunId();
    await this.emit({
      type: 'tool_start',
      timestamp: Date.now(),
      runId,
      parentRunId: options?.parentRunId,
      toolName,
      input,
      metadata: options?.metadata,
    });
    return runId;
  }

  /**
   * Emit tool end event
   */
  async emitToolEnd(
    runId: string,
    toolName: string,
    input: unknown,
    output: unknown,
    durationMs: number,
    options?: { parentRunId?: string; metadata?: Record<string, unknown> }
  ): Promise<void> {
    await this.emit({
      type: 'tool_end',
      timestamp: Date.now(),
      runId,
      parentRunId: options?.parentRunId,
      toolName,
      input,
      output,
      durationMs,
      metadata: options?.metadata,
    });
  }

  /**
   * Emit tool error event
   */
  async emitToolError(
    runId: string,
    toolName: string,
    input: unknown,
    error: Error,
    options?: { parentRunId?: string; metadata?: Record<string, unknown> }
  ): Promise<void> {
    await this.emit({
      type: 'tool_error',
      timestamp: Date.now(),
      runId,
      parentRunId: options?.parentRunId,
      toolName,
      input,
      error,
      metadata: options?.metadata,
    });
  }

  /**
   * Emit agent action event
   */
  async emitAgentAction(
    action: string,
    actionInput: unknown,
    options?: { thought?: string; runId?: string; parentRunId?: string; metadata?: Record<string, unknown> }
  ): Promise<string> {
    const runId = options?.runId ?? generateRunId();
    await this.emit({
      type: 'agent_action',
      timestamp: Date.now(),
      runId,
      parentRunId: options?.parentRunId,
      action,
      actionInput,
      thought: options?.thought,
      metadata: options?.metadata,
    });
    return runId;
  }

  /**
   * Emit agent observation event
   */
  async emitAgentObservation(
    runId: string,
    action: string,
    observation: string,
    options?: { parentRunId?: string; metadata?: Record<string, unknown> }
  ): Promise<void> {
    await this.emit({
      type: 'agent_observation',
      timestamp: Date.now(),
      runId,
      parentRunId: options?.parentRunId,
      action,
      observation,
      metadata: options?.metadata,
    });
  }

  /**
   * Emit agent finish event
   */
  async emitAgentFinish(
    runId: string,
    output: unknown,
    durationMs: number,
    options?: {
      intermediateSteps?: Array<{ action: string; actionInput: unknown; observation: string }>;
      parentRunId?: string;
      metadata?: Record<string, unknown>;
    }
  ): Promise<void> {
    await this.emit({
      type: 'agent_finish',
      timestamp: Date.now(),
      runId,
      parentRunId: options?.parentRunId,
      output,
      intermediateSteps: options?.intermediateSteps,
      durationMs,
      metadata: options?.metadata,
    });
  }

  /**
   * Emit agent error event
   */
  async emitAgentError(
    runId: string,
    error: Error,
    options?: {
      intermediateSteps?: Array<{ action: string; actionInput: unknown; observation: string }>;
      parentRunId?: string;
      metadata?: Record<string, unknown>;
    }
  ): Promise<void> {
    await this.emit({
      type: 'agent_error',
      timestamp: Date.now(),
      runId,
      parentRunId: options?.parentRunId,
      error,
      intermediateSteps: options?.intermediateSteps,
      metadata: options?.metadata,
    });
  }

  /**
   * Emit LLM start event
   */
  async emitLLMStart(
    prompt: string,
    model: string,
    options?: { llmOptions?: Record<string, unknown>; runId?: string; parentRunId?: string; metadata?: Record<string, unknown> }
  ): Promise<string> {
    const runId = options?.runId ?? generateRunId();
    await this.emit({
      type: 'llm_start',
      timestamp: Date.now(),
      runId,
      parentRunId: options?.parentRunId,
      prompt,
      model,
      options: options?.llmOptions,
      metadata: options?.metadata,
    });
    return runId;
  }

  /**
   * Emit LLM end event
   */
  async emitLLMEnd(
    runId: string,
    content: string,
    model: string,
    usage: { promptTokens: number; completionTokens: number; totalTokens: number },
    durationMs: number,
    options?: { parentRunId?: string; metadata?: Record<string, unknown>; cost?: number }
  ): Promise<void> {
    await this.emit({
      type: 'llm_end',
      timestamp: Date.now(),
      runId,
      parentRunId: options?.parentRunId,
      content,
      model,
      usage,
      durationMs,
      cost: options?.cost,
      metadata: options?.metadata,
    });
  }

  /**
   * Emit LLM error event
   */
  async emitLLMError(
    runId: string,
    error: Error,
    model: string,
    options?: { parentRunId?: string; metadata?: Record<string, unknown> }
  ): Promise<void> {
    await this.emit({
      type: 'llm_error',
      timestamp: Date.now(),
      runId,
      parentRunId: options?.parentRunId,
      error,
      model,
      metadata: options?.metadata,
    });
  }

  /**
   * Emit retrieval start event
   */
  async emitRetrievalStart(
    query: string,
    options?: { collection?: string; runId?: string; parentRunId?: string; metadata?: Record<string, unknown> }
  ): Promise<string> {
    const runId = options?.runId ?? generateRunId();
    await this.emit({
      type: 'retrieval_start',
      timestamp: Date.now(),
      runId,
      parentRunId: options?.parentRunId,
      query,
      collection: options?.collection,
      metadata: options?.metadata,
    });
    return runId;
  }

  /**
   * Emit retrieval end event
   */
  async emitRetrievalEnd(
    runId: string,
    query: string,
    results: Array<{ content: string; score: number; metadata?: Record<string, unknown> }>,
    durationMs: number,
    options?: { parentRunId?: string; metadata?: Record<string, unknown> }
  ): Promise<void> {
    await this.emit({
      type: 'retrieval_end',
      timestamp: Date.now(),
      runId,
      parentRunId: options?.parentRunId,
      query,
      results,
      durationMs,
      metadata: options?.metadata,
    });
  }
}

/**
 * Global callback manager instance
 */
let globalCallbackManager: CallbackManager | null = null;

/**
 * Get the global callback manager
 */
export function getCallbackManager(): CallbackManager {
  if (!globalCallbackManager) {
    globalCallbackManager = new CallbackManager();
  }
  return globalCallbackManager;
}

/**
 * Set the global callback manager
 */
export function setCallbackManager(manager: CallbackManager): void {
  globalCallbackManager = manager;
}

/**
 * Reset the global callback manager
 */
export function resetCallbackManager(): void {
  globalCallbackManager = null;
}

/**
 * Console logging callback handler - useful for debugging
 */
export const consoleCallbackHandler: CallbackHandler = {
  name: 'console',
  handleEvent(event: AnyCallbackEvent) {
    const timestamp = new Date(event.timestamp).toISOString();
    const prefix = `[${timestamp}] [${event.type}]`;
    
    switch (event.type) {
      case 'token':
        process.stdout.write(event.token);
        break;
      case 'token_start':
        console.log(`${prefix} Starting generation...`);
        break;
      case 'token_end':
        console.log(`\n${prefix} Completed in ${event.durationMs}ms (${event.tokenCount} tokens)`);
        break;
      case 'tool_start':
        console.log(`${prefix} Tool: ${event.toolName}`);
        break;
      case 'tool_end':
        console.log(`${prefix} Tool ${event.toolName} completed in ${event.durationMs}ms`);
        break;
      case 'tool_error':
        console.error(`${prefix} Tool ${event.toolName} error:`, event.error.message);
        break;
      case 'agent_action':
        console.log(`${prefix} Action: ${event.action}`);
        if (event.thought) console.log(`  Thought: ${event.thought}`);
        break;
      case 'agent_finish':
        console.log(`${prefix} Agent finished in ${event.durationMs}ms`);
        break;
      case 'agent_error':
        console.error(`${prefix} Agent error:`, event.error.message);
        break;
      case 'llm_start':
        console.log(`${prefix} LLM: ${event.model}`);
        break;
      case 'llm_end':
        console.log(`${prefix} LLM completed in ${event.durationMs}ms (${event.usage.totalTokens} tokens)`);
        break;
      case 'llm_error':
        console.error(`${prefix} LLM error:`, event.error.message);
        break;
      default:
        console.log(`${prefix}`, event);
    }
  },
};
