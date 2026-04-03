import { describe, it, expect, vi } from 'vitest';
import { RealtimeAgent } from '../realtime-agent.js';
import type { STTAdapter, TTSAdapter } from '../types.js';

// Minimal mock LLM
const mockLLM = {
  name: 'mock',
  supportsStreaming: true,
  async generate() {
    return { content: 'Hello, how can I help?', usage: { promptTokens: 5, completionTokens: 8, totalTokens: 13 }, model: 'mock', finishReason: 'stop' as const };
  },
  async generateObject<T>() { return {} as T; },
  async embed() { return []; },
  async *stream() {
    yield { type: 'token' as const, token: 'Hello', index: 0 };
    yield { type: 'done' as const, content: 'Hello, how can I help?', finishReason: 'stop' as const, usage: { promptTokens: 5, completionTokens: 8, totalTokens: 13 } };
  },
  async streamGenerate() {
    return { content: 'Hello', usage: { promptTokens: 5, completionTokens: 8, totalTokens: 13 }, model: 'mock', finishReason: 'stop' as const, durationMs: 10 };
  },
};

const mockSTT: STTAdapter = {
  async transcribe() { return 'What is the weather?'; },
};

const mockTTS: TTSAdapter = {
  async synthesize() { return Buffer.from('audio-data'); },
};

describe('RealtimeAgent', () => {
  it('process(): transcribes audio, runs LLM, returns result', async () => {
    const agent = new RealtimeAgent({
      config: { goal: 'Help users', tts: false },
      llm: mockLLM,
      stt: mockSTT,
    });

    const result = await agent.process(Buffer.from('fake-audio'));
    expect(result.transcript).toBe('What is the weather?');
    expect(result.response).toBeTruthy();
    expect(result.audio).toBeUndefined();
  });

  it('process(): synthesizes audio when tts is enabled', async () => {
    const agent = new RealtimeAgent({
      config: { goal: 'Help users', tts: true },
      llm: mockLLM,
      stt: mockSTT,
      tts: mockTTS,
    });

    const result = await agent.process(Buffer.from('fake-audio'));
    expect(result.transcript).toBe('What is the weather?');
    expect(result.audio).toBeInstanceOf(Buffer);
  });

  it('processStream(): emits transcript, token, done events', async () => {
    const agent = new RealtimeAgent({
      config: { goal: 'Help users', tts: false },
      llm: mockLLM,
      stt: mockSTT,
    });

    const events = [];
    for await (const event of agent.processStream(Buffer.from('fake-audio'))) {
      events.push(event);
    }

    expect(events.some(e => e.type === 'transcript')).toBe(true);
    expect(events.some(e => e.type === 'done')).toBe(true);
  });

  it('processStream(): emits error if STT fails', async () => {
    const failingSTT: STTAdapter = {
      async transcribe() { throw new Error('STT failed'); },
    };

    const agent = new RealtimeAgent({
      config: { goal: 'Help users' },
      llm: mockLLM,
      stt: failingSTT,
    });

    const events = [];
    for await (const event of agent.processStream(Buffer.from('fake-audio'))) {
      events.push(event);
    }

    expect(events.some(e => e.type === 'error')).toBe(true);
  });

  it('wsHandler(): returns a function', () => {
    const agent = new RealtimeAgent({
      config: { goal: 'Help users' },
      llm: mockLLM,
      stt: mockSTT,
    });

    const handler = agent.wsHandler();
    expect(typeof handler).toBe('function');
  });
});
