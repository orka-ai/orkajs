import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Orka, createOrka } from '@orka-js/core';
import type { LLMAdapter, VectorDBAdapter, LLMResult } from '@orka-js/core';

const mockLLMResult = (): LLMResult => ({
  content: 'mocked response',
  usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
  model: 'mock-model',
  finishReason: 'stop',
});

const createMockLLM = (): LLMAdapter => ({
  name: 'mock',
  generate: vi.fn().mockResolvedValue(mockLLMResult()),
  embed: vi.fn().mockResolvedValue([[0.1, 0.2, 0.3]]),
});

const createMockVectorDB = (): VectorDBAdapter => ({
  name: 'mock-vector',
  upsert: vi.fn().mockResolvedValue(undefined),
  search: vi.fn().mockResolvedValue([{ id: '1', score: 0.9, content: 'context text', metadata: {} }]),
  delete: vi.fn().mockResolvedValue(undefined),
  createCollection: vi.fn().mockResolvedValue(undefined),
  deleteCollection: vi.fn().mockResolvedValue(undefined),
});

describe('Orka', () => {
  describe('createOrka', () => {
    it('creates an Orka instance', () => {
      const orka = createOrka({ llm: createMockLLM() });
      expect(orka).toBeInstanceOf(Orka);
    });

    it('exposes a knowledge property', () => {
      const orka = createOrka({ llm: createMockLLM() });
      expect(orka.knowledge).toBeDefined();
    });
  });

  describe('generate()', () => {
    it('returns a string from the LLM', async () => {
      const llm = createMockLLM();
      const orka = createOrka({ llm });
      const result = await orka.generate('Hello');
      expect(result).toBe('mocked response');
    });

    it('passes temperature and maxTokens defaults', async () => {
      const llm = createMockLLM();
      const orka = createOrka({ llm, defaults: { temperature: 0.3, maxTokens: 512 } });
      await orka.generate('Hello');
      expect(llm.generate).toHaveBeenCalledWith('Hello', expect.objectContaining({
        temperature: 0.3,
        maxTokens: 512,
      }));
    });

    it('uses fallback defaults when not configured', async () => {
      const llm = createMockLLM();
      const orka = createOrka({ llm });
      await orka.generate('Hello');
      expect(llm.generate).toHaveBeenCalledWith('Hello', expect.objectContaining({
        temperature: 0.7,
        maxTokens: 1024,
      }));
    });

    it('passes systemPrompt option', async () => {
      const llm = createMockLLM();
      const orka = createOrka({ llm });
      await orka.generate('Hello', { systemPrompt: 'You are helpful' });
      expect(llm.generate).toHaveBeenCalledWith('Hello', expect.objectContaining({
        systemPrompt: expect.stringContaining('You are helpful'),
      }));
    });

    it('overrides defaults with provided options', async () => {
      const llm = createMockLLM();
      const orka = createOrka({ llm, defaults: { temperature: 0.3 } });
      await orka.generate('Hello', { temperature: 0.9 });
      expect(llm.generate).toHaveBeenCalledWith('Hello', expect.objectContaining({
        temperature: 0.9,
      }));
    });
  });

  describe('ask()', () => {
    it('returns an AskResult shape', async () => {
      const llm = createMockLLM();
      const orka = createOrka({ llm });
      const result = await orka.ask({ question: 'What is 2+2?' });
      expect(result).toHaveProperty('answer', 'mocked response');
      expect(result).toHaveProperty('usage');
      expect(result).toHaveProperty('latencyMs');
      expect(typeof result.latencyMs).toBe('number');
    });

    it('asks without knowledge — calls LLM with the question as prompt', async () => {
      const llm = createMockLLM();
      const orka = createOrka({ llm });
      await orka.ask({ question: 'What is TypeScript?' });
      expect(llm.generate).toHaveBeenCalledWith('What is TypeScript?', expect.any(Object));
    });

    it('searches knowledge when knowledge name and vectorDB are provided', async () => {
      const llm = createMockLLM();
      const vectorDB = createMockVectorDB();
      (llm.embed as ReturnType<typeof vi.fn>).mockResolvedValue([[0.5, 0.5]]);
      const orka = createOrka({ llm, vectorDB });
      await orka.ask({ knowledge: 'my-docs', question: 'What is OrkaJS?' });
      expect(vectorDB.search).toHaveBeenCalled();
    });

    it('augments the prompt with retrieved context', async () => {
      const llm = createMockLLM();
      const vectorDB = createMockVectorDB();
      (llm.embed as ReturnType<typeof vi.fn>).mockResolvedValue([[0.5, 0.5]]);
      const orka = createOrka({ llm, vectorDB });
      await orka.ask({ knowledge: 'my-docs', question: 'What is OrkaJS?' });
      const callArg = (llm.generate as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
      expect(callArg).toContain('Context:');
      expect(callArg).toContain('context text');
    });

    it('returns context when includeContext is true', async () => {
      const llm = createMockLLM();
      const vectorDB = createMockVectorDB();
      (llm.embed as ReturnType<typeof vi.fn>).mockResolvedValue([[0.5, 0.5]]);
      const orka = createOrka({ llm, vectorDB });
      const result = await orka.ask({ knowledge: 'my-docs', question: 'Q?', includeContext: true });
      expect(result.context).toBeDefined();
      expect(result.context?.length).toBeGreaterThan(0);
    });

    it('omits context by default', async () => {
      const llm = createMockLLM();
      const orka = createOrka({ llm });
      const result = await orka.ask({ question: 'Q?' });
      expect(result.context).toBeUndefined();
    });
  });

  describe('streamAsk()', () => {
    it('yields an ErrorEvent when LLM does not support streaming', async () => {
      const llm = createMockLLM();
      const orka = createOrka({ llm });
      const events = [];
      for await (const event of orka.streamAsk({ question: 'Hello' })) {
        events.push(event);
      }
      expect(events).toHaveLength(1);
      expect(events[0].type).toBe('error');
    });
  });
});
