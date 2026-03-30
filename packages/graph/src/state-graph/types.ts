import type { LLMAdapter, VectorDBAdapter, CallbackManager } from '@orka-js/core';
import type { Tracer } from '@orka-js/observability';

/**
 * Base state interface - all states must extend this
 */
export type BaseState = Record<string, unknown>;

/**
 * Reducer function type
 */
export type ReducerFn<T> = (current: T, update: T) => T;

/**
 * State annotation for defining state schema with reducers
 */
export interface StateAnnotation<T extends BaseState = BaseState> {
  /**
   * Default values for state properties
   */
  default: () => T;
  /**
   * Optional reducers for merging state updates
   */
  reducers?: Partial<{
    [K in keyof T]: ReducerFn<T[K]>;
  }>;
}

/**
 * Channel types for state properties
 */
export type ChannelType = 'value' | 'list' | 'set';

/**
 * Channel definition for state properties
 */
export interface ChannelDefinition<T = unknown> {
  type: ChannelType;
  default?: T;
  reducer?: (current: T, update: T) => T;
}

/**
 * State graph node function signature
 */
export type StateNodeFunction<S extends BaseState> = (
  state: S,
  config: StateGraphRunConfig<S>
) => Promise<Partial<S>> | Partial<S>;

/**
 * Conditional edge function - returns next node name or END
 */
export type ConditionalEdgeFunction<S extends BaseState> = (
  state: S
) => string | typeof END;

/**
 * Node definition in the state graph
 */
export interface StateNode<S extends BaseState> {
  name: string;
  fn: StateNodeFunction<S>;
  metadata?: Record<string, unknown>;
}

/**
 * Edge definition in the state graph
 */
export interface StateEdge {
  from: string;
  to: string | typeof END;
  condition?: string;
}

/**
 * Conditional edge definition
 */
export interface ConditionalEdge<S extends BaseState> {
  from: string;
  condition: ConditionalEdgeFunction<S>;
  pathMap: Record<string, string | typeof END>;
}

/**
 * Interrupt configuration
 */
export interface InterruptConfig {
  /**
   * Interrupt before these nodes
   */
  before?: string[];
  /**
   * Interrupt after these nodes
   */
  after?: string[];
}

/**
 * Checkpoint data for persistence
 */
export interface Checkpoint<S extends BaseState = BaseState> {
  /**
   * Unique checkpoint ID
   */
  id: string;
  /**
   * Thread ID for grouping related checkpoints
   */
  threadId: string;
  /**
   * Current state at this checkpoint
   */
  state: S;
  /**
   * Current node being executed (or next to execute)
   */
  currentNode: string;
  /**
   * Execution path so far
   */
  path: string[];
  /**
   * Node execution results
   */
  nodeResults: StateNodeResult[];
  /**
   * Timestamp of checkpoint creation
   */
  timestamp: number;
  /**
   * Parent checkpoint ID (for branching)
   */
  parentId?: string;
  /**
   * Metadata
   */
  metadata?: Record<string, unknown>;
  /**
   * Status of the execution
   */
  status: 'running' | 'interrupted' | 'completed' | 'error';
  /**
   * Interrupt reason if status is 'interrupted'
   */
  interruptReason?: 'before' | 'after';
  /**
   * Error message if status is 'error'
   */
  error?: string;
}

/**
 * Checkpoint store interface for persistence
 */
export interface CheckpointStore<S extends BaseState = BaseState> {
  /**
   * Save a checkpoint
   */
  save(checkpoint: Checkpoint<S>): Promise<void>;
  /**
   * Load a checkpoint by ID
   */
  load(checkpointId: string): Promise<Checkpoint<S> | null>;
  /**
   * Load the latest checkpoint for a thread
   */
  loadLatest(threadId: string): Promise<Checkpoint<S> | null>;
  /**
   * List all checkpoints for a thread
   */
  list(threadId: string): Promise<Checkpoint<S>[]>;
  /**
   * Delete a checkpoint
   */
  delete(checkpointId: string): Promise<void>;
  /**
   * Delete all checkpoints for a thread
   */
  deleteThread(threadId: string): Promise<void>;
}

/**
 * Time travel debugger interface
 */
export interface TimeTravelDebugger<S extends BaseState = BaseState> {
  /**
   * Get execution history for a thread
   */
  getHistory(threadId: string): Promise<CheckpointHistory<S>>;
  /**
   * Replay execution from a specific checkpoint
   */
  replayFrom(checkpointId: string, config?: StateGraphRunConfig<S>): Promise<StateGraphResult<S>>;
  /**
   * Fork execution from a checkpoint with modified state
   */
  fork(checkpointId: string, stateModifier: (state: S) => Partial<S>, config?: StateGraphRunConfig<S>): Promise<StateGraphResult<S>>;
  /**
   * Compare two checkpoints
   */
  diff(checkpointId1: string, checkpointId2: string): Promise<CheckpointDiff<S>>;
  /**
   * Get state at a specific point in time
   */
  getStateAt(threadId: string, timestamp: number): Promise<S | null>;
  /**
   * Visualize execution timeline
   */
  getTimeline(threadId: string): Promise<ExecutionTimeline<S>>;
}

/**
 * Checkpoint history for time travel
 */
export interface CheckpointHistory<S extends BaseState = BaseState> {
  threadId: string;
  checkpoints: Checkpoint<S>[];
  branches: CheckpointBranch<S>[];
  totalDurationMs: number;
  nodeExecutionCounts: Record<string, number>;
}

/**
 * Branch in checkpoint history
 */
export interface CheckpointBranch<S extends BaseState = BaseState> {
  branchId: string;
  parentCheckpointId: string;
  checkpoints: Checkpoint<S>[];
  createdAt: number;
}

/**
 * Diff between two checkpoints
 */
export interface CheckpointDiff<S extends BaseState = BaseState> {
  checkpoint1: Checkpoint<S>;
  checkpoint2: Checkpoint<S>;
  stateDiff: StateDiff<S>;
  pathDiff: {
    added: string[];
    removed: string[];
    common: string[];
  };
  timeDiff: number;
}

/**
 * State diff between checkpoints
 */
export interface StateDiff<S extends BaseState = BaseState> {
  added: Partial<S>;
  removed: Partial<S>;
  modified: {
    key: keyof S;
    before: unknown;
    after: unknown;
  }[];
}

/**
 * Execution timeline for visualization
 */
export interface ExecutionTimeline<S extends BaseState = BaseState> {
  threadId: string;
  events: TimelineEvent<S>[];
  branches: TimelineBranch[];
  startTime: number;
  endTime: number;
}

/**
 * Timeline event
 */
export interface TimelineEvent<S extends BaseState = BaseState> {
  type: 'node_start' | 'node_end' | 'state_change' | 'interrupt' | 'branch' | 'error';
  nodeId?: string;
  checkpointId: string;
  timestamp: number;
  state?: S;
  metadata?: Record<string, unknown>;
}

/**
 * Timeline branch
 */
export interface TimelineBranch {
  branchId: string;
  parentCheckpointId: string;
  startTime: number;
  endTime?: number;
}

/**
 * Run configuration for state graph execution
 */
export interface StateGraphRunConfig<S extends BaseState = BaseState> {
  /**
   * Thread ID for checkpoint persistence
   */
  threadId?: string;
  /**
   * Checkpoint store for persistence
   */
  checkpointer?: CheckpointStore<S>;
  /**
   * Interrupt configuration
   */
  interrupt?: InterruptConfig;
  /**
   * LLM adapter (optional, for LLM nodes)
   */
  llm?: LLMAdapter;
  /**
   * Vector DB adapter (optional, for retrieval nodes)
   */
  vectorDB?: VectorDBAdapter;
  /**
   * Maximum iterations to prevent infinite loops
   */
  maxIterations?: number;
  /**
   * Callback when a node completes
   */
  onNodeComplete?: (nodeId: string, state: S, result: Partial<S>) => void;
  /**
   * Callback on error
   */
  onError?: (error: Error, nodeId: string) => void;
  /**
   * Callback on interrupt
   */
  onInterrupt?: (checkpoint: Checkpoint<S>) => void;
  /**
   * CallbackManager for centralized observability
   */
  callbacks?: CallbackManager;
  /**
   * Additional metadata
   */
  metadata?: Record<string, unknown>;
}

/**
 * Node execution result
 */
export interface StateNodeResult {
  nodeId: string;
  input: Record<string, unknown>;
  output: Record<string, unknown>;
  latencyMs: number;
  timestamp: number;
}

/**
 * State graph execution result
 */
export interface StateGraphResult<S extends BaseState = BaseState> {
  /**
   * Final state after execution
   */
  state: S;
  /**
   * Execution path (node names)
   */
  path: string[];
  /**
   * Node execution results
   */
  nodeResults: StateNodeResult[];
  /**
   * Total execution time in ms
   */
  totalLatencyMs: number;
  /**
   * Final checkpoint (if checkpointer is configured)
   */
  checkpoint?: Checkpoint<S>;
  /**
   * Whether execution was interrupted
   */
  interrupted: boolean;
  /**
   * Metadata
   */
  metadata?: Record<string, unknown>;
}

/**
 * Special constants
 */
export const START = '__start__';
export const END = '__end__';

/**
 * State graph configuration
 */
export interface StateGraphConfig<S extends BaseState> {
  /**
   * State annotation defining the schema
   */
  stateAnnotation: StateAnnotation<S>;
  /**
   * Graph name
   */
  name?: string;
  /**
   * Tracer for automatic observability
   * When provided, the graph will automatically emit trace events
   */
  tracer?: Tracer;
}

/**
 * Compiled state graph interface
 */
export interface CompiledStateGraph<S extends BaseState> {
  /**
   * Run the graph with initial state
   */
  invoke(initialState: Partial<S>, config?: StateGraphRunConfig<S>): Promise<StateGraphResult<S>>;
  /**
   * Resume execution from a checkpoint
   */
  resume(checkpointId: string, config: StateGraphRunConfig<S> & { checkpointer: CheckpointStore<S> }): Promise<StateGraphResult<S>>;
  /**
   * Resume with updated state (for human-in-the-loop)
   */
  resumeWithState(
    checkpointId: string,
    stateUpdate: Partial<S>,
    config: StateGraphRunConfig<S> & { checkpointer: CheckpointStore<S> }
  ): Promise<StateGraphResult<S>>;
  /**
   * Stream execution events
   */
  stream(initialState: Partial<S>, config?: StateGraphRunConfig<S>): AsyncIterable<StateGraphEvent<S>>;
  /**
   * Get graph visualization in Mermaid format
   */
  toMermaid(): string;
  /**
   * Get all nodes
   */
  getNodes(): StateNode<S>[];
  /**
   * Get all edges
   */
  getEdges(): StateEdge[];
}

/**
 * State graph event types for streaming
 */
export type StateGraphEventType = 
  | 'node_start'
  | 'node_end'
  | 'state_update'
  | 'interrupt'
  | 'checkpoint'
  | 'error'
  | 'done';

/**
 * State graph event for streaming
 */
export interface StateGraphEvent<S extends BaseState = BaseState> {
  type: StateGraphEventType;
  nodeId?: string;
  state?: S;
  stateUpdate?: Partial<S>;
  checkpoint?: Checkpoint<S>;
  error?: Error;
  timestamp: number;
  metadata?: Record<string, unknown>;
}
