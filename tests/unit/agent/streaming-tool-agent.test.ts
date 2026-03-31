import { describe, it, expect, vi, beforeEach } from 'vitest';
import { StreamingToolAgent } from '@orka-js/agent';
import type { LLMStreamEvent } from '@orka-js/core';
import { createStreamEvent } from '@orka-js/core';

// ─── helpers ──────────────────────────────────────────────────────────────────

function makeStreamingLLM(responses: LLMStreamEvent[][]): {
  name: string;
  supportsStreaming: boolean;
  generate: ReturnType<typeof vi.fn>;
  embed: ReturnType<typeof vi.fn>;
  stream: ReturnType<typeof vi.fn>;
  streamGenerate: ReturnType<typeof vi.fn>;
  _callCount: () => number;
} {
  let callIndex = 0;
  const stream = vi.fn().mockImplementation(async function* () {
    const events = responses[callIndex] ?? responses[responses.length - 1];
    callIndex++;
    for (const e of events) yield e;
  });

  return {
    name: 'mock-stream',
    supportsStreaming: true,
    generate: vi.fn().mockResolvedValue({ content: '', usage: { promptTokens: 1, completionTokens: 1, totalTokens: 2 }, model: 'mock', finishReason: 'stop' }),
    embed: vi.fn().mockResolvedValue([[0.1, 0.2]]),
    stream,
    streamGenerate: vi.fn(),
    _callCount: () => callIndex,
  };
}

const weatherTool = {
  name: 'get_weather',
  description: 'Get weather for a location',
  parameters: [{ name: 'location', type: 'string' as const, description: 'City', required: true }],
  execute: vi.fn().mockResolvedValue({ output: 'Sunny, 22°C' }),
};

const config = { goal: 'Help the user', tools: [weatherTool] };

// ─── tests ────────────────────────────────────────────────────────────────────

describe('StreamingToolAgent', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('yields token events when LLM responds without tool calls', async () => {
    const llm = makeStreamingLLM([[
      createStreamEvent('token', { token: 'Hello', index: 0 }),
      createStreamEvent('token', { token: ' world', index: 1 }),
      createStreamEvent('done', { content: 'Hello world', finishReason: 'stop' }),
    ]]);

    const agent = new StreamingToolAgent(config, llm as never);
    const events: LLMStreamEvent[] = [];
    for await (const e of agent.runStream('Hi')) events.push(e);

    const tokens = events.filter(e => e.type === 'token').map(e => (e as { token: string }).token);
    expect(tokens).toEqual(['Hello', ' world']);

    const done = events.find(e => e.type === 'done') as { content: string } | undefined;
    expect(done?.content).toBe('Hello world');
  });

  it('executes a tool when a tool_call event is received', async () => {
    const llm = makeStreamingLLM([
      // first stream: returns a tool call
      [
        createStreamEvent('token', { token: 'Let me check...', index: 0 }),
        createStreamEvent('tool_call', { toolCallId: 'c1', name: 'get_weather', arguments: '{"location":"Paris"}' }),
        createStreamEvent('done', { content: '', finishReason: 'tool_calls' }),
      ],
      // second stream: final answer
      [
        createStreamEvent('token', { token: 'It is sunny!', index: 0 }),
        createStreamEvent('done', { content: 'It is sunny!', finishReason: 'stop' }),
      ],
    ]);

    const agent = new StreamingToolAgent(config, llm as never);
    const events: LLMStreamEvent[] = [];
    for await (const e of agent.runStream('Weather in Paris?')) events.push(e);

    // Tool should have been called with parsed args
    expect(weatherTool.execute).toHaveBeenCalledWith({ location: 'Paris' });

    // Should have emitted a tool_result event
    const toolResult = events.find(e => e.type === 'tool_result') as { result: string } | undefined;
    expect(toolResult?.result).toBe('Sunny, 22°C');

    // Final done with content from second stream
    const done = events.find(e => e.type === 'done') as { content: string } | undefined;
    expect(done?.content).toBe('It is sunny!');
  });

  it('passes token events through during tool call streaming', async () => {
    const llm = makeStreamingLLM([
      [
        createStreamEvent('token', { token: 'Thinking...', index: 0 }),
        createStreamEvent('tool_call', { toolCallId: 'c1', name: 'get_weather', arguments: '{"location":"Lyon"}' }),
        createStreamEvent('done', { content: '', finishReason: 'tool_calls' }),
      ],
      [
        createStreamEvent('token', { token: 'Done.', index: 0 }),
        createStreamEvent('done', { content: 'Done.', finishReason: 'stop' }),
      ],
    ]);

    const agent = new StreamingToolAgent(config, llm as never);
    const tokens: string[] = [];
    for await (const e of agent.runStream('Lyon weather?')) {
      if (e.type === 'token') tokens.push((e as { token: string }).token);
    }

    expect(tokens).toContain('Thinking...');
    expect(tokens).toContain('Done.');
  });

  it('run() returns an AgentResult with tool observations', async () => {
    const llm = makeStreamingLLM([
      [
        createStreamEvent('tool_call', { toolCallId: 'c1', name: 'get_weather', arguments: '{"location":"NYC"}' }),
        createStreamEvent('done', { content: '', finishReason: 'tool_calls' }),
      ],
      [
        createStreamEvent('token', { token: 'Sunny in NYC.', index: 0 }),
        createStreamEvent('done', { content: 'Sunny in NYC.', finishReason: 'stop' }),
      ],
    ]);

    const agent = new StreamingToolAgent(config, llm as never);
    const result = await agent.run('NYC weather?');

    expect(result.output).toBe('Sunny in NYC.');
    expect(result.steps.length).toBeGreaterThan(0);
    expect(result.steps[0].observation).toBe('Sunny, 22°C');
  });

  it('throws when LLM does not support streaming', async () => {
    const nonStreamingLLM = {
      name: 'static',
      generate: vi.fn(),
      embed: vi.fn(),
    };

    const agent = new StreamingToolAgent(config, nonStreamingLLM as never);
    const events: LLMStreamEvent[] = [];
    for await (const e of agent.runStream('test')) events.push(e);

    expect(events[0]?.type).toBe('error');
  });
});
