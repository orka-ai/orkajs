import { generateId } from '@orka-js/core';
import type {
  BaseState,
  Checkpoint,
  CheckpointStore,
  CheckpointHistory,
  CheckpointBranch,
  CheckpointDiff,
  StateDiff,
  ExecutionTimeline,
  TimelineEvent,
  TimelineBranch,
  TimeTravelDebugger,
  StateGraphRunConfig,
  StateGraphResult,
  CompiledStateGraph,
} from './types.js';

/**
 * Time Travel Debugger for StateGraph
 * Enables debugging by navigating through execution history
 */
export class StateGraphTimeTravel<S extends BaseState> implements TimeTravelDebugger<S> {
  private checkpointer: CheckpointStore<S>;
  private graph: CompiledStateGraph<S>;

  constructor(graph: CompiledStateGraph<S>, checkpointer: CheckpointStore<S>) {
    this.graph = graph;
    this.checkpointer = checkpointer;
  }

  /**
   * Get complete execution history for a thread
   */
  async getHistory(threadId: string): Promise<CheckpointHistory<S>> {
    const checkpoints = await this.checkpointer.list(threadId);
    
    // Sort by timestamp
    checkpoints.sort((a, b) => a.timestamp - b.timestamp);

    // Identify branches
    const branches = this.identifyBranches(checkpoints);

    // Calculate node execution counts
    const nodeExecutionCounts: Record<string, number> = {};
    for (const cp of checkpoints) {
      for (const nodeId of cp.path) {
        nodeExecutionCounts[nodeId] = (nodeExecutionCounts[nodeId] || 0) + 1;
      }
    }

    // Calculate total duration
    const totalDurationMs = checkpoints.length > 0
      ? checkpoints[checkpoints.length - 1].timestamp - checkpoints[0].timestamp
      : 0;

    return {
      threadId,
      checkpoints,
      branches,
      totalDurationMs,
      nodeExecutionCounts,
    };
  }

  /**
   * Replay execution from a specific checkpoint
   */
  async replayFrom(
    checkpointId: string,
    config?: StateGraphRunConfig<S>
  ): Promise<StateGraphResult<S>> {
    const checkpoint = await this.checkpointer.load(checkpointId);
    if (!checkpoint) {
      throw new Error(`Checkpoint "${checkpointId}" not found`);
    }

    return this.graph.resume(checkpointId, {
      ...config,
      checkpointer: this.checkpointer,
    });
  }

  /**
   * Fork execution from a checkpoint with modified state
   */
  async fork(
    checkpointId: string,
    stateModifier: (state: S) => Partial<S>,
    config?: StateGraphRunConfig<S>
  ): Promise<StateGraphResult<S>> {
    const checkpoint = await this.checkpointer.load(checkpointId);
    if (!checkpoint) {
      throw new Error(`Checkpoint "${checkpointId}" not found`);
    }

    // Apply state modification
    const stateUpdate = stateModifier(checkpoint.state);

    // Create a new branch
    const branchId = generateId();
    const newThreadId = config?.threadId ?? `${checkpoint.threadId}_branch_${branchId}`;

    return this.graph.resumeWithState(checkpointId, stateUpdate, {
      ...config,
      threadId: newThreadId,
      checkpointer: this.checkpointer,
      metadata: {
        ...config?.metadata,
        branchId,
        parentCheckpointId: checkpointId,
        forkedAt: Date.now(),
      },
    });
  }

  /**
   * Compare two checkpoints
   */
  async diff(
    checkpointId1: string,
    checkpointId2: string
  ): Promise<CheckpointDiff<S>> {
    const [cp1, cp2] = await Promise.all([
      this.checkpointer.load(checkpointId1),
      this.checkpointer.load(checkpointId2),
    ]);

    if (!cp1) throw new Error(`Checkpoint "${checkpointId1}" not found`);
    if (!cp2) throw new Error(`Checkpoint "${checkpointId2}" not found`);

    // Calculate state diff
    const stateDiff = this.calculateStateDiff(cp1.state, cp2.state);

    // Calculate path diff
    const path1Set = new Set(cp1.path);
    const path2Set = new Set(cp2.path);
    const pathDiff = {
      added: cp2.path.filter(n => !path1Set.has(n)),
      removed: cp1.path.filter(n => !path2Set.has(n)),
      common: cp1.path.filter(n => path2Set.has(n)),
    };

    return {
      checkpoint1: cp1,
      checkpoint2: cp2,
      stateDiff,
      pathDiff,
      timeDiff: cp2.timestamp - cp1.timestamp,
    };
  }

  /**
   * Get state at a specific point in time
   */
  async getStateAt(threadId: string, timestamp: number): Promise<S | null> {
    const checkpoints = await this.checkpointer.list(threadId);
    
    // Sort by timestamp
    checkpoints.sort((a, b) => a.timestamp - b.timestamp);

    // Find the checkpoint closest to (but not after) the timestamp
    let closest: Checkpoint<S> | null = null;
    for (const cp of checkpoints) {
      if (cp.timestamp <= timestamp) {
        closest = cp;
      } else {
        break;
      }
    }

    return closest?.state ?? null;
  }

  /**
   * Get execution timeline for visualization
   */
  async getTimeline(threadId: string): Promise<ExecutionTimeline<S>> {
    const checkpoints = await this.checkpointer.list(threadId);
    checkpoints.sort((a, b) => a.timestamp - b.timestamp);

    const events: TimelineEvent<S>[] = [];
    const branches: TimelineBranch[] = [];
    const branchMap = new Map<string, TimelineBranch>();

    for (const cp of checkpoints) {
      // Track branches
      if (cp.parentId && cp.metadata?.branchId) {
        const branchId = cp.metadata.branchId as string;
        if (!branchMap.has(branchId)) {
          const branch: TimelineBranch = {
            branchId,
            parentCheckpointId: cp.parentId,
            startTime: cp.timestamp,
          };
          branchMap.set(branchId, branch);
          branches.push(branch);

          events.push({
            type: 'branch',
            checkpointId: cp.id,
            timestamp: cp.timestamp,
            metadata: { branchId, parentCheckpointId: cp.parentId },
          });
        }
        branchMap.get(branchId)!.endTime = cp.timestamp;
      }

      // Add node events
      if (cp.nodeResults.length > 0) {
        const lastResult = cp.nodeResults[cp.nodeResults.length - 1];
        events.push({
          type: 'node_end',
          nodeId: lastResult.nodeId,
          checkpointId: cp.id,
          timestamp: lastResult.timestamp,
          state: cp.state,
        });
      }

      // Add state change event
      events.push({
        type: 'state_change',
        nodeId: cp.currentNode,
        checkpointId: cp.id,
        timestamp: cp.timestamp,
        state: cp.state,
      });

      // Add interrupt event
      if (cp.status === 'interrupted') {
        events.push({
          type: 'interrupt',
          nodeId: cp.currentNode,
          checkpointId: cp.id,
          timestamp: cp.timestamp,
          metadata: { reason: cp.interruptReason },
        });
      }

      // Add error event
      if (cp.status === 'error') {
        events.push({
          type: 'error',
          nodeId: cp.currentNode,
          checkpointId: cp.id,
          timestamp: cp.timestamp,
          metadata: { error: cp.error },
        });
      }
    }

    // Sort events by timestamp
    events.sort((a, b) => a.timestamp - b.timestamp);

    return {
      threadId,
      events,
      branches,
      startTime: checkpoints[0]?.timestamp ?? 0,
      endTime: checkpoints[checkpoints.length - 1]?.timestamp ?? 0,
    };
  }

  /**
   * Step back to previous checkpoint
   */
  async stepBack(checkpointId: string): Promise<Checkpoint<S> | null> {
    const checkpoint = await this.checkpointer.load(checkpointId);
    if (!checkpoint) return null;

    const checkpoints = await this.checkpointer.list(checkpoint.threadId);
    checkpoints.sort((a, b) => a.timestamp - b.timestamp);

    const index = checkpoints.findIndex(cp => cp.id === checkpointId);
    if (index <= 0) return null;

    return checkpoints[index - 1];
  }

  /**
   * Step forward to next checkpoint
   */
  async stepForward(checkpointId: string): Promise<Checkpoint<S> | null> {
    const checkpoint = await this.checkpointer.load(checkpointId);
    if (!checkpoint) return null;

    const checkpoints = await this.checkpointer.list(checkpoint.threadId);
    checkpoints.sort((a, b) => a.timestamp - b.timestamp);

    const index = checkpoints.findIndex(cp => cp.id === checkpointId);
    if (index < 0 || index >= checkpoints.length - 1) return null;

    return checkpoints[index + 1];
  }

  /**
   * Get all branches from a checkpoint
   */
  async getBranches(checkpointId: string): Promise<CheckpointBranch<S>[]> {
    const checkpoint = await this.checkpointer.load(checkpointId);
    if (!checkpoint) return [];

    const allCheckpoints = await this.checkpointer.list(checkpoint.threadId);
    
    // Find checkpoints that have this checkpoint as parent
    const childCheckpoints = allCheckpoints.filter(
      cp => cp.parentId === checkpointId && cp.metadata?.branchId
    );

    // Group by branch
    const branchMap = new Map<string, Checkpoint<S>[]>();
    for (const cp of childCheckpoints) {
      const branchId = cp.metadata!.branchId as string;
      if (!branchMap.has(branchId)) {
        branchMap.set(branchId, []);
      }
      branchMap.get(branchId)!.push(cp);
    }

    return Array.from(branchMap.entries()).map(([branchId, checkpoints]) => ({
      branchId,
      parentCheckpointId: checkpointId,
      checkpoints: checkpoints.sort((a, b) => a.timestamp - b.timestamp),
      createdAt: checkpoints[0]?.timestamp ?? 0,
    }));
  }

  /**
   * Identify branches in checkpoint history
   */
  private identifyBranches(checkpoints: Checkpoint<S>[]): CheckpointBranch<S>[] {
    const branchMap = new Map<string, Checkpoint<S>[]>();

    for (const cp of checkpoints) {
      if (cp.metadata?.branchId) {
        const branchId = cp.metadata.branchId as string;
        if (!branchMap.has(branchId)) {
          branchMap.set(branchId, []);
        }
        branchMap.get(branchId)!.push(cp);
      }
    }

    return Array.from(branchMap.entries()).map(([branchId, cps]) => {
      const sorted = cps.sort((a, b) => a.timestamp - b.timestamp);
      return {
        branchId,
        parentCheckpointId: sorted[0]?.parentId ?? '',
        checkpoints: sorted,
        createdAt: sorted[0]?.timestamp ?? 0,
      };
    });
  }

  /**
   * Calculate diff between two states
   */
  private calculateStateDiff(state1: S, state2: S): StateDiff<S> {
    const added: Partial<S> = {};
    const removed: Partial<S> = {};
    const modified: { key: keyof S; before: unknown; after: unknown }[] = [];

    const keys1 = new Set(Object.keys(state1) as (keyof S)[]);
    const keys2 = new Set(Object.keys(state2) as (keyof S)[]);

    // Find added keys
    for (const key of keys2) {
      if (!keys1.has(key)) {
        added[key] = state2[key];
      }
    }

    // Find removed keys
    for (const key of keys1) {
      if (!keys2.has(key)) {
        removed[key] = state1[key];
      }
    }

    // Find modified keys
    for (const key of keys1) {
      if (keys2.has(key)) {
        const val1 = state1[key];
        const val2 = state2[key];
        if (!this.deepEqual(val1, val2)) {
          modified.push({ key, before: val1, after: val2 });
        }
      }
    }

    return { added, removed, modified };
  }

  /**
   * Deep equality check
   */
  private deepEqual(a: unknown, b: unknown): boolean {
    if (a === b) return true;
    if (typeof a !== typeof b) return false;
    if (a === null || b === null) return a === b;
    if (typeof a !== 'object') return a === b;

    if (Array.isArray(a) && Array.isArray(b)) {
      if (a.length !== b.length) return false;
      return a.every((val, i) => this.deepEqual(val, b[i]));
    }

    if (Array.isArray(a) || Array.isArray(b)) return false;

    const keysA = Object.keys(a as object);
    const keysB = Object.keys(b as object);
    if (keysA.length !== keysB.length) return false;

    return keysA.every(key => 
      this.deepEqual(
        (a as Record<string, unknown>)[key],
        (b as Record<string, unknown>)[key]
      )
    );
  }
}

/**
 * Create a time travel debugger for a compiled graph
 */
export function createTimeTravel<S extends BaseState>(
  graph: CompiledStateGraph<S>,
  checkpointer: CheckpointStore<S>
): StateGraphTimeTravel<S> {
  return new StateGraphTimeTravel(graph, checkpointer);
}
