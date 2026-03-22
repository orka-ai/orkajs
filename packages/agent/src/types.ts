import type { LLMAdapter, VectorDBAdapter } from '@orka-js/core';
import type { Knowledge } from '@orka-js/core';
import type { Memory } from '@orka-js/memory-store';

export interface Tool {
  name: string;
  description: string;
  parameters?: ToolParameter[];
  execute(input: Record<string, unknown>): Promise<ToolResult>;
}

export interface ToolParameter {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'object';
  description: string;
  required?: boolean;
}

export interface ToolResult {
  output: string;
  metadata?: Record<string, unknown>;
  error?: string;
}

export interface AgentConfig {
  name?: string;
  goal: string;
  tools: Tool[];
  policy?: AgentPolicy;
  systemPrompt?: string;
  maxSteps?: number;
  temperature?: number;
}

export interface AgentPolicy {
  maxSteps?: number;
  noHallucination?: boolean;
  requireSource?: boolean;
  rules?: string[];
  allowedTools?: string[];
  blockedTools?: string[];
}

export interface AgentContext {
  goal: string;
  input: string;
  steps: AgentStepResult[];
  llm: LLMAdapter;
  vectorDB?: VectorDBAdapter;
  knowledge?: Knowledge;
  memory?: Memory;
  metadata: Record<string, unknown>;
}

export interface AgentStepResult {
  thought: string;
  action: string;
  actionInput: Record<string, unknown>;
  observation: string;
  latencyMs: number;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

export interface AgentResult {
  input: string;
  output: string;
  steps: AgentStepResult[];
  totalLatencyMs: number;
  totalTokens: number;
  toolsUsed: string[];
  metadata: Record<string, unknown>;
}

export interface ReActAgentConfig {
  name?: string;
  goal: string;
  tools: Tool[];
  policy?: AgentPolicy;
  systemPrompt?: string;
  maxSteps?: number;
  temperature?: number;
  verbose?: boolean;
}

export interface PlanStep {
  id: number;
  description: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  result?: string;
}

export interface PlanAndExecuteAgentConfig {
  name?: string;
  goal: string;
  tools: Tool[];
  policy?: AgentPolicy;
  systemPrompt?: string;
  maxSteps?: number;
  temperature?: number;
  replanOnFailure?: boolean;
}

export interface PlanAndExecuteResult extends AgentResult {
  plan: PlanStep[];
}

export interface OpenAIFunction {
  name: string;
  description: string;
  parameters: {
    type: 'object';
    properties: Record<string, {
      type: string;
      description?: string;
      enum?: string[];
    }>;
    required?: string[];
  };
}

export interface OpenAIFunctionsAgentConfig {
  name?: string;
  goal: string;
  tools: Tool[];
  functions?: OpenAIFunction[];
  policy?: AgentPolicy;
  systemPrompt?: string;
  maxSteps?: number;
  temperature?: number;
}

export interface StructuredChatAgentConfig {
  name?: string;
  goal: string;
  tools: Tool[];
  policy?: AgentPolicy;
  systemPrompt?: string;
  maxSteps?: number;
  temperature?: number;
  outputSchema?: Record<string, unknown>;
}

export interface AgentToolkit {
  name: string;
  description: string;
  tools: Tool[];
}

export interface SQLToolkitConfig {
  execute: (query: string) => Promise<string>;
  schema?: string;
  readOnly?: boolean;
  maxRows?: number;
}

export interface CSVToolkitConfig {
  data: string;
  separator?: string;
}

// ============================================
// Agent Platform - Identity & Registry Types
// ============================================

/**
 * Agent Identity - Makes agents first-class citizens
 * Every agent has a unique identity with metadata
 */
export interface AgentIdentity {
  /** Unique identifier for the agent */
  id: string;
  /** Human-readable name */
  name: string;
  /** Agent's role/purpose in the system */
  role: string;
  /** Detailed description of what the agent does */
  description: string;
  /** Semantic version (e.g., "1.0.0") */
  version: string;
  /** Creation timestamp */
  createdAt: Date;
  /** Last update timestamp */
  updatedAt: Date;
  /** Agent metadata for discovery and filtering */
  metadata: AgentMetadata;
}

/**
 * Agent Metadata - Rich information for agent discovery
 */
export interface AgentMetadata {
  /** Tags for categorization (e.g., ["sales", "crm", "automation"]) */
  tags: string[];
  /** Agent capabilities (e.g., ["email", "calendar", "database"]) */
  capabilities: string[];
  /** Dependencies on other agents or services */
  dependencies?: string[];
  /** Author/creator information */
  author?: string;
  /** License (e.g., "MIT", "proprietary") */
  license?: string;
  /** Custom metadata fields */
  custom?: Record<string, unknown>;
}

/**
 * Registered Agent - Full agent with identity and configuration
 */
export interface RegisteredAgent {
  /** Agent identity */
  identity: AgentIdentity;
  /** Agent configuration */
  config: AgentConfig;
  /** Agent type */
  type: 'react' | 'plan-and-execute' | 'openai-functions' | 'structured-chat' | 'custom';
  /** Agent instance (lazy-loaded) */
  instance?: unknown;
}

/**
 * Agent Registry Query Options
 */
export interface AgentQueryOptions {
  /** Filter by tags */
  tags?: string[];
  /** Filter by capabilities */
  capabilities?: string[];
  /** Filter by role */
  role?: string;
  /** Filter by author */
  author?: string;
  /** Search in name/description */
  search?: string;
  /** Limit results */
  limit?: number;
}

/**
 * Agent Registry Statistics
 */
export interface AgentRegistryStats {
  /** Total number of registered agents */
  totalAgents: number;
  /** Agents by type */
  agentsByType: Record<string, number>;
  /** Most used tags */
  popularTags: Array<{ tag: string; count: number }>;
  /** Most used capabilities */
  popularCapabilities: Array<{ capability: string; count: number }>;
}
