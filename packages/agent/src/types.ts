import type { LLMAdapter, VectorDBAdapter, CallbackManager } from '@orka-js/core';
import type { Knowledge } from '@orka-js/core';
import type { Memory } from '@orka-js/memory-store';

export interface Tool<TInput extends Record<string, unknown> = Record<string, unknown>> {
  name: string;
  description: string;
  parameters?: ToolParameter[];
  execute(input: TInput): Promise<ToolResult>;
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
  /** CallbackManager for centralized observability */
  callbacks?: CallbackManager;
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

// ============================================
// Agent Platform - Permissions & Access Control
// ============================================

/**
 * Permission action types for agents
 */
export type PermissionAction = 'read' | 'execute' | 'edit' | 'clone' | 'delete' | 'admin';

/**
 * Principal types that can have permissions
 */
export type PrincipalType = 'user' | 'team' | 'role' | 'service';

/**
 * Principal - Entity that can have permissions
 */
export interface Principal {
  /** Type of principal */
  type: PrincipalType;
  /** Principal identifier (e.g., "user:john", "team:sales", "role:admin") */
  id: string;
}

/**
 * Permission Rule - Defines who can do what
 */
export interface PermissionRule {
  /** Action being permitted */
  action: PermissionAction;
  /** Principals allowed to perform this action */
  principals: string[];
  /** Optional conditions for the permission */
  conditions?: PermissionCondition[];
}

/**
 * Permission Condition - Additional constraints on permissions
 */
export interface PermissionCondition {
  /** Condition type */
  type: 'time_range' | 'ip_whitelist' | 'rate_limit' | 'custom';
  /** Condition configuration */
  config: Record<string, unknown>;
}

/**
 * Agent Permissions - Full permission configuration for an agent
 */
export interface AgentPermissions {
  /** Agent ID these permissions apply to */
  agentId: string;
  /** Owner of the agent (has all permissions) */
  owner: string;
  /** Permission rules */
  rules: PermissionRule[];
  /** Whether the agent is public (anyone can read) */
  isPublic?: boolean;
  /** Inherit permissions from parent/team */
  inheritFrom?: string;
}

/**
 * Permission Check Request
 */
export interface PermissionCheckRequest {
  /** Principal requesting access */
  principal: Principal;
  /** Action being requested */
  action: PermissionAction;
  /** Agent ID being accessed */
  agentId: string;
  /** Additional context for condition evaluation */
  context?: Record<string, unknown>;
}

/**
 * Permission Check Result
 */
export interface PermissionCheckResult {
  /** Whether access is allowed */
  allowed: boolean;
  /** Reason for the decision */
  reason: string;
  /** Matched rule (if allowed) */
  matchedRule?: PermissionRule;
  /** Conditions that were evaluated */
  evaluatedConditions?: Array<{ condition: PermissionCondition; passed: boolean }>;
}

// ============================================
// Agent Platform - Audit & Logging
// ============================================

/**
 * Audit Event Types
 */
export type AuditEventType = 
  | 'agent.registered'
  | 'agent.updated'
  | 'agent.deleted'
  | 'agent.executed'
  | 'agent.cloned'
  | 'permission.granted'
  | 'permission.revoked'
  | 'permission.denied'
  | 'access.allowed'
  | 'access.denied';

/**
 * Audit Event - Record of an action in the system
 */
export interface AuditEvent {
  /** Unique event ID */
  id: string;
  /** Event type */
  type: AuditEventType;
  /** Timestamp of the event */
  timestamp: Date;
  /** Principal who triggered the event */
  principal: Principal;
  /** Agent ID involved (if applicable) */
  agentId?: string;
  /** Action performed */
  action?: PermissionAction;
  /** Event outcome */
  outcome: 'success' | 'failure' | 'denied';
  /** Additional event details */
  details?: Record<string, unknown>;
  /** Request metadata (IP, user agent, etc.) */
  metadata?: AuditMetadata;
}

/**
 * Audit Metadata - Request context information
 */
export interface AuditMetadata {
  /** Client IP address */
  ipAddress?: string;
  /** User agent string */
  userAgent?: string;
  /** Request ID for correlation */
  requestId?: string;
  /** Session ID */
  sessionId?: string;
  /** Geographic location */
  location?: string;
  /** Custom metadata */
  custom?: Record<string, unknown>;
}

/**
 * Audit Query Options
 */
export interface AuditQueryOptions {
  /** Filter by event types */
  types?: AuditEventType[];
  /** Filter by principal */
  principal?: string;
  /** Filter by agent ID */
  agentId?: string;
  /** Filter by outcome */
  outcome?: 'success' | 'failure' | 'denied';
  /** Start date */
  from?: Date;
  /** End date */
  to?: Date;
  /** Limit results */
  limit?: number;
  /** Offset for pagination */
  offset?: number;
}

/**
 * Audit Statistics
 */
export interface AuditStats {
  /** Total events in period */
  totalEvents: number;
  /** Events by type */
  eventsByType: Record<AuditEventType, number>;
  /** Events by outcome */
  eventsByOutcome: Record<string, number>;
  /** Most active principals */
  topPrincipals: Array<{ principal: string; count: number }>;
  /** Most accessed agents */
  topAgents: Array<{ agentId: string; count: number }>;
  /** Access denied count */
  accessDeniedCount: number;
}

// ============================================
// Agent Platform - Team Management
// ============================================

/**
 * Team - Group of users with shared permissions
 */
export interface Team {
  /** Unique team ID */
  id: string;
  /** Team name */
  name: string;
  /** Team description */
  description?: string;
  /** Team members (user IDs) */
  members: string[];
  /** Team roles */
  roles: TeamRole[];
  /** Team-level permissions for agents */
  agentPermissions: Record<string, PermissionAction[]>;
  /** Creation timestamp */
  createdAt: Date;
  /** Last update timestamp */
  updatedAt: Date;
}

/**
 * Team Role - Role within a team
 */
export interface TeamRole {
  /** Role ID */
  id: string;
  /** Role name (e.g., "admin", "member", "viewer") */
  name: string;
  /** Role description */
  description?: string;
  /** Permissions granted by this role */
  permissions: PermissionAction[];
}

/**
 * Team Member - User's membership in a team
 */
export interface TeamMember {
  /** User ID */
  userId: string;
  /** Team ID */
  teamId: string;
  /** Role within the team */
  role: string;
  /** When the user joined */
  joinedAt: Date;
}
