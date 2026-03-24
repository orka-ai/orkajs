import type { Message } from './memory.js';
import type { BaseLLM } from './types.js';

export interface SummaryMemoryConfig {
  llm: BaseLLM;
  maxMessages?: number;
  summaryThreshold?: number;
  summaryMaxLength?: number;
  preserveSystemMessages?: boolean;
  progressiveCompression?: boolean;
  compressionRatio?: number;
}

/**
 * Result of a compression operation.
 * Used by the compress() method for autonomous context compression.
 */
export interface CompressResult {
  /** Whether the compression was successful */
  success: boolean;
  /** Reason for the result (success message or error) */
  reason: string;
  /** Generated summary of compressed messages */
  summary: string;
  /** Number of messages that were compressed */
  messagesCompressed: number;
  /** Estimated tokens saved by the compression */
  tokensSaved: number;
  /** Timestamp when compression occurred */
  compressedAt: number;
}

interface SummaryState {
  summary: string;
  messageCount: number;
  lastSummarizedAt: number;
}

const DEFAULT_SUMMARY_PROMPT = `Summarize the following conversation concisely, preserving key information, decisions, and context that would be important for continuing the conversation:

{conversation}

Summary:`;

const PROGRESSIVE_SUMMARY_PROMPT = `You have an existing summary of a conversation:

EXISTING SUMMARY:
{existing_summary}

NEW MESSAGES:
{new_messages}

Create an updated summary that incorporates the new messages while maintaining the most important context. Be concise but preserve critical information.

Updated Summary:`;

export class SummaryMemory {
  private messages: Message[] = [];
  private summaryState: SummaryState = {
    summary: '',
    messageCount: 0,
    lastSummarizedAt: 0,
  };
  private config: Required<SummaryMemoryConfig>;
  private isSummarizing: boolean = false;

  constructor(config: SummaryMemoryConfig) {
    this.config = {
      llm: config.llm,
      maxMessages: config.maxMessages ?? 20,
      summaryThreshold: config.summaryThreshold ?? 10,
      summaryMaxLength: config.summaryMaxLength ?? 1000,
      preserveSystemMessages: config.preserveSystemMessages ?? true,
      progressiveCompression: config.progressiveCompression ?? true,
      compressionRatio: config.compressionRatio ?? 0.5,
    };
  }

  async addMessage(message: Message): Promise<void> {
    this.messages.push({
      ...message,
      timestamp: message.timestamp ?? Date.now(),
    });

    if (this.shouldSummarize()) {
      await this.summarize();
    }
  }

  async addMessages(messages: Message[]): Promise<void> {
    for (const message of messages) {
      this.messages.push({
        ...message,
        timestamp: message.timestamp ?? Date.now(),
      });
    }

    if (this.shouldSummarize()) {
      await this.summarize();
    }
  }

  getHistory(): Message[] {
    const result: Message[] = [];

    if (this.summaryState.summary) {
      result.push({
        role: 'system',
        content: `[Previous conversation summary]\n${this.summaryState.summary}`,
        timestamp: this.summaryState.lastSummarizedAt,
        metadata: { isSummary: true, messageCount: this.summaryState.messageCount },
      });
    }

    if (this.config.preserveSystemMessages) {
      const systemMessages = this.messages.filter(
        m => m.role === 'system' && !m.metadata?.isSummary
      );
      result.push(...systemMessages);
    }

    const recentMessages = this.messages.filter(
      m => m.role !== 'system' || m.metadata?.isSummary
    );
    result.push(...recentMessages);

    return result;
  }

  getRecentMessages(): Message[] {
    return [...this.messages];
  }

  getSummary(): string {
    return this.summaryState.summary;
  }

  getSummaryStats(): { summary: string; messageCount: number; lastSummarizedAt: number } {
    return { ...this.summaryState };
  }

  clear(): void {
    this.messages = [];
    this.summaryState = {
      summary: '',
      messageCount: 0,
      lastSummarizedAt: 0,
    };
  }

  getMessageCount(): number {
    return this.messages.length + this.summaryState.messageCount;
  }

  private shouldSummarize(): boolean {
    if (this.isSummarizing) return false;

    const nonSystemMessages = this.messages.filter(
      m => m.role !== 'system' || m.metadata?.isSummary
    );

    return nonSystemMessages.length > this.config.maxMessages;
  }

  private async summarize(): Promise<void> {
    if (this.isSummarizing) return;
    this.isSummarizing = true;

    try {
      const nonSystemMessages = this.messages.filter(
        m => m.role !== 'system' || m.metadata?.isSummary
      );

      const messagesToSummarize = Math.floor(
        nonSystemMessages.length * this.config.compressionRatio
      );

      if (messagesToSummarize < 2) {
        this.isSummarizing = false;
        return;
      }

      const toSummarize = nonSystemMessages.slice(0, messagesToSummarize);
      const toKeep = nonSystemMessages.slice(messagesToSummarize);

      let prompt: string;

      if (this.config.progressiveCompression && this.summaryState.summary) {
        const newMessagesText = this.formatMessages(toSummarize);
        prompt = PROGRESSIVE_SUMMARY_PROMPT
          .replace('{existing_summary}', this.summaryState.summary)
          .replace('{new_messages}', newMessagesText);
      } else {
        const allToSummarize = this.summaryState.summary
          ? `[Previous summary: ${this.summaryState.summary}]\n\n${this.formatMessages(toSummarize)}`
          : this.formatMessages(toSummarize);

        prompt = DEFAULT_SUMMARY_PROMPT.replace('{conversation}', allToSummarize);
      }

      const summary = await this.config.llm.generate(prompt);

      const trimmedSummary = summary.length > this.config.summaryMaxLength
        ? summary.slice(0, this.config.summaryMaxLength) + '...'
        : summary;

      this.summaryState = {
        summary: trimmedSummary,
        messageCount: this.summaryState.messageCount + toSummarize.length,
        lastSummarizedAt: Date.now(),
      };

      const systemMessages = this.config.preserveSystemMessages
        ? this.messages.filter(m => m.role === 'system' && !m.metadata?.isSummary)
        : [];

      this.messages = [...systemMessages, ...toKeep];
    } finally {
      this.isSummarizing = false;
    }
  }

  private formatMessages(messages: Message[]): string {
    return messages
      .map(m => {
        const role = m.role === 'user' ? 'User' : m.role === 'assistant' ? 'Assistant' : 'System';
        return `${role}: ${m.content}`;
      })
      .join('\n\n');
  }

  async forceSummarize(): Promise<void> {
    await this.compress();
  }

  /**
   * Compress the conversation history on demand.
   * This method is designed to be called by agents autonomously
   * when they decide the context needs compression.
   * 
   * @returns CompressResult with details about the compression
   */
  async compress(): Promise<CompressResult> {
    const nonSystemMessages = this.messages.filter(
      m => m.role !== 'system' || m.metadata?.isSummary
    );

    if (nonSystemMessages.length < 2) {
      return {
        success: false,
        reason: 'Not enough messages to compress',
        summary: this.summaryState.summary,
        messagesCompressed: 0,
        tokensSaved: 0,
        compressedAt: Date.now(),
      };
    }

    if (this.isSummarizing) {
      return {
        success: false,
        reason: 'Compression already in progress',
        summary: this.summaryState.summary,
        messagesCompressed: 0,
        tokensSaved: 0,
        compressedAt: Date.now(),
      };
    }

    this.isSummarizing = true;
    const messageCountBefore = nonSystemMessages.length;

    try {
      const toSummarize = nonSystemMessages;
      
      const prompt = this.summaryState.summary
        ? PROGRESSIVE_SUMMARY_PROMPT
            .replace('{existing_summary}', this.summaryState.summary)
            .replace('{new_messages}', this.formatMessages(toSummarize))
        : DEFAULT_SUMMARY_PROMPT.replace('{conversation}', this.formatMessages(toSummarize));

      const summary = await this.config.llm.generate(prompt);

      const trimmedSummary = summary.length > this.config.summaryMaxLength
        ? summary.slice(0, this.config.summaryMaxLength) + '...'
        : summary;

      // Estimate tokens saved (rough estimate: 4 chars per token)
      const originalTokens = toSummarize.reduce(
        (acc, m) => acc + Math.ceil(m.content.length / 4),
        0
      );
      const summaryTokens = Math.ceil(trimmedSummary.length / 4);
      const tokensSaved = Math.max(0, originalTokens - summaryTokens);

      this.summaryState = {
        summary: trimmedSummary,
        messageCount: this.summaryState.messageCount + toSummarize.length,
        lastSummarizedAt: Date.now(),
      };

      const systemMessages = this.config.preserveSystemMessages
        ? this.messages.filter(m => m.role === 'system' && !m.metadata?.isSummary)
        : [];

      this.messages = [...systemMessages];

      return {
        success: true,
        reason: 'Compression completed successfully',
        summary: trimmedSummary,
        messagesCompressed: messageCountBefore,
        tokensSaved,
        compressedAt: Date.now(),
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        success: false,
        reason: `Compression failed: ${errorMessage}`,
        summary: this.summaryState.summary,
        messagesCompressed: 0,
        tokensSaved: 0,
        compressedAt: Date.now(),
      };
    } finally {
      this.isSummarizing = false;
    }
  }

  toJSON(): object {
    return {
      messages: this.messages,
      summaryState: this.summaryState,
      config: {
        maxMessages: this.config.maxMessages,
        summaryThreshold: this.config.summaryThreshold,
        summaryMaxLength: this.config.summaryMaxLength,
        preserveSystemMessages: this.config.preserveSystemMessages,
        progressiveCompression: this.config.progressiveCompression,
        compressionRatio: this.config.compressionRatio,
      },
    };
  }

  static fromJSON(
    data: { messages: Message[]; summaryState: SummaryState; config: Partial<SummaryMemoryConfig> },
    llm: BaseLLM
  ): SummaryMemory {
    const memory = new SummaryMemory({ llm, ...data.config });
    memory.messages = data.messages;
    memory.summaryState = data.summaryState;
    return memory;
  }
}
