import { describe, it, expect, beforeEach } from 'vitest';
import { TraceCollector, resetCollector, getCollector } from '../../../packages/devtools/src/index.js';
import type { TraceEvent } from '../../../packages/devtools/src/index.js';

describe('TraceCollector', () => {
  let collector: TraceCollector;

  beforeEach(() => {
    resetCollector();
    collector = new TraceCollector();
  });

  describe('sessions', () => {
    it('should start a new session', () => {
      const sessionId = collector.startSession('Test Session');
      expect(sessionId).toBeDefined();
      expect(typeof sessionId).toBe('string');

      const session = collector.getSession(sessionId);
      expect(session).toBeDefined();
      expect(session?.name).toBe('Test Session');
      expect(session?.runs).toEqual([]);
    });

    it('should end a session', () => {
      const sessionId = collector.startSession();
      collector.endSession(sessionId);

      const session = collector.getSession(sessionId);
      expect(session?.endTime).toBeDefined();
    });

    it('should get all sessions', () => {
      collector.startSession('Session 1');
      collector.startSession('Session 2');

      const sessions = collector.getSessions();
      expect(sessions).toHaveLength(2);
    });
  });

  describe('runs', () => {
    it('should start a run within a session', () => {
      collector.startSession();
      const runId = collector.startRun('llm', 'generate', { prompt: 'test' });

      expect(runId).toBeDefined();
      const sessions = collector.getSessions();
      expect(sessions[0].runs).toHaveLength(1);
      expect(sessions[0].runs[0].type).toBe('llm');
      expect(sessions[0].runs[0].name).toBe('generate');
      expect(sessions[0].runs[0].status).toBe('running');
    });

    it('should end a run with output', () => {
      collector.startSession();
      const runId = collector.startRun('llm', 'generate');
      collector.endRun(runId, { content: 'response' }, { totalTokens: 100 });

      const sessions = collector.getSessions();
      const run = sessions[0].runs[0];
      expect(run.status).toBe('success');
      expect(run.output).toEqual({ content: 'response' });
      expect(run.metadata?.totalTokens).toBe(100);
      expect(run.latencyMs).toBeDefined();
    });

    it('should mark a run as errored', () => {
      collector.startSession();
      const runId = collector.startRun('tool', 'search');
      collector.errorRun(runId, new Error('Tool failed'));

      const sessions = collector.getSessions();
      const run = sessions[0].runs[0];
      expect(run.status).toBe('error');
      expect(run.error).toBe('Tool failed');
    });

    it('should nest child runs', () => {
      collector.startSession();
      const parentId = collector.startRun('agent', 'process');
      const childId = collector.startRun('llm', 'generate');
      collector.endRun(childId, 'result');
      collector.endRun(parentId, 'done');

      const sessions = collector.getSessions();
      const parentRun = sessions[0].runs[0];
      expect(parentRun.children).toHaveLength(1);
      expect(parentRun.children[0].type).toBe('llm');
    });
  });

  describe('metrics', () => {
    it('should calculate metrics for a session', () => {
      collector.startSession();
      
      const run1 = collector.startRun('llm', 'call1', null, { totalTokens: 50, cost: 0.001 });
      collector.endRun(run1);
      
      const run2 = collector.startRun('llm', 'call2', null, { totalTokens: 100, cost: 0.002 });
      collector.endRun(run2);

      const metrics = collector.getMetrics();
      expect(metrics.totalRuns).toBe(2);
      expect(metrics.totalTokens).toBe(150);
      expect(metrics.totalCost).toBe(0.003);
      expect(metrics.runsByType.llm).toBe(2);
    });

    it('should calculate error rate', () => {
      collector.startSession();
      
      const run1 = collector.startRun('tool', 'success');
      collector.endRun(run1);
      
      const run2 = collector.startRun('tool', 'fail');
      collector.errorRun(run2, 'error');

      const metrics = collector.getMetrics();
      expect(metrics.errorRate).toBe(0.5);
    });
  });

  describe('findRun', () => {
    it('should find a run by ID', () => {
      collector.startSession();
      const runId = collector.startRun('agent', 'test');
      collector.endRun(runId);

      const found = collector.findRun(runId);
      expect(found).toBeDefined();
      expect(found?.id).toBe(runId);
    });

    it('should find nested runs', () => {
      collector.startSession();
      collector.startRun('agent', 'parent');
      const childId = collector.startRun('llm', 'child');
      collector.endRun(childId);

      const found = collector.findRun(childId);
      expect(found).toBeDefined();
      expect(found?.name).toBe('child');
    });
  });

  describe('export/import', () => {
    it('should export traces as JSON', () => {
      collector.startSession('Export Test');
      const runId = collector.startRun('llm', 'test');
      collector.endRun(runId, 'result');

      const json = collector.export();
      const data = JSON.parse(json);
      
      expect(data.sessions).toHaveLength(1);
      expect(data.sessions[0].name).toBe('Export Test');
      expect(data.exportedAt).toBeDefined();
    });

    it('should import traces from JSON', () => {
      const json = JSON.stringify({
        sessions: [{
          id: 'imported-session',
          name: 'Imported',
          startTime: Date.now(),
          runs: []
        }]
      });

      collector.import(json);
      const session = collector.getSession('imported-session');
      expect(session).toBeDefined();
      expect(session?.name).toBe('Imported');
    });
  });

  describe('event subscription', () => {
    it('should emit events on run start', () => {
      const events: TraceEvent[] = [];
      collector.subscribe((event: TraceEvent) => events.push(event));

      collector.startSession();
      collector.startRun('llm', 'test');

      expect(events.some((e) => e.type === 'session:start')).toBe(true);
      expect(events.some((e) => e.type === 'run:start')).toBe(true);
    });

    it('should emit events on run end', () => {
      const events: TraceEvent[] = [];
      collector.subscribe((event: TraceEvent) => events.push(event));

      collector.startSession();
      const runId = collector.startRun('llm', 'test');
      collector.endRun(runId);

      expect(events.some((e) => e.type === 'run:end')).toBe(true);
    });

    it('should allow unsubscribing', () => {
      const events: TraceEvent[] = [];
      const unsubscribe = collector.subscribe((event: TraceEvent) => events.push(event));

      collector.startSession();
      unsubscribe();
      collector.startRun('llm', 'test');

      // Only session:start should be captured
      expect(events).toHaveLength(1);
    });
  });

  describe('cleanup', () => {
    it('should clear all traces', () => {
      collector.startSession();
      collector.startRun('llm', 'test');

      collector.clear();

      expect(collector.getSessions()).toHaveLength(0);
    });
  });

  describe('getCollector singleton', () => {
    it('should return the same instance', () => {
      resetCollector();
      const c1 = getCollector();
      const c2 = getCollector();
      expect(c1).toBe(c2);
    });
  });
});
