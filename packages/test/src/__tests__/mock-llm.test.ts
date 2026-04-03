import { describe, it, expect, beforeEach } from 'vitest';
import { MockLLMAdapter, mockLLM } from '../mock-llm.js';

describe('MockLLMAdapter', () => {
  let llm: MockLLMAdapter;

  beforeEach(() => {
    llm = mockLLM([
      { when: 'weather', output: 'It is sunny today' },
      { when: /price/i, output: 'The price is $99/month' },
      { when: 'demo', toolCall: { name: 'bookDemo', args: { slot: 'tomorrow' } } },
      { when: (p) => p.includes('error'), error: new Error('Test error') },
    ], 'Default response');
  });

  it('returns matching output for string pattern', async () => {
    const result = await llm.generate('What is the weather?');
    expect(result.content).toBe('It is sunny today');
  });

  it('returns matching output for regex pattern', async () => {
    const result = await llm.generate('What is the price?');
    expect(result.content).toBe('The price is $99/month');
  });

  it('returns default output when no match', async () => {
    const result = await llm.generate('Hello there');
    expect(result.content).toBe('Default response');
  });

  it('throws error when configured', async () => {
    await expect(llm.generate('trigger an error please')).rejects.toThrow('Test error');
  });

  it('tracks calls', async () => {
    await llm.generate('weather check');
    await llm.generate('price query');
    expect(llm.getCallCount()).toBe(2);
  });

  it('wasCalledWith matches correctly', async () => {
    await llm.generate('weather check');
    expect(llm.wasCalledWith('weather')).toBe(true);
    expect(llm.wasCalledWith('unrelated')).toBe(false);
  });

  it('reset clears calls', async () => {
    await llm.generate('test');
    llm.reset();
    expect(llm.getCallCount()).toBe(0);
  });

  it('streams tokens correctly', async () => {
    const tokens: string[] = [];
    for await (const event of llm.stream('weather query')) {
      if (event.type === 'token') tokens.push(event.token);
    }
    expect(tokens.join('')).toBe('It is sunny today');
  });

  it('streams tool call event', async () => {
    const events = [];
    for await (const event of llm.stream('book a demo')) {
      events.push(event);
    }
    const toolCall = events.find(e => e.type === 'tool_call');
    expect(toolCall).toBeDefined();
    expect((toolCall as { name: string }).name).toBe('bookDemo');
  });

  it('produces deterministic embeddings', async () => {
    const [emb1] = await llm.embed('hello');
    const [emb2] = await llm.embed('hello');
    expect(emb1).toEqual(emb2);
    expect(emb1.length).toBe(1536);
  });
});
