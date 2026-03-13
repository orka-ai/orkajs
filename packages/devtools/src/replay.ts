import type { TraceRun, ReplayOptions, ReplayResult } from './types.js';
import { getCollector } from './collector.js';

/**
 * Replay Debugger - Replay traces with modified inputs
 */
export class ReplayDebugger {
  /**
   * Replay a trace run with optionally modified input
   */
  async replay(options: ReplayOptions): Promise<ReplayResult> {
    const collector = getCollector();
    const originalRun = collector.findRun(options.runId, options.sessionId);

    if (!originalRun) {
      throw new Error(`Run not found: ${options.runId}`);
    }

    // Get the modified input
    const modifiedInput = options.modifyInput 
      ? options.modifyInput(originalRun.input)
      : originalRun.input;

    // Create a new session for the replay
    const replaySessionId = collector.startSession(`Replay: ${originalRun.name}`);

    // Start the replayed run
    const replayRunId = collector.startRun(
      originalRun.type,
      `replay:${originalRun.name}`,
      modifiedInput,
      {
        ...originalRun.metadata,
        replayOf: originalRun.id,
        originalSessionId: options.sessionId,
      }
    );

    // For now, we just copy the output (actual replay would re-execute)
    // In a real implementation, this would call the original function
    const replayedOutput = originalRun.output;

    collector.endRun(replayRunId, replayedOutput, originalRun.metadata);
    collector.endSession(replaySessionId);

    // Get the replayed run
    const replayedRun = collector.findRun(replayRunId);

    if (!replayedRun) {
      throw new Error('Failed to create replayed run');
    }

    // Calculate diff
    const inputChanged = JSON.stringify(originalRun.input) !== JSON.stringify(modifiedInput);
    const outputChanged = JSON.stringify(originalRun.output) !== JSON.stringify(replayedRun.output);
    const latencyDiff = (replayedRun.latencyMs ?? 0) - (originalRun.latencyMs ?? 0);

    return {
      originalRun,
      replayedRun,
      diff: {
        inputChanged,
        outputChanged,
        latencyDiff,
      },
    };
  }

  /**
   * Fork a trace to create a new branch for experimentation
   */
  fork(runId: string, sessionId?: string): string {
    const collector = getCollector();
    const originalRun = collector.findRun(runId, sessionId);

    if (!originalRun) {
      throw new Error(`Run not found: ${runId}`);
    }

    // Create a new session for the fork
    const forkSessionId = collector.startSession(`Fork: ${originalRun.name}`);

    // Deep clone the run tree
    this.cloneRunTree(originalRun, forkSessionId);

    collector.endSession(forkSessionId);

    return forkSessionId;
  }

  /**
   * Clone a run and its children
   */
  private cloneRunTree(run: TraceRun, _sessionId: string, parentId?: string): string {
    const collector = getCollector();

    const newRunId = collector.startRun(
      run.type,
      `fork:${run.name}`,
      run.input,
      {
        ...run.metadata,
        forkedFrom: run.id,
        originalParentId: parentId,
      }
    );

    // Clone children
    for (const child of run.children) {
      this.cloneRunTree(child, _sessionId, newRunId);
    }

    // End the run with original output
    if (run.status === 'error') {
      collector.errorRun(newRunId, run.error ?? 'Unknown error');
    } else {
      collector.endRun(newRunId, run.output, run.metadata);
    }

    return newRunId;
  }

  /**
   * Compare two runs and return detailed diff
   */
  compare(runId1: string, runId2: string, sessionId?: string): RunComparison {
    const collector = getCollector();
    const run1 = collector.findRun(runId1, sessionId);
    const run2 = collector.findRun(runId2, sessionId);

    if (!run1 || !run2) {
      throw new Error('One or both runs not found');
    }

    return {
      run1: {
        id: run1.id,
        name: run1.name,
        type: run1.type,
        latencyMs: run1.latencyMs,
        status: run1.status,
        tokenCount: run1.metadata?.totalTokens as number | undefined,
      },
      run2: {
        id: run2.id,
        name: run2.name,
        type: run2.type,
        latencyMs: run2.latencyMs,
        status: run2.status,
        tokenCount: run2.metadata?.totalTokens as number | undefined,
      },
      diff: {
        latencyDiff: (run2.latencyMs ?? 0) - (run1.latencyMs ?? 0),
        latencyDiffPercent: run1.latencyMs 
          ? ((run2.latencyMs ?? 0) - run1.latencyMs) / run1.latencyMs * 100 
          : 0,
        tokenDiff: ((run2.metadata?.totalTokens as number) ?? 0) - ((run1.metadata?.totalTokens as number) ?? 0),
        statusChanged: run1.status !== run2.status,
        inputChanged: JSON.stringify(run1.input) !== JSON.stringify(run2.input),
        outputChanged: JSON.stringify(run1.output) !== JSON.stringify(run2.output),
      },
    };
  }

  /**
   * Export a run as a reproducible test case
   */
  exportTestCase(runId: string, sessionId?: string): TestCase {
    const collector = getCollector();
    const run = collector.findRun(runId, sessionId);

    if (!run) {
      throw new Error(`Run not found: ${runId}`);
    }

    return {
      name: `test_${run.name}_${run.id.slice(0, 8)}`,
      description: `Exported from DevTools trace ${run.id}`,
      type: run.type,
      input: run.input,
      expectedOutput: run.output,
      metadata: run.metadata,
      assertions: [
        { type: 'status', expected: run.status },
        { type: 'latency_max', expected: (run.latencyMs ?? 0) * 1.5 },
      ],
      createdAt: new Date().toISOString(),
    };
  }
}

/**
 * Run comparison result
 */
export interface RunComparison {
  run1: RunSummary;
  run2: RunSummary;
  diff: {
    latencyDiff: number;
    latencyDiffPercent: number;
    tokenDiff: number;
    statusChanged: boolean;
    inputChanged: boolean;
    outputChanged: boolean;
  };
}

interface RunSummary {
  id: string;
  name: string;
  type: string;
  latencyMs?: number;
  status: string;
  tokenCount?: number;
}

/**
 * Exported test case
 */
export interface TestCase {
  name: string;
  description: string;
  type: string;
  input: unknown;
  expectedOutput: unknown;
  metadata?: Record<string, unknown>;
  assertions: Array<{
    type: string;
    expected: unknown;
  }>;
  createdAt: string;
}

/**
 * Create a replay debugger instance
 */
export function createReplayDebugger(): ReplayDebugger {
  return new ReplayDebugger();
}

// Singleton instance
let replayDebugger: ReplayDebugger | undefined;

/**
 * Get the global replay debugger instance
 */
export function getReplayDebugger(): ReplayDebugger {
  if (!replayDebugger) {
    replayDebugger = new ReplayDebugger();
  }
  return replayDebugger;
}
