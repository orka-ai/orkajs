import type { ModuleMetadata, Type } from '@nestjs/common';
import type { BaseAgent } from '@orka-js/agent';

// ─── Module Config ────────────────────────────────────────────────────────────

/** Single named agent registration */
export interface AgentRegistration {
  name: string;
  agent: BaseAgent;
}

/**
 * Config for OrkaModule.forRoot()
 */
export interface OrkaModuleConfig {
  /**
   * Agents to register. Accepts either:
   * - Record form: `{ sales: salesAgent, support: supportAgent }`
   * - Array form:  `[{ name: 'sales', agent: salesAgent }]`
   */
  agents: Record<string, BaseAgent> | AgentRegistration[];
  /**
   * Path prefix for the built-in HTTP controller.
   * Defaults to `'orka'` → routes at /orka, /orka/:agent, /orka/:agent/stream
   * Set to `false` to disable HTTP controller entirely.
   */
  path?: string | false;
  /** Register as a NestJS global module. Default: false */
  global?: boolean;
}

/**
 * Options for OrkaModule.forRootAsync()
 */
export interface OrkaModuleAsyncConfig extends Pick<ModuleMetadata, 'imports'> {
  useFactory: (...args: unknown[]) => OrkaModuleConfig | Promise<OrkaModuleConfig>;
  inject?: (string | symbol | Type<unknown>)[];
  /** Path prefix for the HTTP controller (must be static for NestJS bootstrap) */
  path?: string | false;
  /** Register as a NestJS global module. Default: false */
  global?: boolean;
}

// ─── Decorator Metadata ───────────────────────────────────────────────────────

/** Metadata stored on a class by the @OrkaAgent decorator */
export interface OrkaAgentMetadata {
  /** Logical name for identification/documentation */
  name?: string;
  /** Human-readable description */
  description?: string;
}

/** Options for the @AgentReact method decorator */
export interface AgentReactOptions {
  /**
   * Name of the agent property on the class instance.
   * Defaults to `'agent'`.
   */
  agent?: string;
  /**
   * Fire-and-forget mode: don't await the agent run.
   * Method returns void synchronously.
   * Useful for @OnEvent() handlers that must not block.
   * Default: false
   */
  async?: boolean;
}

// ─── HTTP Controller ──────────────────────────────────────────────────────────

export interface AgentRunRequest {
  input: string;
  metadata?: Record<string, unknown>;
}

export interface AgentRunResponse {
  output: string;
  toolsUsed: string[];
  totalLatencyMs: number;
  totalTokens: number;
  metadata: Record<string, unknown>;
}

// ─── Microservice ─────────────────────────────────────────────────────────────

export interface MicroserviceAgentRunPayload {
  agentName: string;
  input: string;
  metadata?: Record<string, unknown>;
}

export interface OrkaClientModuleConfig {
  clients: OrkaClientRegistration[];
}

export interface OrkaClientRegistration {
  /** Name used with @InjectAgentClient(name) */
  name: string;
  /** NestJS ClientProxy options (transport, host, port, etc.) */
  options: Record<string, unknown>;
}
