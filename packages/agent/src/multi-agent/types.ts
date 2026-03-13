import type { LLMAdapter } from '@orka-js/core';
import type { Tool } from '../types.js';

/**
 * Agent role in a multi-agent system
 */
export interface AgentRole {
  name: string;
  description: string;
  systemPrompt: string;
  tools?: Tool[];
  llm?: LLMAdapter;
}

/**
 * Message between agents
 */
export interface AgentMessage {
  id: string;
  from: string;
  to: string | 'broadcast';
  content: string;
  type: 'request' | 'response' | 'broadcast' | 'delegate' | 'report';
  metadata?: Record<string, unknown>;
  timestamp: number;
  replyTo?: string;
}

/**
 * Agent state in collaboration
 */
export interface AgentState {
  agentId: string;
  role: AgentRole;
  status: 'idle' | 'working' | 'waiting' | 'completed' | 'error';
  currentTask?: string;
  messages: AgentMessage[];
  results: unknown[];
}

/**
 * Collaboration strategy
 */
export type CollaborationStrategy = 
  | 'supervisor'      // One agent supervises others
  | 'peer-to-peer'    // Agents communicate directly
  | 'hierarchical'    // Tree structure of agents
  | 'round-robin'     // Agents take turns
  | 'consensus';      // Agents must agree

/**
 * Multi-agent team configuration
 */
export interface AgentTeamConfig {
  name: string;
  strategy: CollaborationStrategy;
  agents: AgentRole[];
  supervisor?: string;
  maxRounds?: number;
  consensusThreshold?: number;
  llm: LLMAdapter;
}

/**
 * Task for the agent team
 */
export interface TeamTask {
  id: string;
  description: string;
  context?: string;
  requiredAgents?: string[];
  deadline?: number;
  priority?: 'low' | 'medium' | 'high';
}

/**
 * Team execution result
 */
export interface TeamResult {
  taskId: string;
  success: boolean;
  output: string;
  agentContributions: AgentContribution[];
  messages: AgentMessage[];
  rounds: number;
  totalLatencyMs: number;
  metadata?: Record<string, unknown>;
}

/**
 * Individual agent contribution
 */
export interface AgentContribution {
  agentId: string;
  role: string;
  actions: string[];
  output?: string;
  latencyMs: number;
}

/**
 * Event types for multi-agent collaboration
 */
export type TeamEventType = 
  | 'task_started'
  | 'agent_assigned'
  | 'agent_started'
  | 'agent_completed'
  | 'message_sent'
  | 'message_received'
  | 'round_completed'
  | 'consensus_reached'
  | 'task_completed'
  | 'error';

/**
 * Team event for streaming
 */
export interface TeamEvent {
  type: TeamEventType;
  agentId?: string;
  message?: AgentMessage;
  state?: AgentState;
  round?: number;
  timestamp: number;
  metadata?: Record<string, unknown>;
}
