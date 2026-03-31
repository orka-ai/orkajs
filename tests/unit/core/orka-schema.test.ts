import { describe, it, expect, vi } from 'vitest';
import { createOrka, OrkaError, OrkaErrorCode } from '@orka-js/core';
import type { LLMAdapter, ZodLikeSchema } from '@orka-js/core';

const makeSchema = <T>(validator: (d: unknown) => T): ZodLikeSchema<T> => ({
  parse: validator,
  safeParse: (d) => {
    try {
      return { success: true, data: validator(d) };
    } catch (e) {
      return { success: false, error: { message: (e as Error).message } };
    }
  },
});

const createMockLLM = (content: string): LLMAdapter => ({
  name: 'mock',
  generate: vi.fn().mockResolvedValue({
    content,
    usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
    model: 'mock',
    finishReason: 'stop',
  }),
  embed: vi.fn().mockResolvedValue([[0.1]]),
});

describe('Orka — Structured Outputs', () => {
  describe('generate() without schema', () => {
    it('returns a plain string', async () => {
      const orka = createOrka({ llm: createMockLLM('hello') });
      const result = await orka.generate('prompt');
      expect(typeof result).toBe('string');
      expect(result).toBe('hello');
    });
  });

  describe('generate<T>() with schema', () => {
    it('returns a typed object from valid JSON', async () => {
      const orka = createOrka({ llm: createMockLLM('{"name":"iPhone","price":999}') });
      const schema = makeSchema<{ name: string; price: number }>((d) => {
        const obj = d as { name: string; price: number };
        if (typeof obj.name !== 'string' || typeof obj.price !== 'number') throw new Error('invalid');
        return obj;
      });
      const result = await orka.generate('Extract product info', { schema });
      expect(result.name).toBe('iPhone');
      expect(result.price).toBe(999);
    });

    it('extracts JSON from markdown code block', async () => {
      const orka = createOrka({ llm: createMockLLM('```json\n{"name":"iPhone","price":999}\n```') });
      const schema = makeSchema<{ name: string; price: number }>((d) => d as { name: string; price: number });
      const result = await orka.generate('Extract', { schema });
      expect(result.name).toBe('iPhone');
    });

    it('injects JSON instructions into systemPrompt', async () => {
      const llm = createMockLLM('{"ok":true}');
      const orka = createOrka({ llm });
      const schema = makeSchema<{ ok: boolean }>((d) => d as { ok: boolean });
      await orka.generate('prompt', { schema, systemPrompt: 'Be helpful.' });
      const callArgs = (llm.generate as ReturnType<typeof vi.fn>).mock.calls[0][1];
      expect(callArgs.systemPrompt).toContain('Be helpful.');
      expect(callArgs.systemPrompt).toContain('JSON');
    });

    it('throws OrkaError with PARSE_ERROR when LLM returns invalid JSON', async () => {
      const orka = createOrka({ llm: createMockLLM('this is not json at all') });
      const schema = makeSchema<{ name: string }>((d) => d as { name: string });
      await expect(orka.generate('Extract', { schema })).rejects.toMatchObject({
        code: OrkaErrorCode.PARSE_ERROR,
      });
    });

    it('throws OrkaError with VALIDATION_ERROR when schema validation fails', async () => {
      const orka = createOrka({ llm: createMockLLM('{"wrong":"field"}') });
      const schema = makeSchema<{ name: string }>((d) => {
        const obj = d as Record<string, unknown>;
        if (!('name' in obj)) throw new Error('Missing name field');
        return obj as { name: string };
      });
      await expect(orka.generate('Extract', { schema })).rejects.toMatchObject({
        code: OrkaErrorCode.VALIDATION_ERROR,
      });
    });
  });

  describe('ask<T>() with schema', () => {
    it('returns typed answer in AskResult', async () => {
      const orka = createOrka({ llm: createMockLLM('{"policy":"30 days","duration":30}') });
      const schema = makeSchema<{ policy: string; duration: number }>((d) => d as { policy: string; duration: number });
      const result = await orka.ask({ question: 'What is the return policy?', schema });
      expect(result.answer.policy).toBe('30 days');
      expect(result.answer.duration).toBe(30);
    });

    it('returns string answer when no schema is provided', async () => {
      const orka = createOrka({ llm: createMockLLM('The answer is 42.') });
      const result = await orka.ask({ question: 'What is the answer?' });
      expect(typeof result.answer).toBe('string');
      expect(result.answer).toBe('The answer is 42.');
    });
  });
});
