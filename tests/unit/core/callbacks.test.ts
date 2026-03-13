import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  CallbackManager,
  createCallbackHandler,
  getCallbackManager,
  setCallbackManager,
  resetCallbackManager,
  consoleCallbackHandler,
  type CallbackHandler,
  type TokenCallbackEvent,
  type ToolStartEvent,
} from '@orka-js/core';

describe('CallbackManager', () => {
  let manager: CallbackManager;

  beforeEach(() => {
    manager = new CallbackManager();
    resetCallbackManager();
  });

  describe('handler management', () => {
    it('should add handlers', () => {
      const handler: CallbackHandler = {
        name: 'test',
        handleEvent: vi.fn(),
      };

      manager.addHandler(handler);
      expect(manager.getHandlers()).toHaveLength(1);
      expect(manager.getHandlers()[0].name).toBe('test');
    });

    it('should remove handlers by name', () => {
      const handler1: CallbackHandler = { name: 'handler1', handleEvent: vi.fn() };
      const handler2: CallbackHandler = { name: 'handler2', handleEvent: vi.fn() };

      manager.addHandler(handler1).addHandler(handler2);
      expect(manager.getHandlers()).toHaveLength(2);

      manager.removeHandler('handler1');
      expect(manager.getHandlers()).toHaveLength(1);
      expect(manager.getHandlers()[0].name).toBe('handler2');
    });

    it('should clear all handlers', () => {
      manager.addHandler({ name: 'h1', handleEvent: vi.fn() });
      manager.addHandler({ name: 'h2', handleEvent: vi.fn() });

      manager.clearHandlers();
      expect(manager.getHandlers()).toHaveLength(0);
    });

    it('should create child manager with inherited handlers', () => {
      const handler: CallbackHandler = { name: 'parent', handleEvent: vi.fn() };
      manager.addHandler(handler);

      const child = manager.createChild();
      expect(child.getHandlers()).toHaveLength(1);
      expect(child.getHandlers()[0].name).toBe('parent');

      // Child modifications don't affect parent
      child.addHandler({ name: 'child', handleEvent: vi.fn() });
      expect(child.getHandlers()).toHaveLength(2);
      expect(manager.getHandlers()).toHaveLength(1);
    });
  });

  describe('event emission', () => {
    it('should emit events to all handlers', async () => {
      const handler1 = vi.fn();
      const handler2 = vi.fn();

      manager.addHandler({ name: 'h1', handleEvent: handler1 });
      manager.addHandler({ name: 'h2', handleEvent: handler2 });

      const event: TokenCallbackEvent = {
        type: 'token',
        timestamp: Date.now(),
        runId: 'test-run',
        token: 'hello',
        index: 0,
        content: 'hello',
      };

      await manager.emit(event);

      expect(handler1).toHaveBeenCalledWith(event);
      expect(handler2).toHaveBeenCalledWith(event);
    });

    it('should filter events by eventTypes', async () => {
      const tokenHandler = vi.fn();
      const toolHandler = vi.fn();

      manager.addHandler({
        name: 'token-only',
        eventTypes: ['token', 'token_start', 'token_end'],
        handleEvent: tokenHandler,
      });

      manager.addHandler({
        name: 'tool-only',
        eventTypes: ['tool_start', 'tool_end'],
        handleEvent: toolHandler,
      });

      const tokenEvent: TokenCallbackEvent = {
        type: 'token',
        timestamp: Date.now(),
        runId: 'test',
        token: 'x',
        index: 0,
        content: 'x',
      };

      const toolEvent: ToolStartEvent = {
        type: 'tool_start',
        timestamp: Date.now(),
        runId: 'test',
        toolName: 'search',
        input: { query: 'test' },
      };

      await manager.emit(tokenEvent);
      await manager.emit(toolEvent);

      expect(tokenHandler).toHaveBeenCalledTimes(1);
      expect(tokenHandler).toHaveBeenCalledWith(tokenEvent);

      expect(toolHandler).toHaveBeenCalledTimes(1);
      expect(toolHandler).toHaveBeenCalledWith(toolEvent);
    });

    it('should handle async handlers', async () => {
      const results: string[] = [];

      manager.addHandler({
        name: 'async',
        async handleEvent() {
          await new Promise(resolve => setTimeout(resolve, 10));
          results.push('async');
        },
      });

      manager.addHandler({
        name: 'sync',
        handleEvent() {
          results.push('sync');
        },
      });

      await manager.emit({
        type: 'token',
        timestamp: Date.now(),
        runId: 'test',
        token: 'x',
        index: 0,
        content: 'x',
      });

      // In async mode, both should be called
      expect(results).toContain('sync');
    });

    it('should catch handler errors without throwing', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      manager.addHandler({
        name: 'error-handler',
        handleEvent() {
          throw new Error('Handler error');
        },
      });

      // Should not throw
      await expect(
        manager.emit({
          type: 'token',
          timestamp: Date.now(),
          runId: 'test',
          token: 'x',
          index: 0,
          content: 'x',
        })
      ).resolves.toBeUndefined();

      consoleSpy.mockRestore();
    });
  });

  describe('convenience emit methods', () => {
    it('should emit token start event', async () => {
      const handler = vi.fn();
      manager.addHandler({ name: 'test', handleEvent: handler });

      const runId = await manager.emitTokenStart('Hello', { model: 'gpt-4' });

      expect(runId).toMatch(/^run_/);
      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'token_start',
          prompt: 'Hello',
          model: 'gpt-4',
        })
      );
    });

    it('should emit token event', async () => {
      const handler = vi.fn();
      manager.addHandler({ name: 'test', handleEvent: handler });

      await manager.emitToken('run-1', 'hello', 0, 'hello');

      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'token',
          runId: 'run-1',
          token: 'hello',
          index: 0,
          content: 'hello',
        })
      );
    });

    it('should emit token end event', async () => {
      const handler = vi.fn();
      manager.addHandler({ name: 'test', handleEvent: handler });

      await manager.emitTokenEnd('run-1', 'hello world', 2, 100, {
        usage: { promptTokens: 10, completionTokens: 2, totalTokens: 12 },
      });

      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'token_end',
          runId: 'run-1',
          content: 'hello world',
          tokenCount: 2,
          durationMs: 100,
          usage: { promptTokens: 10, completionTokens: 2, totalTokens: 12 },
        })
      );
    });

    it('should emit tool start/end events', async () => {
      const handler = vi.fn();
      manager.addHandler({ name: 'test', handleEvent: handler });

      const runId = await manager.emitToolStart('search', { query: 'test' });
      await manager.emitToolEnd(runId, 'search', { query: 'test' }, { results: [] }, 50);

      expect(handler).toHaveBeenCalledTimes(2);
      expect(handler).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({
          type: 'tool_start',
          toolName: 'search',
          input: { query: 'test' },
        })
      );
      expect(handler).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({
          type: 'tool_end',
          toolName: 'search',
          output: { results: [] },
          durationMs: 50,
        })
      );
    });

    it('should emit agent action/finish events', async () => {
      const handler = vi.fn();
      manager.addHandler({ name: 'test', handleEvent: handler });

      const runId = await manager.emitAgentAction('search', { query: 'test' }, { thought: 'I need to search' });
      await manager.emitAgentFinish(runId, { answer: 'Found it' }, 200);

      expect(handler).toHaveBeenCalledTimes(2);
      expect(handler).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({
          type: 'agent_action',
          action: 'search',
          thought: 'I need to search',
        })
      );
      expect(handler).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({
          type: 'agent_finish',
          output: { answer: 'Found it' },
          durationMs: 200,
        })
      );
    });

    it('should emit LLM start/end events', async () => {
      const handler = vi.fn();
      manager.addHandler({ name: 'test', handleEvent: handler });

      const runId = await manager.emitLLMStart('Hello', 'gpt-4');
      await manager.emitLLMEnd(
        runId,
        'Hi there!',
        'gpt-4',
        { promptTokens: 5, completionTokens: 3, totalTokens: 8 },
        150
      );

      expect(handler).toHaveBeenCalledTimes(2);
      expect(handler).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({
          type: 'llm_start',
          prompt: 'Hello',
          model: 'gpt-4',
        })
      );
      expect(handler).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({
          type: 'llm_end',
          content: 'Hi there!',
          model: 'gpt-4',
          usage: { promptTokens: 5, completionTokens: 3, totalTokens: 8 },
        })
      );
    });

    it('should emit retrieval start/end events', async () => {
      const handler = vi.fn();
      manager.addHandler({ name: 'test', handleEvent: handler });

      const runId = await manager.emitRetrievalStart('What is AI?', { collection: 'docs' });
      await manager.emitRetrievalEnd(
        runId,
        'What is AI?',
        [{ content: 'AI is...', score: 0.9 }],
        75
      );

      expect(handler).toHaveBeenCalledTimes(2);
      expect(handler).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({
          type: 'retrieval_start',
          query: 'What is AI?',
          collection: 'docs',
        })
      );
      expect(handler).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({
          type: 'retrieval_end',
          query: 'What is AI?',
          results: [{ content: 'AI is...', score: 0.9 }],
          durationMs: 75,
        })
      );
    });
  });

  describe('createCallbackHandler', () => {
    it('should create handler from shortcut callbacks', async () => {
      const onToken = vi.fn();
      const onToolStart = vi.fn();

      const handler = createCallbackHandler('test', {
        onToken,
        onToolStart,
      });

      expect(handler.name).toBe('test');
      expect(handler.eventTypes).toContain('token');
      expect(handler.eventTypes).toContain('tool_start');
      expect(handler.eventTypes).not.toContain('agent_action');

      manager.addHandler(handler);

      await manager.emitToken('run', 'hi', 0, 'hi');
      expect(onToken).toHaveBeenCalledWith('hi', 0, 'hi');

      await manager.emitToolStart('search', {});
      expect(onToolStart).toHaveBeenCalled();
    });

    it('should handle all callback types', async () => {
      const callbacks = {
        onTokenStart: vi.fn(),
        onToken: vi.fn(),
        onTokenEnd: vi.fn(),
        onToolStart: vi.fn(),
        onToolEnd: vi.fn(),
        onAgentAction: vi.fn(),
        onAgentFinish: vi.fn(),
        onLLMStart: vi.fn(),
        onLLMEnd: vi.fn(),
      };

      const handler = createCallbackHandler('full', callbacks);
      manager.addHandler(handler);

      await manager.emitTokenStart('test');
      expect(callbacks.onTokenStart).toHaveBeenCalled();

      await manager.emitToken('run', 'x', 0, 'x');
      expect(callbacks.onToken).toHaveBeenCalled();

      await manager.emitTokenEnd('run', 'x', 1, 10);
      expect(callbacks.onTokenEnd).toHaveBeenCalled();

      await manager.emitToolStart('tool', {});
      expect(callbacks.onToolStart).toHaveBeenCalled();

      await manager.emitToolEnd('run', 'tool', {}, {}, 10);
      expect(callbacks.onToolEnd).toHaveBeenCalled();

      await manager.emitAgentAction('action', {});
      expect(callbacks.onAgentAction).toHaveBeenCalled();

      await manager.emitAgentFinish('run', {}, 100);
      expect(callbacks.onAgentFinish).toHaveBeenCalled();

      await manager.emitLLMStart('prompt', 'model');
      expect(callbacks.onLLMStart).toHaveBeenCalled();

      await manager.emitLLMEnd('run', 'content', 'model', { promptTokens: 1, completionTokens: 1, totalTokens: 2 }, 50);
      expect(callbacks.onLLMEnd).toHaveBeenCalled();
    });
  });

  describe('global callback manager', () => {
    it('should get/set global manager', () => {
      const manager1 = getCallbackManager();
      const manager2 = getCallbackManager();
      expect(manager1).toBe(manager2);

      const newManager = new CallbackManager();
      setCallbackManager(newManager);
      expect(getCallbackManager()).toBe(newManager);
    });

    it('should reset global manager', () => {
      const manager1 = getCallbackManager();
      resetCallbackManager();
      const manager2 = getCallbackManager();
      expect(manager1).not.toBe(manager2);
    });
  });

  describe('consoleCallbackHandler', () => {
    it('should have correct name', () => {
      expect(consoleCallbackHandler.name).toBe('console');
    });

    it('should handle events without throwing', () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      const stdoutSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

      expect(() => {
        consoleCallbackHandler.handleEvent({
          type: 'token',
          timestamp: Date.now(),
          runId: 'test',
          token: 'hello',
          index: 0,
          content: 'hello',
        });
      }).not.toThrow();

      expect(() => {
        consoleCallbackHandler.handleEvent({
          type: 'token_start',
          timestamp: Date.now(),
          runId: 'test',
          prompt: 'Hello',
        });
      }).not.toThrow();

      expect(() => {
        consoleCallbackHandler.handleEvent({
          type: 'agent_action',
          timestamp: Date.now(),
          runId: 'test',
          action: 'search',
          actionInput: {},
          thought: 'I should search',
        });
      }).not.toThrow();

      consoleSpy.mockRestore();
      stdoutSpy.mockRestore();
    });
  });
});
