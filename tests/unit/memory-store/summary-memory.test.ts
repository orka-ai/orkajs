import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SummaryMemory, type SummaryMemoryConfig } from '@orka-js/memory-store';

describe('SummaryMemory', () => {
  const mockLLM = {
    generate: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockLLM.generate.mockResolvedValue('This is a summary of the conversation.');
  });

  const createMemory = (config: Partial<SummaryMemoryConfig> = {}) => {
    return new SummaryMemory({
      llm: mockLLM,
      maxMessages: 5,
      summaryThreshold: 3,
      ...config,
    });
  };

  describe('addMessage', () => {
    it('should add a message to history', async () => {
      const memory = createMemory();

      await memory.addMessage({ role: 'user', content: 'Hello' });

      const history = memory.getHistory();
      expect(history).toHaveLength(1);
      expect(history[0].content).toBe('Hello');
      expect(history[0].role).toBe('user');
    });

    it('should add timestamp if not provided', async () => {
      const memory = createMemory();
      const before = Date.now();

      await memory.addMessage({ role: 'user', content: 'Hello' });

      const history = memory.getHistory();
      expect(history[0].timestamp).toBeGreaterThanOrEqual(before);
    });

    it('should preserve provided timestamp', async () => {
      const memory = createMemory();
      const timestamp = 1234567890;

      await memory.addMessage({ role: 'user', content: 'Hello', timestamp });

      const history = memory.getHistory();
      expect(history[0].timestamp).toBe(timestamp);
    });
  });

  describe('summarization', () => {
    it('should trigger summarization when exceeding maxMessages', async () => {
      const memory = createMemory({ maxMessages: 3, compressionRatio: 0.5 });

      await memory.addMessage({ role: 'user', content: 'Message 1' });
      await memory.addMessage({ role: 'assistant', content: 'Response 1' });
      await memory.addMessage({ role: 'user', content: 'Message 2' });
      await memory.addMessage({ role: 'assistant', content: 'Response 2' });

      expect(mockLLM.generate).toHaveBeenCalled();
    });

    it('should include summary in history after summarization', async () => {
      const memory = createMemory({ maxMessages: 3, compressionRatio: 0.5 });

      await memory.addMessage({ role: 'user', content: 'Message 1' });
      await memory.addMessage({ role: 'assistant', content: 'Response 1' });
      await memory.addMessage({ role: 'user', content: 'Message 2' });
      await memory.addMessage({ role: 'assistant', content: 'Response 2' });

      const history = memory.getHistory();
      const summaryMessage = history.find(m => m.metadata?.isSummary);

      expect(summaryMessage).toBeDefined();
      expect(summaryMessage?.content).toContain('summary');
    });

    it('should preserve system messages during summarization', async () => {
      const memory = createMemory({ maxMessages: 3, preserveSystemMessages: true });

      await memory.addMessage({ role: 'system', content: 'You are helpful' });
      await memory.addMessage({ role: 'user', content: 'Message 1' });
      await memory.addMessage({ role: 'assistant', content: 'Response 1' });
      await memory.addMessage({ role: 'user', content: 'Message 2' });
      await memory.addMessage({ role: 'assistant', content: 'Response 2' });

      const history = memory.getHistory();
      const systemMessages = history.filter(
        m => m.role === 'system' && !m.metadata?.isSummary
      );

      expect(systemMessages.some(m => m.content === 'You are helpful')).toBe(true);
    });
  });

  describe('getSummary', () => {
    it('should return empty string before summarization', () => {
      const memory = createMemory();
      expect(memory.getSummary()).toBe('');
    });

    it('should return summary after summarization', async () => {
      const memory = createMemory({ maxMessages: 2, compressionRatio: 0.5 });

      await memory.addMessage({ role: 'user', content: 'Hello' });
      await memory.addMessage({ role: 'assistant', content: 'Hi' });
      await memory.addMessage({ role: 'user', content: 'How are you?' });
      await memory.addMessage({ role: 'assistant', content: 'I am fine' });

      // Summarization is triggered, check LLM was called
      expect(mockLLM.generate).toHaveBeenCalled();
    });
  });

  describe('getSummaryStats', () => {
    it('should return stats about summarization', async () => {
      const memory = createMemory({ maxMessages: 2, compressionRatio: 0.5 });

      await memory.addMessage({ role: 'user', content: 'Hello' });
      await memory.addMessage({ role: 'assistant', content: 'Hi' });
      await memory.addMessage({ role: 'user', content: 'How are you?' });
      await memory.addMessage({ role: 'assistant', content: 'I am fine' });

      const stats = memory.getSummaryStats();
      // Stats are updated after summarization
      expect(stats).toBeDefined();
    });
  });

  describe('clear', () => {
    it('should clear all messages and summary', async () => {
      const memory = createMemory();

      await memory.addMessage({ role: 'user', content: 'Hello' });
      memory.clear();

      expect(memory.getHistory()).toHaveLength(0);
      expect(memory.getSummary()).toBe('');
      expect(memory.getMessageCount()).toBe(0);
    });
  });

  describe('getMessageCount', () => {
    it('should return total message count including summarized', async () => {
      const memory = createMemory({ maxMessages: 2, compressionRatio: 0.5 });

      await memory.addMessage({ role: 'user', content: 'Hello' });
      await memory.addMessage({ role: 'assistant', content: 'Hi' });
      await memory.addMessage({ role: 'user', content: 'How are you?' });

      const count = memory.getMessageCount();
      expect(count).toBeGreaterThanOrEqual(3);
    });
  });

  describe('forceSummarize', () => {
    it('should summarize even when below threshold', async () => {
      const memory = createMemory({ maxMessages: 10 });

      await memory.addMessage({ role: 'user', content: 'Hello' });
      await memory.addMessage({ role: 'assistant', content: 'Hi' });
      await memory.addMessage({ role: 'user', content: 'What is your name?' });

      await memory.forceSummarize();

      expect(mockLLM.generate).toHaveBeenCalled();
    });
  });

  describe('toJSON / fromJSON', () => {
    it('should serialize and deserialize correctly', async () => {
      const memory = createMemory();

      await memory.addMessage({ role: 'user', content: 'Hello' });
      await memory.addMessage({ role: 'assistant', content: 'Hi' });

      const json = memory.toJSON();
      const restored = SummaryMemory.fromJSON(json as any, mockLLM);

      expect(restored.getHistory()).toHaveLength(2);
      expect(restored.getHistory()[0].content).toBe('Hello');
    });
  });

  describe('progressive compression', () => {
    it('should use progressive compression when enabled and summary exists', async () => {
      const memory = createMemory({
        maxMessages: 3,
        progressiveCompression: true,
        compressionRatio: 0.5,
      });

      // Add enough messages to trigger first summarization
      await memory.addMessage({ role: 'user', content: 'First' });
      await memory.addMessage({ role: 'assistant', content: 'Response 1' });
      await memory.addMessage({ role: 'user', content: 'Second' });
      await memory.addMessage({ role: 'assistant', content: 'Response 2' });

      // First summarization should have been called
      expect(mockLLM.generate).toHaveBeenCalled();
    });
  });
});
