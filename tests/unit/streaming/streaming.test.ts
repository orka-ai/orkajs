import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  isStreamingAdapter,
  createStreamEvent,
  consumeStream,
  type LLMStreamEvent,
  type TokenEvent,
  type ContentEvent,
  type DoneEvent,
  type ErrorEvent,
  type UsageEvent,
  type StreamResult,
} from '@orka-js/core';

describe('Streaming', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('isStreamingAdapter', () => {
    it('should return true for valid streaming adapter', () => {
      const adapter = {
        stream: async function* () { yield {} as LLMStreamEvent; },
        streamGenerate: async () => ({} as StreamResult),
        supportsStreaming: true,
      };

      expect(isStreamingAdapter(adapter)).toBe(true);
    });

    it('should return false for non-streaming adapter', () => {
      const adapter = {
        generate: async () => ({}),
        embed: async () => [],
        name: 'test',
      };

      expect(isStreamingAdapter(adapter)).toBe(false);
    });

    it('should return false for adapter with supportsStreaming = false', () => {
      const adapter = {
        stream: async function* () { yield {} as LLMStreamEvent; },
        streamGenerate: async () => ({} as StreamResult),
        supportsStreaming: false,
      };

      expect(isStreamingAdapter(adapter)).toBe(false);
    });

    it('should return false for null', () => {
      expect(isStreamingAdapter(null)).toBe(false);
    });

    it('should return false for undefined', () => {
      expect(isStreamingAdapter(undefined)).toBe(false);
    });
  });

  describe('createStreamEvent', () => {
    it('should create token event with timestamp', () => {
      const event = createStreamEvent<TokenEvent>('token', {
        token: 'Hello',
        index: 0,
      });

      expect(event.type).toBe('token');
      expect(event.token).toBe('Hello');
      expect(event.index).toBe(0);
      expect(event.timestamp).toBeDefined();
      expect(typeof event.timestamp).toBe('number');
    });

    it('should create content event', () => {
      const event = createStreamEvent<ContentEvent>('content', {
        content: 'Hello World',
        delta: 'World',
        index: 1,
      });

      expect(event.type).toBe('content');
      expect(event.content).toBe('Hello World');
      expect(event.delta).toBe('World');
      expect(event.index).toBe(1);
    });

    it('should create done event', () => {
      const event = createStreamEvent<DoneEvent>('done', {
        content: 'Complete response',
        finishReason: 'stop',
        usage: {
          promptTokens: 10,
          completionTokens: 20,
          totalTokens: 30,
        },
      });

      expect(event.type).toBe('done');
      expect(event.content).toBe('Complete response');
      expect(event.finishReason).toBe('stop');
      expect(event.usage?.totalTokens).toBe(30);
    });

    it('should create error event', () => {
      const error = new Error('Test error');
      const event = createStreamEvent<ErrorEvent>('error', {
        error,
        message: 'Test error message',
      });

      expect(event.type).toBe('error');
      expect(event.error).toBe(error);
      expect(event.message).toBe('Test error message');
    });

    it('should create usage event', () => {
      const event = createStreamEvent<UsageEvent>('usage', {
        usage: {
          promptTokens: 100,
          completionTokens: 200,
          totalTokens: 300,
        },
      });

      expect(event.type).toBe('usage');
      expect(event.usage.promptTokens).toBe(100);
      expect(event.usage.completionTokens).toBe(200);
      expect(event.usage.totalTokens).toBe(300);
    });
  });

  describe('consumeStream', () => {
    it('should consume stream and return final result', async () => {
      async function* mockStream(): AsyncIterable<LLMStreamEvent> {
        yield createStreamEvent<TokenEvent>('token', { token: 'Hello', index: 0 });
        yield createStreamEvent<TokenEvent>('token', { token: ' ', index: 1 });
        yield createStreamEvent<TokenEvent>('token', { token: 'World', index: 2 });
        yield createStreamEvent<UsageEvent>('usage', {
          usage: { promptTokens: 5, completionTokens: 3, totalTokens: 8 },
        });
        yield createStreamEvent<DoneEvent>('done', {
          content: 'Hello World',
          finishReason: 'stop',
          usage: { promptTokens: 5, completionTokens: 3, totalTokens: 8 },
        });
      }

      const result = await consumeStream(mockStream());

      expect(result.content).toBe('Hello World');
      expect(result.finishReason).toBe('stop');
      expect(result.usage.totalTokens).toBe(8);
      expect(result.durationMs).toBeGreaterThanOrEqual(0);
    });

    it('should call onToken handler for each token', async () => {
      const onToken = vi.fn();

      async function* mockStream(): AsyncIterable<LLMStreamEvent> {
        yield createStreamEvent<TokenEvent>('token', { token: 'A', index: 0 });
        yield createStreamEvent<TokenEvent>('token', { token: 'B', index: 1 });
        yield createStreamEvent<TokenEvent>('token', { token: 'C', index: 2 });
        yield createStreamEvent<DoneEvent>('done', {
          content: 'ABC',
          finishReason: 'stop',
        });
      }

      await consumeStream(mockStream(), { onToken });

      expect(onToken).toHaveBeenCalledTimes(3);
      expect(onToken).toHaveBeenNthCalledWith(1, 'A', 0);
      expect(onToken).toHaveBeenNthCalledWith(2, 'B', 1);
      expect(onToken).toHaveBeenNthCalledWith(3, 'C', 2);
    });

    it('should call onEvent handler for each event', async () => {
      const onEvent = vi.fn();

      async function* mockStream(): AsyncIterable<LLMStreamEvent> {
        yield createStreamEvent<TokenEvent>('token', { token: 'X', index: 0 });
        yield createStreamEvent<DoneEvent>('done', {
          content: 'X',
          finishReason: 'stop',
        });
      }

      await consumeStream(mockStream(), { onEvent });

      expect(onEvent).toHaveBeenCalledTimes(2);
      expect(onEvent.mock.calls[0][0].type).toBe('token');
      expect(onEvent.mock.calls[1][0].type).toBe('done');
    });

    it('should throw on error event', async () => {
      const testError = new Error('Stream error');

      async function* mockStream(): AsyncIterable<LLMStreamEvent> {
        yield createStreamEvent<TokenEvent>('token', { token: 'Start', index: 0 });
        yield createStreamEvent<ErrorEvent>('error', {
          error: testError,
          message: 'Stream error',
        });
      }

      await expect(consumeStream(mockStream())).rejects.toThrow('Stream error');
    });

    it('should track time to first token', async () => {
      async function* mockStream(): AsyncIterable<LLMStreamEvent> {
        yield createStreamEvent<TokenEvent>('token', { token: 'First', index: 0 });
        yield createStreamEvent<DoneEvent>('done', {
          content: 'First',
          finishReason: 'stop',
        });
      }

      const result = await consumeStream(mockStream());

      expect(result.ttft).toBeDefined();
      expect(result.ttft).toBeGreaterThanOrEqual(0);
    });

    it('should handle content events', async () => {
      async function* mockStream(): AsyncIterable<LLMStreamEvent> {
        yield createStreamEvent<ContentEvent>('content', {
          content: 'Hello',
          delta: 'Hello',
          index: 0,
        });
        yield createStreamEvent<ContentEvent>('content', {
          content: 'Hello World',
          delta: ' World',
          index: 1,
        });
        yield createStreamEvent<DoneEvent>('done', {
          content: 'Hello World',
          finishReason: 'stop',
        });
      }

      const result = await consumeStream(mockStream());

      expect(result.content).toBe('Hello World');
    });
  });

  describe('Stream Event Types', () => {
    it('should support all event types', () => {
      const eventTypes: LLMStreamEvent['type'][] = [
        'token',
        'content',
        'tool_call',
        'tool_result',
        'thinking',
        'usage',
        'done',
        'error',
      ];

      expect(eventTypes).toHaveLength(8);
    });

    it('should support all finish reasons', () => {
      const finishReasons: DoneEvent['finishReason'][] = [
        'stop',
        'length',
        'tool_calls',
        'error',
      ];

      expect(finishReasons).toHaveLength(4);
    });
  });
});

describe('OpenAI Streaming Adapter', () => {
  it('should have supportsStreaming property', async () => {
    const { OpenAIAdapter } = await import('@orka-js/openai');
    const adapter = new OpenAIAdapter({ apiKey: 'test-key' });

    expect(adapter.supportsStreaming).toBe(true);
    expect(isStreamingAdapter(adapter)).toBe(true);
  });

  it('should have stream method', async () => {
    const { OpenAIAdapter } = await import('@orka-js/openai');
    const adapter = new OpenAIAdapter({ apiKey: 'test-key' });

    expect(typeof adapter.stream).toBe('function');
  });

  it('should have streamGenerate method', async () => {
    const { OpenAIAdapter } = await import('@orka-js/openai');
    const adapter = new OpenAIAdapter({ apiKey: 'test-key' });

    expect(typeof adapter.streamGenerate).toBe('function');
  });
});

describe('Anthropic Streaming Adapter', () => {
  it('should have supportsStreaming property', async () => {
    const { AnthropicAdapter } = await import('@orka-js/anthropic');
    const adapter = new AnthropicAdapter({ apiKey: 'test-key' });

    expect(adapter.supportsStreaming).toBe(true);
    expect(isStreamingAdapter(adapter)).toBe(true);
  });

  it('should have stream method', async () => {
    const { AnthropicAdapter } = await import('@orka-js/anthropic');
    const adapter = new AnthropicAdapter({ apiKey: 'test-key' });

    expect(typeof adapter.stream).toBe('function');
  });

  it('should have streamGenerate method', async () => {
    const { AnthropicAdapter } = await import('@orka-js/anthropic');
    const adapter = new AnthropicAdapter({ apiKey: 'test-key' });

    expect(typeof adapter.streamGenerate).toBe('function');
  });
});

describe('Mistral Streaming Adapter', () => {
  it('should have supportsStreaming property', async () => {
    const { MistralAdapter } = await import('@orka-js/mistral');
    const adapter = new MistralAdapter({ apiKey: 'test-key' });

    expect(adapter.supportsStreaming).toBe(true);
    expect(isStreamingAdapter(adapter)).toBe(true);
  });

  it('should have stream method', async () => {
    const { MistralAdapter } = await import('@orka-js/mistral');
    const adapter = new MistralAdapter({ apiKey: 'test-key' });

    expect(typeof adapter.stream).toBe('function');
  });

  it('should have streamGenerate method', async () => {
    const { MistralAdapter } = await import('@orka-js/mistral');
    const adapter = new MistralAdapter({ apiKey: 'test-key' });

    expect(typeof adapter.streamGenerate).toBe('function');
  });
});

describe('Ollama Streaming Adapter', () => {
  it('should have supportsStreaming property', async () => {
    const { OllamaAdapter } = await import('@orka-js/ollama');
    const adapter = new OllamaAdapter();

    expect(adapter.supportsStreaming).toBe(true);
    expect(isStreamingAdapter(adapter)).toBe(true);
  });

  it('should have stream method', async () => {
    const { OllamaAdapter } = await import('@orka-js/ollama');
    const adapter = new OllamaAdapter();

    expect(typeof adapter.stream).toBe('function');
  });

  it('should have streamGenerate method', async () => {
    const { OllamaAdapter } = await import('@orka-js/ollama');
    const adapter = new OllamaAdapter();

    expect(typeof adapter.streamGenerate).toBe('function');
  });
});
