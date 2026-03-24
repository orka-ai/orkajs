import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createCompactConversationTool, COMPACT_CONVERSATION_PROMPT_ADDITION } from '@orka-js/agent';

describe('createCompactConversationTool', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('tool creation', () => {
    it('should create a tool with correct name and description', () => {
      const tool = createCompactConversationTool({
        compress: vi.fn(),
      });

      expect(tool.name).toBe('compact_conversation');
      expect(tool.description).toContain('Compress the conversation history');
      expect(tool.parameters).toBeDefined();
      expect(tool.parameters?.length).toBe(1);
      expect(tool.parameters?.[0].name).toBe('reason');
    });

    it('should have required reason parameter', () => {
      const tool = createCompactConversationTool({
        compress: vi.fn(),
      });

      const reasonParam = tool.parameters?.find(p => p.name === 'reason');
      expect(reasonParam).toBeDefined();
      expect(reasonParam?.type).toBe('string');
      expect(reasonParam?.required).toBe(true);
    });
  });

  describe('tool execution', () => {
    it('should call compress function and return success result', async () => {
      const mockCompress = vi.fn().mockResolvedValue({
        success: true,
        reason: 'Compression completed',
        summary: 'User asked about weather. Assistant provided forecast.',
        messagesCompressed: 5,
        tokensSaved: 250,
        compressedAt: Date.now(),
      });

      const tool = createCompactConversationTool({
        compress: mockCompress,
      });

      const result = await tool.execute({ reason: 'switching to new task' });

      expect(mockCompress).toHaveBeenCalledTimes(1);
      expect(result.output).toContain('Conversation compressed successfully');
      expect(result.output).toContain('switching to new task');
      expect(result.output).toContain('Messages compressed:** 5');
      expect(result.output).toContain('tokens saved:** ~250');
      expect(result.metadata?.success).toBe(true);
    });

    it('should handle compression skip gracefully', async () => {
      const mockCompress = vi.fn().mockResolvedValue({
        success: false,
        reason: 'Not enough messages to compress',
        summary: '',
        messagesCompressed: 0,
        tokensSaved: 0,
        compressedAt: Date.now(),
      });

      const tool = createCompactConversationTool({
        compress: mockCompress,
      });

      const result = await tool.execute({ reason: 'test' });

      expect(result.output).toContain('Compression skipped');
      expect(result.output).toContain('Not enough messages');
      expect(result.metadata?.success).toBe(false);
    });

    it('should handle compression errors', async () => {
      const mockCompress = vi.fn().mockRejectedValue(new Error('LLM API failed'));

      const tool = createCompactConversationTool({
        compress: mockCompress,
      });

      const result = await tool.execute({ reason: 'test' });

      expect(result.output).toContain('Failed to compress');
      expect(result.output).toContain('LLM API failed');
      expect(result.error).toBe('LLM API failed');
      expect(result.metadata?.success).toBe(false);
    });

    it('should include summary in output', async () => {
      const summaryText = 'The user discussed project requirements and deadlines.';
      const mockCompress = vi.fn().mockResolvedValue({
        success: true,
        reason: 'OK',
        summary: summaryText,
        messagesCompressed: 10,
        tokensSaved: 500,
        compressedAt: Date.now(),
      });

      const tool = createCompactConversationTool({
        compress: mockCompress,
      });

      const result = await tool.execute({ reason: 'context getting long' });

      expect(result.output).toContain(summaryText);
      expect(result.metadata?.summary).toBe(summaryText);
    });
  });

  describe('COMPACT_CONVERSATION_PROMPT_ADDITION', () => {
    it('should contain guidance for when to use the tool', () => {
      expect(COMPACT_CONVERSATION_PROMPT_ADDITION).toContain('compact_conversation');
      expect(COMPACT_CONVERSATION_PROMPT_ADDITION).toContain('proactively');
      expect(COMPACT_CONVERSATION_PROMPT_ADDITION).toContain('lengthy');
      expect(COMPACT_CONVERSATION_PROMPT_ADDITION).toContain('new task');
    });
  });
});

describe('Integration: SummaryMemory + CompactConversationTool', () => {
  it('should work together for autonomous compression', async () => {
    // This test demonstrates the intended usage pattern
    const mockLLM = {
      generate: vi.fn().mockResolvedValue('Summary: User asked about AI, assistant explained concepts.'),
    };

    // Simulate SummaryMemory behavior
    let messages = [
      { role: 'user', content: 'What is AI?' },
      { role: 'assistant', content: 'AI stands for Artificial Intelligence...' },
      { role: 'user', content: 'How does machine learning work?' },
      { role: 'assistant', content: 'Machine learning is a subset of AI...' },
    ];
    let summary = '';

    const tool = createCompactConversationTool({
      compress: async () => {
        const messageCount = messages.length;
        summary = await mockLLM.generate('Summarize...');
        messages = []; // Clear after compression
        return {
          success: true,
          reason: 'Compressed',
          summary,
          messagesCompressed: messageCount,
          tokensSaved: messageCount * 50,
          compressedAt: Date.now(),
        };
      },
    });

    const result = await tool.execute({ reason: 'Starting new topic' });

    expect(result.metadata?.success).toBe(true);
    expect(result.metadata?.messagesCompressed).toBe(4);
    expect(messages.length).toBe(0); // Messages cleared
    expect(summary).toContain('Summary');
  });
});
