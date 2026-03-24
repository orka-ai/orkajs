import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SummaryMemory, type CompressResult } from '@orka-js/memory-store';

describe('SummaryMemory.compress()', () => {
  const mockLLM = {
    generate: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockLLM.generate.mockResolvedValue('This is a summary of the conversation.');
  });

  describe('successful compression', () => {
    it('should compress messages and return CompressResult', async () => {
      const memory = new SummaryMemory({
        llm: mockLLM,
        maxMessages: 100, // High limit to prevent auto-compression
      });

      // Add several messages
      await memory.addMessage({ role: 'user', content: 'Hello, how are you?' });
      await memory.addMessage({ role: 'assistant', content: 'I am doing well, thank you!' });
      await memory.addMessage({ role: 'user', content: 'Can you help me with a task?' });
      await memory.addMessage({ role: 'assistant', content: 'Of course! What do you need help with?' });

      const result = await memory.compress();

      expect(result.success).toBe(true);
      expect(result.messagesCompressed).toBe(4);
      expect(result.tokensSaved).toBeGreaterThan(0);
      expect(result.summary).toBe('This is a summary of the conversation.');
      expect(result.compressedAt).toBeDefined();
      expect(mockLLM.generate).toHaveBeenCalledTimes(1);
    });

    it('should preserve system messages after compression', async () => {
      const memory = new SummaryMemory({
        llm: mockLLM,
        maxMessages: 100,
        preserveSystemMessages: true,
      });

      await memory.addMessage({ role: 'system', content: 'You are a helpful assistant.' });
      await memory.addMessage({ role: 'user', content: 'Hello!' });
      await memory.addMessage({ role: 'assistant', content: 'Hi there!' });

      await memory.compress();

      const history = memory.getHistory();
      const systemMessages = history.filter(m => m.role === 'system' && !m.metadata?.isSummary);
      expect(systemMessages.length).toBe(1);
      expect(systemMessages[0].content).toBe('You are a helpful assistant.');
    });

    it('should include summary in history after compression', async () => {
      const memory = new SummaryMemory({
        llm: mockLLM,
        maxMessages: 100,
      });

      await memory.addMessage({ role: 'user', content: 'First message' });
      await memory.addMessage({ role: 'assistant', content: 'First response' });

      await memory.compress();

      const history = memory.getHistory();
      const summaryMessage = history.find(m => m.metadata?.isSummary);
      expect(summaryMessage).toBeDefined();
      expect(summaryMessage?.content).toContain('This is a summary of the conversation.');
    });
  });

  describe('compression edge cases', () => {
    it('should return failure when not enough messages to compress', async () => {
      const memory = new SummaryMemory({
        llm: mockLLM,
        maxMessages: 100,
      });

      await memory.addMessage({ role: 'user', content: 'Single message' });

      const result = await memory.compress();

      expect(result.success).toBe(false);
      expect(result.reason).toBe('Not enough messages to compress');
      expect(result.messagesCompressed).toBe(0);
      expect(mockLLM.generate).not.toHaveBeenCalled();
    });

    it('should return failure when compression is already in progress', async () => {
      const memory = new SummaryMemory({
        llm: mockLLM,
        maxMessages: 100,
      });

      // Simulate slow LLM response
      mockLLM.generate.mockImplementation(async () => {
        await new Promise(resolve => setTimeout(resolve, 100));
        return 'Summary';
      });

      await memory.addMessage({ role: 'user', content: 'Message 1' });
      await memory.addMessage({ role: 'assistant', content: 'Response 1' });

      // Start first compression (don't await)
      const firstCompress = memory.compress();

      // Try second compression immediately
      const secondResult = await memory.compress();

      expect(secondResult.success).toBe(false);
      expect(secondResult.reason).toBe('Compression already in progress');

      // Wait for first to complete
      await firstCompress;
    });

    it('should handle LLM errors gracefully', async () => {
      const memory = new SummaryMemory({
        llm: mockLLM,
        maxMessages: 100,
      });

      mockLLM.generate.mockRejectedValue(new Error('LLM API error'));

      await memory.addMessage({ role: 'user', content: 'Message 1' });
      await memory.addMessage({ role: 'assistant', content: 'Response 1' });

      const result = await memory.compress();

      expect(result.success).toBe(false);
      expect(result.reason).toContain('Compression failed');
      expect(result.reason).toContain('LLM API error');
    });
  });

  describe('progressive compression', () => {
    it('should use progressive prompt when existing summary exists', async () => {
      const memory = new SummaryMemory({
        llm: mockLLM,
        maxMessages: 100,
        progressiveCompression: true,
      });

      // First compression
      await memory.addMessage({ role: 'user', content: 'First topic discussion' });
      await memory.addMessage({ role: 'assistant', content: 'First response' });
      await memory.compress();

      // Add more messages
      await memory.addMessage({ role: 'user', content: 'Second topic' });
      await memory.addMessage({ role: 'assistant', content: 'Second response' });

      // Second compression should use progressive prompt
      await memory.compress();

      expect(mockLLM.generate).toHaveBeenCalledTimes(2);
      const secondCall = mockLLM.generate.mock.calls[1][0];
      expect(secondCall).toContain('EXISTING SUMMARY');
    });
  });

  describe('token estimation', () => {
    it('should estimate tokens saved correctly', async () => {
      const memory = new SummaryMemory({
        llm: mockLLM,
        maxMessages: 100,
      });

      // Add long messages
      const longContent = 'A'.repeat(400); // ~100 tokens
      await memory.addMessage({ role: 'user', content: longContent });
      await memory.addMessage({ role: 'assistant', content: longContent });

      // Short summary
      mockLLM.generate.mockResolvedValue('Brief summary.');

      const result = await memory.compress();

      expect(result.tokensSaved).toBeGreaterThan(100);
    });
  });
});
