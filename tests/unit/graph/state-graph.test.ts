import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  StateGraph,
  createStateAnnotation,
  Reducers,
  GraphCheckpointStore,
  START,
  END,
  type BaseState,
} from '@orka-js/graph';

interface TestState extends BaseState {
  messages: string[];
  count: number;
  result: string;
}

const testAnnotation = createStateAnnotation<TestState>(
  () => ({
    messages: [],
    count: 0,
    result: '',
  })
);

describe('StateGraph', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Basic Graph Construction', () => {
    it('should create a simple graph', () => {
      const graph = new StateGraph<TestState>({
        stateAnnotation: testAnnotation,
      });

      graph
        .addNode('node1', async () => ({ result: 'done' }))
        .setEntryPoint('node1')
        .setFinishPoint('node1');

      const compiled = graph.compile();
      expect(compiled).toBeDefined();
      expect(compiled.getNodes()).toHaveLength(1);
    });

    it('should throw error for reserved node names', () => {
      const graph = new StateGraph<TestState>({
        stateAnnotation: testAnnotation,
      });

      expect(() => graph.addNode(START, async () => ({}))).toThrow();
      expect(() => graph.addNode(END, async () => ({}))).toThrow();
    });

    it('should throw error for duplicate node names', () => {
      const graph = new StateGraph<TestState>({
        stateAnnotation: testAnnotation,
      });

      graph.addNode('node1', async () => ({}));
      expect(() => graph.addNode('node1', async () => ({}))).toThrow();
    });

    it('should throw error when compiling without entry point', () => {
      const graph = new StateGraph<TestState>({
        stateAnnotation: testAnnotation,
      });

      graph.addNode('node1', async () => ({}));
      expect(() => graph.compile()).toThrow('Entry point not set');
    });
  });

  describe('Graph Execution', () => {
    it('should execute a simple linear graph', async () => {
      const graph = new StateGraph<TestState>({
        stateAnnotation: testAnnotation,
      });

      graph
        .addNode('step1', async () => ({
          messages: ['Step 1 executed'],
          count: 1,
        }))
        .addNode('step2', async () => ({
          result: 'completed',
        }))
        .setEntryPoint('step1')
        .addEdge('step1', 'step2')
        .setFinishPoint('step2');

      const compiled = graph.compile();
      const result = await compiled.invoke({});

      expect(result.state.messages).toEqual(['Step 1 executed']);
      expect(result.state.count).toBe(1);
      expect(result.state.result).toBe('completed');
      expect(result.path).toEqual(['step1', 'step2']);
      expect(result.interrupted).toBe(false);
    });

    it('should replace state without reducers', async () => {
      const graph = new StateGraph<TestState>({
        stateAnnotation: testAnnotation,
      });

      graph
        .addNode('add1', async () => ({ messages: ['msg1'], count: 5 }))
        .addNode('add2', async () => ({ messages: ['msg2'], count: 3 }))
        .setEntryPoint('add1')
        .addEdge('add1', 'add2')
        .setFinishPoint('add2');

      const compiled = graph.compile();
      const result = await compiled.invoke({ count: 10 });

      // Without reducers, values are replaced
      expect(result.state.messages).toEqual(['msg2']);
      expect(result.state.count).toBe(3);
    });

    it('should pass initial state correctly', async () => {
      const graph = new StateGraph<TestState>({
        stateAnnotation: testAnnotation,
      });

      graph
        .addNode('check', async (state) => ({
          result: `Count was ${state.count}`,
        }))
        .setEntryPoint('check')
        .setFinishPoint('check');

      const compiled = graph.compile();
      const result = await compiled.invoke({ count: 42 });

      expect(result.state.result).toBe('Count was 42');
    });
  });

  describe('Conditional Edges', () => {
    it('should follow conditional edges based on state', async () => {
      const graph = new StateGraph<TestState>({
        stateAnnotation: testAnnotation,
      });

      graph
        .addNode('router', async (state) => ({
          count: state.count > 5 ? 1 : 0,
        }))
        .addNode('high', async () => ({ result: 'high path' }))
        .addNode('low', async () => ({ result: 'low path' }))
        .setEntryPoint('router')
        .addConditionalEdges(
          'router',
          (state) => (state.count > 0 ? 'high' : 'low'),
          { high: 'high', low: 'low' }
        )
        .setFinishPoint('high')
        .setFinishPoint('low');

      const compiled = graph.compile();

      const highResult = await compiled.invoke({ count: 10 });
      expect(highResult.state.result).toBe('high path');
      expect(highResult.path).toContain('high');

      const lowResult = await compiled.invoke({ count: 3 });
      expect(lowResult.state.result).toBe('low path');
      expect(lowResult.path).toContain('low');
    });

    it('should support END as conditional target', async () => {
      const graph = new StateGraph<TestState>({
        stateAnnotation: testAnnotation,
      });

      graph
        .addNode('check', async () => ({}))
        .setEntryPoint('check')
        .addConditionalEdges(
          'check',
          (state) => (state.count > 5 ? 'continue' : END),
          { continue: 'check' }
        );

      const compiled = graph.compile();
      const result = await compiled.invoke({ count: 3 });

      expect(result.path).toEqual(['check']);
      expect(result.interrupted).toBe(false);
    });
  });

  describe('Interrupts', () => {
    it('should interrupt before specified node', async () => {
      const graph = new StateGraph<TestState>({
        stateAnnotation: testAnnotation,
      });

      graph
        .addNode('step1', async () => ({ messages: ['step1'] }))
        .addNode('human_review', async () => ({ messages: ['reviewed'] }))
        .addNode('step3', async () => ({ result: 'done' }))
        .setEntryPoint('step1')
        .addEdge('step1', 'human_review')
        .addEdge('human_review', 'step3')
        .setFinishPoint('step3');

      const compiled = graph.compile();
      const checkpointer = new GraphCheckpointStore<TestState>();

      const result = await compiled.invoke({}, {
        checkpointer,
        threadId: 'test-thread',
        interrupt: { before: ['human_review'] },
      });

      expect(result.interrupted).toBe(true);
      expect(result.checkpoint).toBeDefined();
      expect(result.checkpoint?.currentNode).toBe('human_review');
      expect(result.checkpoint?.status).toBe('interrupted');
      expect(result.checkpoint?.interruptReason).toBe('before');
      expect(result.state.messages).toEqual(['step1']);
    });

    it('should interrupt after specified node', async () => {
      const graph = new StateGraph<TestState>({
        stateAnnotation: testAnnotation,
      });

      graph
        .addNode('step1', async () => ({ messages: ['step1'] }))
        .addNode('human_review', async () => ({ messages: ['reviewed'] }))
        .addNode('step3', async () => ({ result: 'done' }))
        .setEntryPoint('step1')
        .addEdge('step1', 'human_review')
        .addEdge('human_review', 'step3')
        .setFinishPoint('step3');

      const compiled = graph.compile();
      const checkpointer = new GraphCheckpointStore<TestState>();

      const result = await compiled.invoke({}, {
        checkpointer,
        threadId: 'test-thread',
        interrupt: { after: ['human_review'] },
      });

      expect(result.interrupted).toBe(true);
      expect(result.checkpoint?.interruptReason).toBe('after');
      // Without reducers, only last message is kept
      expect(result.state.messages).toEqual(['reviewed']);
    });

    it('should call onInterrupt callback', async () => {
      const onInterrupt = vi.fn();

      const graph = new StateGraph<TestState>({
        stateAnnotation: testAnnotation,
      });

      graph
        .addNode('step1', async () => ({ result: 'step1' }))
        .setEntryPoint('step1')
        .setFinishPoint('step1');

      const compiled = graph.compile();
      const checkpointer = new GraphCheckpointStore<TestState>();

      await compiled.invoke({}, {
        checkpointer,
        interrupt: { before: ['step1'] },
        onInterrupt,
      });

      expect(onInterrupt).toHaveBeenCalledTimes(1);
      expect(onInterrupt.mock.calls[0][0].status).toBe('interrupted');
    });
  });

  describe('Checkpointing and Resume', () => {
    it('should save checkpoints during execution', async () => {
      const graph = new StateGraph<TestState>({
        stateAnnotation: testAnnotation,
      });

      graph
        .addNode('step1', async () => ({ messages: ['step1'] }))
        .addNode('step2', async () => ({ messages: ['step2'] }))
        .setEntryPoint('step1')
        .addEdge('step1', 'step2')
        .setFinishPoint('step2');

      const compiled = graph.compile();
      const checkpointer = new GraphCheckpointStore<TestState>();

      await compiled.invoke({}, {
        checkpointer,
        threadId: 'test-thread',
      });

      const checkpoints = await checkpointer.list('test-thread');
      expect(checkpoints.length).toBeGreaterThan(0);
    });

    it('should resume from checkpoint', async () => {
      const graph = new StateGraph<TestState>({
        stateAnnotation: testAnnotation,
      });

      graph
        .addNode('step1', async () => ({ messages: ['step1'], count: 1 }))
        .addNode('step2', async () => ({ messages: ['step2'], count: 1 }))
        .addNode('step3', async () => ({ messages: ['step3'], result: 'done', count: 1 }))
        .setEntryPoint('step1')
        .addEdge('step1', 'step2')
        .addEdge('step2', 'step3')
        .setFinishPoint('step3');

      const compiled = graph.compile();
      const checkpointer = new GraphCheckpointStore<TestState>();

      // First run - interrupt before step2
      const firstResult = await compiled.invoke({}, {
        checkpointer,
        threadId: 'resume-test',
        interrupt: { before: ['step2'] },
      });

      expect(firstResult.interrupted).toBe(true);
      expect(firstResult.checkpoint).toBeDefined();

      // Resume from checkpoint
      const resumeResult = await compiled.resume(
        firstResult.checkpoint!.id,
        { checkpointer, threadId: 'resume-test' }
      );

      expect(resumeResult.interrupted).toBe(false);
      expect(resumeResult.state.result).toBe('done');
      // Without reducers, only last message is kept
      expect(resumeResult.state.messages).toEqual(['step3']);
    });

    it('should resume with updated state (human-in-the-loop)', async () => {
      const graph = new StateGraph<TestState>({
        stateAnnotation: testAnnotation,
      });

      graph
        .addNode('get_input', async () => ({ messages: ['waiting for input'] }))
        .addNode('process', async (state) => ({
          result: `Processed: ${state.result}`,
        }))
        .setEntryPoint('get_input')
        .addEdge('get_input', 'process')
        .setFinishPoint('process');

      const compiled = graph.compile();
      const checkpointer = new GraphCheckpointStore<TestState>();

      // First run - interrupt after get_input
      const firstResult = await compiled.invoke({}, {
        checkpointer,
        threadId: 'hitl-test',
        interrupt: { after: ['get_input'] },
      });

      expect(firstResult.interrupted).toBe(true);

      // Human provides input and resumes
      const resumeResult = await compiled.resumeWithState(
        firstResult.checkpoint!.id,
        { result: 'human input' },
        { checkpointer, threadId: 'hitl-test' }
      );

      expect(resumeResult.state.result).toBe('Processed: human input');
    });
  });

  describe('Streaming', () => {
    it('should stream execution events', async () => {
      const graph = new StateGraph<TestState>({
        stateAnnotation: testAnnotation,
      });

      graph
        .addNode('step1', async () => ({ messages: ['step1'] }))
        .addNode('step2', async () => ({ result: 'done' }))
        .setEntryPoint('step1')
        .addEdge('step1', 'step2')
        .setFinishPoint('step2');

      const compiled = graph.compile();
      const events: string[] = [];

      for await (const event of compiled.stream({})) {
        events.push(event.type);
      }

      expect(events).toContain('node_start');
      expect(events).toContain('node_end');
      expect(events).toContain('state_update');
      expect(events).toContain('done');
    });

    it('should emit interrupt event when interrupted', async () => {
      const graph = new StateGraph<TestState>({
        stateAnnotation: testAnnotation,
      });

      graph
        .addNode('step1', async () => ({ result: 'step1' }))
        .setEntryPoint('step1')
        .setFinishPoint('step1');

      const compiled = graph.compile();
      const checkpointer = new GraphCheckpointStore<TestState>();
      const events: string[] = [];

      for await (const event of compiled.stream({}, {
        checkpointer,
        interrupt: { before: ['step1'] },
      })) {
        events.push(event.type);
      }

      expect(events).toContain('interrupt');
      expect(events).not.toContain('done');
    });
  });

  describe('Mermaid Export', () => {
    it('should generate valid Mermaid diagram', () => {
      const graph = new StateGraph<TestState>({
        stateAnnotation: testAnnotation,
      });

      graph
        .addNode('start_node', async () => ({}))
        .addNode('process', async () => ({}))
        .addNode('end_node', async () => ({}))
        .setEntryPoint('start_node')
        .addEdge('start_node', 'process')
        .addEdge('process', 'end_node')
        .setFinishPoint('end_node');

      const compiled = graph.compile();
      const mermaid = compiled.toMermaid();

      expect(mermaid).toContain('graph TD');
      expect(mermaid).toContain('__start__');
      expect(mermaid).toContain('__end__');
      expect(mermaid).toContain('start_node');
      expect(mermaid).toContain('process');
      expect(mermaid).toContain('end_node');
    });

    it('should include conditional edges in Mermaid', () => {
      const graph = new StateGraph<TestState>({
        stateAnnotation: testAnnotation,
      });

      graph
        .addNode('router', async () => ({}))
        .addNode('pathA', async () => ({}))
        .addNode('pathB', async () => ({}))
        .setEntryPoint('router')
        .addConditionalEdges(
          'router',
          (state) => state.count > 5 ? 'a' : 'b',
          { a: 'pathA', b: 'pathB' }
        )
        .setFinishPoint('pathA')
        .setFinishPoint('pathB');

      const compiled = graph.compile();
      const mermaid = compiled.toMermaid();

      expect(mermaid).toContain('|a|');
      expect(mermaid).toContain('|b|');
    });
  });

  describe('Error Handling', () => {
    it('should call onError callback on node failure', async () => {
      const onError = vi.fn();

      const graph = new StateGraph<TestState>({
        stateAnnotation: testAnnotation,
      });

      graph
        .addNode('failing_node', async () => {
          throw new Error('Node failed');
        })
        .setEntryPoint('failing_node')
        .setFinishPoint('failing_node');

      const compiled = graph.compile();

      await expect(compiled.invoke({}, { onError })).rejects.toThrow('Node failed');
      expect(onError).toHaveBeenCalledTimes(1);
    });

    it('should prevent infinite loops with maxIterations', async () => {
      const graph = new StateGraph<TestState>({
        stateAnnotation: testAnnotation,
      });

      graph
        .addNode('loop', async () => ({ count: 1 }))
        .setEntryPoint('loop')
        .addEdge('loop', 'loop'); // Infinite loop

      const compiled = graph.compile();

      await expect(compiled.invoke({}, { maxIterations: 5 }))
        .rejects.toThrow('exceeded max iterations');
    });
  });
});

describe('GraphCheckpointStore', () => {
  it('should save and load checkpoints', async () => {
    const store = new GraphCheckpointStore<TestState>();
    
    const checkpoint = {
      id: 'cp-1',
      threadId: 'thread-1',
      state: { messages: [], count: 0, result: '' },
      currentNode: 'node1',
      path: ['node1'],
      nodeResults: [],
      timestamp: Date.now(),
      status: 'running' as const,
    };

    await store.save(checkpoint);
    const loaded = await store.load('cp-1');

    expect(loaded).toEqual(checkpoint);
  });

  it('should load latest checkpoint for thread', async () => {
    const store = new GraphCheckpointStore<TestState>();
    
    await store.save({
      id: 'cp-1',
      threadId: 'thread-1',
      state: { messages: [], count: 1, result: '' },
      currentNode: 'node1',
      path: [],
      nodeResults: [],
      timestamp: 1000,
      status: 'running',
    });

    await store.save({
      id: 'cp-2',
      threadId: 'thread-1',
      state: { messages: [], count: 2, result: '' },
      currentNode: 'node2',
      path: [],
      nodeResults: [],
      timestamp: 2000,
      status: 'running',
    });

    const latest = await store.loadLatest('thread-1');
    expect(latest?.id).toBe('cp-2');
    expect(latest?.state.count).toBe(2);
  });

  it('should list all checkpoints for thread', async () => {
    const store = new GraphCheckpointStore<TestState>();
    
    await store.save({
      id: 'cp-1',
      threadId: 'thread-1',
      state: { messages: [], count: 0, result: '' },
      currentNode: 'node1',
      path: [],
      nodeResults: [],
      timestamp: 1000,
      status: 'running',
    });

    await store.save({
      id: 'cp-2',
      threadId: 'thread-1',
      state: { messages: [], count: 0, result: '' },
      currentNode: 'node2',
      path: [],
      nodeResults: [],
      timestamp: 2000,
      status: 'running',
    });

    const list = await store.list('thread-1');
    expect(list).toHaveLength(2);
  });

  it('should delete checkpoint', async () => {
    const store = new GraphCheckpointStore<TestState>();
    
    await store.save({
      id: 'cp-1',
      threadId: 'thread-1',
      state: { messages: [], count: 0, result: '' },
      currentNode: 'node1',
      path: [],
      nodeResults: [],
      timestamp: Date.now(),
      status: 'running',
    });

    await store.delete('cp-1');
    const loaded = await store.load('cp-1');

    expect(loaded).toBeNull();
  });

  it('should delete all checkpoints for thread', async () => {
    const store = new GraphCheckpointStore<TestState>();
    
    await store.save({
      id: 'cp-1',
      threadId: 'thread-1',
      state: { messages: [], count: 0, result: '' },
      currentNode: 'node1',
      path: [],
      nodeResults: [],
      timestamp: Date.now(),
      status: 'running',
    });

    await store.save({
      id: 'cp-2',
      threadId: 'thread-1',
      state: { messages: [], count: 0, result: '' },
      currentNode: 'node2',
      path: [],
      nodeResults: [],
      timestamp: Date.now(),
      status: 'running',
    });

    await store.deleteThread('thread-1');
    const list = await store.list('thread-1');

    expect(list).toHaveLength(0);
  });
});

describe('Reducers', () => {
  it('appendList should append arrays', () => {
    const result = Reducers.appendList([1, 2], [3, 4]);
    expect(result).toEqual([1, 2, 3, 4]);
  });

  it('prependList should prepend arrays', () => {
    const result = Reducers.prependList([1, 2], [3, 4]);
    expect(result).toEqual([3, 4, 1, 2]);
  });

  it('mergeObject should merge objects', () => {
    const result = Reducers.mergeObject({ a: 1, b: 2 }, { b: 3, c: 4 });
    expect(result).toEqual({ a: 1, b: 3, c: 4 });
  });

  it('addToSet should deduplicate', () => {
    const result = Reducers.addToSet([1, 2, 3], [2, 3, 4]);
    expect(result).toEqual([1, 2, 3, 4]);
  });

  it('keepLastN should keep last N items', () => {
    const keepLast3 = Reducers.keepLastN(3);
    const result = keepLast3([1, 2], [3, 4, 5]);
    expect(result).toEqual([3, 4, 5]);
  });

  it('increment should add numbers', () => {
    const result = Reducers.increment(5, 3);
    expect(result).toBe(8);
  });

  it('max should return maximum', () => {
    expect(Reducers.max(5, 3)).toBe(5);
    expect(Reducers.max(3, 5)).toBe(5);
  });

  it('min should return minimum', () => {
    expect(Reducers.min(5, 3)).toBe(3);
    expect(Reducers.min(3, 5)).toBe(3);
  });
});
