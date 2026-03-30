import { generateId, OrkaError, OrkaErrorCode } from '@orka-js/core';
import type { Tracer } from '@orka-js/observability';
import type {
  BaseState,
  StateAnnotation,
  StateNode,
  StateNodeFunction,
  StateEdge,
  ConditionalEdge,
  ConditionalEdgeFunction,
  StateGraphConfig,
  CompiledStateGraph,
  StateGraphRunConfig,
  StateGraphResult,
  StateNodeResult,
  Checkpoint,
  StateGraphEvent,
} from './types.js';
import { START, END } from './types.js';

/**
 * StateGraph - A typed state machine for building complex LLM workflows
 * 
 * Features:
 * - Typed state with annotations
 * - Conditional branching
 * - Interrupts (human-in-the-loop)
 * - Checkpoint persistence
 * - Streaming execution
 */
export class StateGraph<S extends BaseState> {
  private stateAnnotation: StateAnnotation<S>;
  private nodes: Map<string, StateNode<S>> = new Map();
  private edges: StateEdge[] = [];
  private conditionalEdges: ConditionalEdge<S>[] = [];
  private entryPoint: string | null = null;
  private graphName?: string;
  private tracer?: Tracer;

  constructor(config: StateGraphConfig<S>) {
    this.stateAnnotation = config.stateAnnotation;
    this.graphName = config.name;
    this.tracer = config.tracer;
  }

  /**
   * Add a node to the graph
   */
  addNode(name: string, fn: StateNodeFunction<S>, metadata?: Record<string, unknown>): this {
    if (name === START || name === END) {
      throw new OrkaError(
        `Cannot use reserved node name: ${name}`,
        OrkaErrorCode.GRAPH_INVALID_CONFIG,
        'StateGraph',
        undefined,
        { name }
      );
    }
    if (this.nodes.has(name)) {
      throw new OrkaError(
        `Node "${name}" already exists`,
        OrkaErrorCode.GRAPH_INVALID_CONFIG,
        'StateGraph',
        undefined,
        { name }
      );
    }
    this.nodes.set(name, { name, fn, metadata });
    return this;
  }

  /**
   * Add an edge from one node to another
   */
  addEdge(from: string, to: string | typeof END): this {
    this.validateNodeExists(from);
    if (to !== END) {
      this.validateNodeExists(to);
    }
    this.edges.push({ from, to });
    return this;
  }

  /**
   * Add a conditional edge based on state
   */
  addConditionalEdges(
    from: string,
    condition: ConditionalEdgeFunction<S>,
    pathMap: Record<string, string | typeof END>
  ): this {
    this.validateNodeExists(from);
    for (const target of Object.values(pathMap)) {
      if (target !== END) {
        this.validateNodeExists(target);
      }
    }
    this.conditionalEdges.push({ from, condition, pathMap });
    return this;
  }

  /**
   * Set the entry point of the graph
   */
  setEntryPoint(nodeName: string): this {
    this.validateNodeExists(nodeName);
    this.entryPoint = nodeName;
    return this;
  }

  /**
   * Set the finish point (adds edge to END)
   */
  setFinishPoint(nodeName: string): this {
    this.validateNodeExists(nodeName);
    this.edges.push({ from: nodeName, to: END });
    return this;
  }

  /**
   * Compile the graph for execution
   */
  compile(): CompiledStateGraph<S> {
    if (!this.entryPoint) {
      throw new OrkaError(
        'Entry point not set. Call setEntryPoint() before compile()',
        OrkaErrorCode.GRAPH_INVALID_CONFIG,
        'StateGraph'
      );
    }

    const nodes = new Map(this.nodes);
    const edges = [...this.edges];
    const conditionalEdges = [...this.conditionalEdges];
    const entryPoint = this.entryPoint;
    const stateAnnotation = this.stateAnnotation;

    const tracer = this.tracer;
    const graphName = this.graphName ?? 'StateGraph';

    return {
      invoke: async (initialState: Partial<S>, config?: StateGraphRunConfig<S>): Promise<StateGraphResult<S>> => {
        return this.executeGraph(
          nodes,
          edges,
          conditionalEdges,
          entryPoint,
          stateAnnotation,
          initialState,
          config,
          tracer,
          graphName
        );
      },

      resume: async (
        checkpointId: string,
        config: StateGraphRunConfig<S> & { checkpointer: NonNullable<StateGraphRunConfig<S>['checkpointer']> }
      ): Promise<StateGraphResult<S>> => {
        const checkpoint = await config.checkpointer.load(checkpointId);
        if (!checkpoint) {
          throw new OrkaError(
            `Checkpoint "${checkpointId}" not found`,
            OrkaErrorCode.NOT_FOUND,
            'StateGraph',
            undefined,
            { checkpointId }
          );
        }
        return this.resumeFromCheckpoint(
          nodes,
          edges,
          conditionalEdges,
          stateAnnotation,
          checkpoint,
          config
        );
      },

      resumeWithState: async (
        checkpointId: string,
        stateUpdate: Partial<S>,
        config: StateGraphRunConfig<S> & { checkpointer: NonNullable<StateGraphRunConfig<S>['checkpointer']> }
      ): Promise<StateGraphResult<S>> => {
        const checkpoint = await config.checkpointer.load(checkpointId);
        if (!checkpoint) {
          throw new OrkaError(
            `Checkpoint "${checkpointId}" not found`,
            OrkaErrorCode.NOT_FOUND,
            'StateGraph',
            undefined,
            { checkpointId }
          );
        }
        const updatedState = this.mergeState(stateAnnotation, checkpoint.state, stateUpdate);
        const updatedCheckpoint: Checkpoint<S> = {
          ...checkpoint,
          state: updatedState,
          status: 'running',
        };
        return this.resumeFromCheckpoint(
          nodes,
          edges,
          conditionalEdges,
          stateAnnotation,
          updatedCheckpoint,
          config
        );
      },

      stream: (initialState: Partial<S>, config?: StateGraphRunConfig<S>): AsyncIterable<StateGraphEvent<S>> => {
        return this.streamGraph(
          nodes,
          edges,
          conditionalEdges,
          entryPoint,
          stateAnnotation,
          initialState,
          config,
          tracer,
          graphName
        );
      },

      toMermaid: (): string => {
        return this.generateMermaid(nodes, edges, conditionalEdges, entryPoint);
      },

      getNodes: (): StateNode<S>[] => {
        return [...nodes.values()];
      },

      getEdges: (): StateEdge[] => {
        return edges;
      },
    };
  }

  private validateNodeExists(name: string): void {
    if (name !== START && name !== END && !this.nodes.has(name)) {
      throw new OrkaError(
        `Node "${name}" does not exist`,
        OrkaErrorCode.GRAPH_INVALID_CONFIG,
        'StateGraph',
        undefined,
        { name }
      );
    }
  }

  private async executeGraph(
    nodes: Map<string, StateNode<S>>,
    edges: StateEdge[],
    conditionalEdges: ConditionalEdge<S>[],
    entryPoint: string,
    stateAnnotation: StateAnnotation<S>,
    initialState: Partial<S>,
    config?: StateGraphRunConfig<S>,
    tracer?: Tracer,
    graphName?: string
  ): Promise<StateGraphResult<S>> {
    const startTime = Date.now();
    const maxIterations = config?.maxIterations ?? 100;
    const threadId = config?.threadId ?? generateId();
    const cb = config?.callbacks;
    const chainRunId = generateId();

    // Start tracer trace if configured
    const trace = tracer?.startTrace(graphName ?? 'StateGraph', {
      threadId,
      initialState,
      entryPoint,
    });

    await cb?.emit({ type: 'chain_start', timestamp: Date.now(), runId: chainRunId, chainName: 'StateGraph', input: JSON.stringify(initialState) });

    let state = this.mergeState(stateAnnotation, stateAnnotation.default(), initialState);
    let currentNode = entryPoint;
    const path: string[] = [];
    const nodeResults: StateNodeResult[] = [];
    let iterations = 0;

    while (currentNode !== END && iterations < maxIterations) {
      iterations++;

      // Check for interrupt before
      if (config?.interrupt?.before?.includes(currentNode)) {
        const checkpoint = await this.createCheckpoint(
          threadId,
          state,
          currentNode,
          path,
          nodeResults,
          'interrupted',
          'before',
          config
        );
        config.onInterrupt?.(checkpoint);
        return {
          state,
          path,
          nodeResults,
          totalLatencyMs: Date.now() - startTime,
          checkpoint,
          interrupted: true,
          metadata: config?.metadata,
        };
      }

      const node = nodes.get(currentNode);
      if (!node) {
        throw new OrkaError(
          `Node "${currentNode}" not found`,
          OrkaErrorCode.GRAPH_NODE_ERROR,
          'StateGraph',
          undefined,
          { nodeId: currentNode }
        );
      }

      path.push(currentNode);
      const nodeStart = Date.now();
      const nodeRunId = generateId();

      await cb?.emit({ type: 'tool_start', timestamp: Date.now(), runId: nodeRunId, parentRunId: chainRunId, toolName: currentNode, input: JSON.stringify(state) });

      try {
        const stateUpdate = await node.fn(state, config ?? {});
        state = this.mergeState(stateAnnotation, state, stateUpdate);
        const nodeLatency = Date.now() - nodeStart;

        nodeResults.push({
          nodeId: currentNode,
          input: { ...state },
          output: stateUpdate as Record<string, unknown>,
          latencyMs: nodeLatency,
          timestamp: Date.now(),
        });

        // Add tracer event for node completion
        if (trace) {
          tracer?.addEvent(trace.id, {
            type: 'graph',
            name: currentNode,
            startTime: nodeStart,
            endTime: Date.now(),
            metadata: { stateUpdate, nodeMetadata: node.metadata },
          });
        }

        await cb?.emit({ type: 'tool_end', timestamp: Date.now(), runId: nodeRunId, parentRunId: chainRunId, toolName: currentNode, input: JSON.stringify(state), output: JSON.stringify(stateUpdate), durationMs: nodeLatency });
        config?.onNodeComplete?.(currentNode, state, stateUpdate);
      } catch (error) {
        // Add tracer error event
        if (trace) {
          tracer?.addEvent(trace.id, {
            type: 'graph',
            name: currentNode,
            startTime: nodeStart,
            endTime: Date.now(),
            error: error instanceof Error ? error.message : String(error),
          });
        }

        await cb?.emit({ type: 'tool_error', timestamp: Date.now(), runId: nodeRunId, parentRunId: chainRunId, toolName: currentNode, input: JSON.stringify(state), error: error instanceof Error ? error : new Error(String(error)) });
        config?.onError?.(error as Error, currentNode);

        if (config?.checkpointer) {
          await this.createCheckpoint(
            threadId,
            state,
            currentNode,
            path,
            nodeResults,
            'error',
            undefined,
            config,
            (error as Error).message
          );
        }

        const nodeErr = new OrkaError(
          `Node "${currentNode}" failed: ${error instanceof Error ? error.message : String(error)}`,
          OrkaErrorCode.GRAPH_NODE_ERROR,
          'StateGraph',
          error instanceof Error ? error : undefined,
          { nodeId: currentNode }
        );
        await cb?.emit({ type: 'chain_error', timestamp: Date.now(), runId: chainRunId, chainName: 'StateGraph', error: nodeErr });
        throw nodeErr;
      }

      // Check for interrupt after
      if (config?.interrupt?.after?.includes(currentNode)) {
        const checkpoint = await this.createCheckpoint(
          threadId,
          state,
          this.getNextNode(currentNode, state, edges, conditionalEdges),
          path,
          nodeResults,
          'interrupted',
          'after',
          config
        );
        config.onInterrupt?.(checkpoint);
        return {
          state,
          path,
          nodeResults,
          totalLatencyMs: Date.now() - startTime,
          checkpoint,
          interrupted: true,
          metadata: config?.metadata,
        };
      }

      // Save checkpoint after each node if checkpointer is configured
      if (config?.checkpointer) {
        await this.createCheckpoint(
          threadId,
          state,
          this.getNextNode(currentNode, state, edges, conditionalEdges),
          path,
          nodeResults,
          'running',
          undefined,
          config
        );
      }

      currentNode = this.getNextNode(currentNode, state, edges, conditionalEdges);
    }

    if (iterations >= maxIterations) {
      const maxErr = new OrkaError(
        `StateGraph exceeded max iterations (${maxIterations})`,
        OrkaErrorCode.GRAPH_MAX_ITERATIONS,
        'StateGraph',
        undefined,
        { maxIterations }
      );
      // End trace with error
      if (trace) {
        tracer?.recordError(maxErr, { path, iterations });
        tracer?.endTrace(trace.id);
      }
      await cb?.emit({ type: 'chain_error', timestamp: Date.now(), runId: chainRunId, chainName: 'StateGraph', error: maxErr });
      throw maxErr;
    }

    // Final checkpoint
    let finalCheckpoint: Checkpoint<S> | undefined;
    if (config?.checkpointer) {
      finalCheckpoint = await this.createCheckpoint(
        threadId,
        state,
        END,
        path,
        nodeResults,
        'completed',
        undefined,
        config
      );
    }

    const totalLatencyMs = Date.now() - startTime;

    // End tracer trace
    if (trace) {
      tracer?.endTrace(trace.id);
    }

    await cb?.emit({ type: 'chain_end', timestamp: Date.now(), runId: chainRunId, chainName: 'StateGraph', output: JSON.stringify(state), durationMs: totalLatencyMs });

    return {
      state,
      path,
      nodeResults,
      totalLatencyMs,
      checkpoint: finalCheckpoint,
      interrupted: false,
      metadata: config?.metadata,
    };
  }

  private async resumeFromCheckpoint(
    nodes: Map<string, StateNode<S>>,
    edges: StateEdge[],
    conditionalEdges: ConditionalEdge<S>[],
    stateAnnotation: StateAnnotation<S>,
    checkpoint: Checkpoint<S>,
    config: StateGraphRunConfig<S>
  ): Promise<StateGraphResult<S>> {
    const startTime = Date.now();
    const maxIterations = config?.maxIterations ?? 100;
    
    let state = checkpoint.state;
    let currentNode = checkpoint.currentNode;
    const path = [...checkpoint.path];
    const nodeResults = [...checkpoint.nodeResults];
    let iterations = 0;

    while (currentNode !== END && iterations < maxIterations) {
      iterations++;

      // Check for interrupt before (skip if we're resuming from this exact interrupt)
      if (config?.interrupt?.before?.includes(currentNode) && checkpoint.status !== 'interrupted') {
        const newCheckpoint = await this.createCheckpoint(
          checkpoint.threadId,
          state,
          currentNode,
          path,
          nodeResults,
          'interrupted',
          'before',
          config,
          undefined,
          checkpoint.id
        );
        config.onInterrupt?.(newCheckpoint);
        return {
          state,
          path,
          nodeResults,
          totalLatencyMs: Date.now() - startTime,
          checkpoint: newCheckpoint,
          interrupted: true,
          metadata: config?.metadata,
        };
      }

      const node = nodes.get(currentNode);
      if (!node) {
        throw new OrkaError(
          `Node "${currentNode}" not found`,
          OrkaErrorCode.GRAPH_NODE_ERROR,
          'StateGraph',
          undefined,
          { nodeId: currentNode }
        );
      }

      path.push(currentNode);
      const nodeStart = Date.now();

      try {
        const stateUpdate = await node.fn(state, config);
        state = this.mergeState(stateAnnotation, state, stateUpdate);

        nodeResults.push({
          nodeId: currentNode,
          input: { ...state },
          output: stateUpdate as Record<string, unknown>,
          latencyMs: Date.now() - nodeStart,
          timestamp: Date.now(),
        });

        config?.onNodeComplete?.(currentNode, state, stateUpdate);
      } catch (error) {
        config?.onError?.(error as Error, currentNode);
        throw new OrkaError(
          `Node "${currentNode}" failed: ${error instanceof Error ? error.message : String(error)}`,
          OrkaErrorCode.GRAPH_NODE_ERROR,
          'StateGraph',
          error instanceof Error ? error : undefined,
          { nodeId: currentNode }
        );
      }

      // Check for interrupt after
      if (config?.interrupt?.after?.includes(currentNode)) {
        const newCheckpoint = await this.createCheckpoint(
          checkpoint.threadId,
          state,
          this.getNextNode(currentNode, state, edges, conditionalEdges),
          path,
          nodeResults,
          'interrupted',
          'after',
          config,
          undefined,
          checkpoint.id
        );
        config.onInterrupt?.(newCheckpoint);
        return {
          state,
          path,
          nodeResults,
          totalLatencyMs: Date.now() - startTime,
          checkpoint: newCheckpoint,
          interrupted: true,
          metadata: config?.metadata,
        };
      }

      // Save checkpoint
      if (config?.checkpointer) {
        await this.createCheckpoint(
          checkpoint.threadId,
          state,
          this.getNextNode(currentNode, state, edges, conditionalEdges),
          path,
          nodeResults,
          'running',
          undefined,
          config,
          undefined,
          checkpoint.id
        );
      }

      currentNode = this.getNextNode(currentNode, state, edges, conditionalEdges);
    }

    if (iterations >= maxIterations) {
      throw new OrkaError(
        `StateGraph exceeded max iterations (${maxIterations})`,
        OrkaErrorCode.GRAPH_MAX_ITERATIONS,
        'StateGraph',
        undefined,
        { maxIterations }
      );
    }

    // Final checkpoint
    let finalCheckpoint: Checkpoint<S> | undefined;
    if (config?.checkpointer) {
      finalCheckpoint = await this.createCheckpoint(
        checkpoint.threadId,
        state,
        END,
        path,
        nodeResults,
        'completed',
        undefined,
        config,
        undefined,
        checkpoint.id
      );
    }

    return {
      state,
      path,
      nodeResults,
      totalLatencyMs: Date.now() - startTime,
      checkpoint: finalCheckpoint,
      interrupted: false,
      metadata: config?.metadata,
    };
  }

  private async *streamGraph(
    nodes: Map<string, StateNode<S>>,
    edges: StateEdge[],
    conditionalEdges: ConditionalEdge<S>[],
    entryPoint: string,
    stateAnnotation: StateAnnotation<S>,
    initialState: Partial<S>,
    config?: StateGraphRunConfig<S>,
    tracer?: Tracer,
    graphName?: string
  ): AsyncIterable<StateGraphEvent<S>> {
    const maxIterations = config?.maxIterations ?? 100;
    const threadId = config?.threadId ?? generateId();

    // Start tracer trace if configured
    const trace = tracer?.startTrace(graphName ?? 'StateGraph:stream', {
      threadId,
      initialState,
      entryPoint,
      streaming: true,
    });
    
    let state = this.mergeState(stateAnnotation, stateAnnotation.default(), initialState);
    let currentNode = entryPoint;
    const path: string[] = [];
    const nodeResults: StateNodeResult[] = [];
    let iterations = 0;

    while (currentNode !== END && iterations < maxIterations) {
      iterations++;

      // Check for interrupt before
      if (config?.interrupt?.before?.includes(currentNode)) {
        const checkpoint = await this.createCheckpoint(
          threadId,
          state,
          currentNode,
          path,
          nodeResults,
          'interrupted',
          'before',
          config
        );
        yield {
          type: 'interrupt',
          nodeId: currentNode,
          state,
          checkpoint,
          timestamp: Date.now(),
        };
        return;
      }

      const node = nodes.get(currentNode);
      if (!node) {
        yield {
          type: 'error',
          nodeId: currentNode,
          error: new OrkaError(
            `Node "${currentNode}" not found`,
            OrkaErrorCode.GRAPH_NODE_ERROR,
            'StateGraph',
            undefined,
            { nodeId: currentNode }
          ),
          timestamp: Date.now(),
        };
        return;
      }

      yield {
        type: 'node_start',
        nodeId: currentNode,
        state,
        timestamp: Date.now(),
      };

      path.push(currentNode);
      const nodeStart = Date.now();

      try {
        const stateUpdate = await node.fn(state, config ?? {});
        state = this.mergeState(stateAnnotation, state, stateUpdate);

        yield {
          type: 'state_update',
          nodeId: currentNode,
          state,
          stateUpdate,
          timestamp: Date.now(),
        };

        nodeResults.push({
          nodeId: currentNode,
          input: { ...state },
          output: stateUpdate as Record<string, unknown>,
          latencyMs: Date.now() - nodeStart,
          timestamp: Date.now(),
        });

        // Add tracer event for node completion
        if (trace) {
          tracer?.addEvent(trace.id, {
            type: 'graph',
            name: currentNode,
            startTime: nodeStart,
            endTime: Date.now(),
            metadata: { stateUpdate },
          });
        }

        yield {
          type: 'node_end',
          nodeId: currentNode,
          state,
          timestamp: Date.now(),
        };

        config?.onNodeComplete?.(currentNode, state, stateUpdate);
      } catch (error) {
        // Add tracer error event
        if (trace) {
          tracer?.addEvent(trace.id, {
            type: 'graph',
            name: currentNode,
            startTime: nodeStart,
            endTime: Date.now(),
            error: error instanceof Error ? error.message : String(error),
          });
          tracer?.endTrace(trace.id);
        }

        yield {
          type: 'error',
          nodeId: currentNode,
          error: error as Error,
          timestamp: Date.now(),
        };
        config?.onError?.(error as Error, currentNode);
        return;
      }

      // Check for interrupt after
      if (config?.interrupt?.after?.includes(currentNode)) {
        const checkpoint = await this.createCheckpoint(
          threadId,
          state,
          this.getNextNode(currentNode, state, edges, conditionalEdges),
          path,
          nodeResults,
          'interrupted',
          'after',
          config
        );
        yield {
          type: 'interrupt',
          nodeId: currentNode,
          state,
          checkpoint,
          timestamp: Date.now(),
        };
        return;
      }

      // Checkpoint event
      if (config?.checkpointer) {
        const checkpoint = await this.createCheckpoint(
          threadId,
          state,
          this.getNextNode(currentNode, state, edges, conditionalEdges),
          path,
          nodeResults,
          'running',
          undefined,
          config
        );
        yield {
          type: 'checkpoint',
          state,
          checkpoint,
          timestamp: Date.now(),
        };
      }

      currentNode = this.getNextNode(currentNode, state, edges, conditionalEdges);
    }

    if (iterations >= maxIterations) {
      const maxErr = new OrkaError(
        `StateGraph exceeded max iterations (${maxIterations})`,
        OrkaErrorCode.GRAPH_MAX_ITERATIONS,
        'StateGraph',
        undefined,
        { maxIterations }
      );
      if (trace) {
        tracer?.recordError(maxErr, { path, iterations });
        tracer?.endTrace(trace.id);
      }
      yield {
        type: 'error',
        error: maxErr,
        timestamp: Date.now(),
      };
      return;
    }

    // End tracer trace
    if (trace) {
      tracer?.endTrace(trace.id);
    }

    yield {
      type: 'done',
      state,
      timestamp: Date.now(),
    };
  }

  private getNextNode(
    currentNode: string,
    state: S,
    edges: StateEdge[],
    conditionalEdges: ConditionalEdge<S>[]
  ): string {
    // Check conditional edges first
    const condEdge = conditionalEdges.find(e => e.from === currentNode);
    if (condEdge) {
      const result = condEdge.condition(state);
      if (result === END) return END;
      const mapped = condEdge.pathMap[result];
      if (mapped) return mapped === END ? END : mapped;
      throw new OrkaError(
        `Conditional edge from "${currentNode}" returned unmapped value: "${result}"`,
        OrkaErrorCode.GRAPH_NODE_ERROR,
        'StateGraph',
        undefined,
        { nodeId: currentNode, returnedValue: result }
      );
    }

    // Check regular edges
    const edge = edges.find(e => e.from === currentNode);
    if (edge) {
      return edge.to === END ? END : edge.to;
    }

    // No outgoing edge means end
    return END;
  }

  private mergeState(
    annotation: StateAnnotation<S>,
    current: S,
    update: Partial<S>
  ): S {
    const result = { ...current };
    
    for (const key of Object.keys(update) as (keyof S)[]) {
      const reducer = annotation.reducers?.[key];
      if (reducer) {
        result[key] = reducer(current[key], update[key] as S[typeof key]);
      } else {
        result[key] = update[key] as S[typeof key];
      }
    }
    
    return result;
  }

  private async createCheckpoint(
    threadId: string,
    state: S,
    currentNode: string,
    path: string[],
    nodeResults: StateNodeResult[],
    status: Checkpoint<S>['status'],
    interruptReason?: 'before' | 'after',
    config?: StateGraphRunConfig<S>,
    error?: string,
    parentId?: string
  ): Promise<Checkpoint<S>> {
    const checkpoint: Checkpoint<S> = {
      id: generateId(),
      threadId,
      state: { ...state },
      currentNode,
      path: [...path],
      nodeResults: [...nodeResults],
      timestamp: Date.now(),
      status,
      interruptReason,
      error,
      parentId,
      metadata: config?.metadata,
    };

    if (config?.checkpointer) {
      await config.checkpointer.save(checkpoint);
    }

    return checkpoint;
  }

  private generateMermaid(
    nodes: Map<string, StateNode<S>>,
    edges: StateEdge[],
    conditionalEdges: ConditionalEdge<S>[],
    entryPoint: string
  ): string {
    let mermaid = 'graph TD\n';
    
    // Add START node
    mermaid += `  ${START}((START))\n`;
    mermaid += `  ${START} --> ${entryPoint}\n`;
    
    // Add nodes
    for (const [name] of nodes) {
      mermaid += `  ${name}[${name}]\n`;
    }
    
    // Add END node
    mermaid += `  ${END}((END))\n`;
    
    // Add regular edges
    for (const edge of edges) {
      const to = edge.to === END ? END : edge.to;
      mermaid += `  ${edge.from} --> ${to}\n`;
    }
    
    // Add conditional edges
    for (const condEdge of conditionalEdges) {
      for (const [label, target] of Object.entries(condEdge.pathMap)) {
        const to = target === END ? END : target;
        mermaid += `  ${condEdge.from} -->|${label}| ${to}\n`;
      }
    }
    
    return mermaid;
  }
}

/**
 * Helper to create a state annotation
 */
export function createStateAnnotation<S extends BaseState>(
  defaultFn: () => S,
  reducers?: StateAnnotation<S>['reducers']
): StateAnnotation<S> {
  return {
    default: defaultFn,
    reducers,
  };
}

/**
 * Common reducers
 */
export const Reducers = {
  /**
   * Append to array
   */
  appendList: <T>(current: T[], update: T[]): T[] => [...current, ...update],
  
  /**
   * Prepend to array
   */
  prependList: <T>(current: T[], update: T[]): T[] => [...update, ...current],
  
  /**
   * Merge objects
   */
  mergeObject: <T extends Record<string, unknown>>(current: T, update: T): T => ({ ...current, ...update }),
  
  /**
   * Add to set (deduplicate)
   */
  addToSet: <T>(current: T[], update: T[]): T[] => [...new Set([...current, ...update])],
  
  /**
   * Keep last N items
   */
  keepLastN: <T>(n: number) => (current: T[], update: T[]): T[] => {
    const combined = [...current, ...update];
    return combined.slice(-n);
  },
  
  /**
   * Increment counter
   */
  increment: (current: number, update: number): number => current + update,
  
  /**
   * Maximum value
   */
  max: (current: number, update: number): number => Math.max(current, update),
  
  /**
   * Minimum value
   */
  min: (current: number, update: number): number => Math.min(current, update),
};
