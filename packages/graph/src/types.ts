import type { LLMAdapter, VectorDBAdapter, RetrievedContext } from '@orkajs/core';
import type { Knowledge } from '@orkajs/core';

export interface GraphContext {
  input: string;
  output: string;
  nodeOutputs: Record<string, string>;
  context: RetrievedContext[];
  metadata: Record<string, unknown>;
  llm: LLMAdapter;
  vectorDB?: VectorDBAdapter;
  knowledge?: Knowledge;
}

export interface GraphNode {
  id: string;
  type: 'action' | 'condition' | 'parallel' | 'start' | 'end';
  execute?: (ctx: GraphContext) => Promise<GraphContext>;
  condition?: (ctx: GraphContext) => string;
  parallelNodes?: string[];
  metadata?: Record<string, unknown>;
}

export interface GraphEdge {
  from: string;
  to: string;
  label?: string;
}

export interface GraphConfig {
  name: string;
  nodes: GraphNode[];
  edges: GraphEdge[];
  maxIterations?: number;
  onNodeComplete?: (nodeId: string, ctx: GraphContext) => void;
  onError?: (error: Error, nodeId: string) => void;
}

export interface GraphNodeResult {
  nodeId: string;
  type: GraphNode['type'];
  output: string;
  latencyMs: number;
  metadata?: Record<string, unknown>;
}

export interface GraphResult {
  name: string;
  input: string;
  output: string;
  nodeResults: GraphNodeResult[];
  path: string[];
  totalLatencyMs: number;
  metadata: Record<string, unknown>;
}
