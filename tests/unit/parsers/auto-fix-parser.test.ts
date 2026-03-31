import { describe, it, expect, vi } from 'vitest';
import { AutoFixParser } from '@orka-js/tools';
import type { OutputParser } from '@orka-js/tools';

const makePassthroughParser = (): OutputParser<string> => ({
  parse: (text: string) => text,
  getFormatInstructions: () => 'Return a plain string.',
});

const makeFailingParser = (throwAfter = 0): OutputParser<string> => {
  let count = 0;
  return {
    parse: (text: string) => {
      if (count++ < throwAfter) throw new Error(`Parse error on attempt ${count}`);
      return text;
    },
    getFormatInstructions: () => 'Return a string.',
  };
};

const makeAlwaysFailParser = (): OutputParser<string> => ({
  parse: () => { throw new Error('Always fails'); },
  getFormatInstructions: () => 'Return a string.',
});

const createMockLLM = (fixedContent = '{"fixed":true}') => ({
  generate: vi.fn().mockResolvedValue({ content: fixedContent }),
});

describe('AutoFixParser', () => {
  describe('parse() — synchronous', () => {
    it('delegates to the inner parser on success', () => {
      const parser = new AutoFixParser({ parser: makePassthroughParser() });
      expect(parser.parse('hello')).toBe('hello');
    });

    it('wraps inner parser error in AutoFixParser message', () => {
      const parser = new AutoFixParser({ parser: makeAlwaysFailParser() });
      expect(() => parser.parse('anything')).toThrow('AutoFixParser: Initial parse failed');
    });
  });

  describe('parseWithRetry() — async', () => {
    it('succeeds on first attempt with no LLM calls', async () => {
      const llm = createMockLLM();
      const parser = new AutoFixParser({ parser: makePassthroughParser(), llm });
      await parser.parseWithRetry('hello');
      expect(llm.generate).not.toHaveBeenCalled();
    });

    it('calls LLM to fix and retries on initial failure', async () => {
      const llm = createMockLLM('fixed text');
      const innerParser = makeFailingParser(1); // fails once then succeeds
      const parser = new AutoFixParser({ parser: innerParser, llm, maxRetries: 3 });
      const result = await parser.parseWithRetry('broken');
      expect(llm.generate).toHaveBeenCalledTimes(1);
      expect(result).toBe('fixed text');
    });

    it('throws after exhausting all retries', async () => {
      const llm = createMockLLM('still broken');
      const parser = new AutoFixParser({
        parser: makeAlwaysFailParser(),
        llm,
        maxRetries: 2,
      });
      await expect(parser.parseWithRetry('broken')).rejects.toThrow();
    });

    it('succeeds without LLM when inner parser works', async () => {
      const parser = new AutoFixParser({ parser: makePassthroughParser() });
      const result = await parser.parseWithRetry('hello');
      expect(result).toBe('hello');
    });
  });

  describe('getFormatInstructions()', () => {
    it('delegates to the inner parser', () => {
      const parser = new AutoFixParser({ parser: makePassthroughParser() });
      expect(parser.getFormatInstructions()).toBe('Return a plain string.');
    });
  });
});
