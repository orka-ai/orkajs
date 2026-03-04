export interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp?: number;
  metadata?: Record<string, unknown>;
}

export interface MemoryConfig {
  maxMessages?: number;
  maxTokensEstimate?: number;
  strategy?: 'sliding_window' | 'summary' | 'buffer';
  summaryThreshold?: number;
}

export class Memory {
  private messages: Message[] = [];
  private config: MemoryConfig;
  private summaryBuffer: string = '';

  constructor(config: MemoryConfig = {}) {
    this.config = {
      maxMessages: config.maxMessages ?? 50,
      maxTokensEstimate: config.maxTokensEstimate ?? 4000,
      strategy: config.strategy ?? 'sliding_window',
      summaryThreshold: config.summaryThreshold ?? 10,
    };
  }

  addMessage(message: Message): void {
    this.messages.push({
      ...message,
      timestamp: message.timestamp ?? Date.now(),
    });
    this.trim();
  }

  getHistory(): Message[] {
    return [...this.messages];
  }

  getFormattedHistory(): string {
    return this.messages
      .map(m => `${m.role}: ${m.content}`)
      .join('\n');
  }

  getLastMessages(count: number): Message[] {
    return this.messages.slice(-count);
  }

  clear(): void {
    this.messages = [];
  }

  getMessageCount(): number {
    return this.messages.length;
  }

  private trim(): void {
    switch (this.config.strategy) {
      case 'sliding_window':
        this.trimSlidingWindow();
        break;
      case 'buffer':
        this.trimBuffer();
        break;
      case 'summary':
        this.trimSummary();
        break;
    }
  }

  private trimSlidingWindow(): void {
    const max = this.config.maxMessages ?? 50;
    if (this.messages.length > max) {
      const systemMessages = this.messages.filter(m => m.role === 'system');
      const nonSystemMessages = this.messages.filter(m => m.role !== 'system');
      
      const trimmed = nonSystemMessages.slice(-(max - systemMessages.length));
      this.messages = [...systemMessages, ...trimmed];
    }
  }

  private trimBuffer(): void {
    const maxTokens = this.config.maxTokensEstimate ?? 4000;
    let estimatedTokens = 0;
    const kept: Message[] = [];

    for (let i = this.messages.length - 1; i >= 0; i--) {
      const msgTokens = Math.ceil(this.messages[i].content.length / 4);
      if (estimatedTokens + msgTokens > maxTokens && kept.length > 0) {
        break;
      }
      estimatedTokens += msgTokens;
      kept.unshift(this.messages[i]);
    }

    this.messages = kept;
  }

  private trimSummary(): void {
    const max = this.config.maxMessages ?? 50;
    const threshold = this.config.summaryThreshold ?? 10;

    if (this.messages.length <= max) return;

    const overflow = this.messages.length - max + threshold;
    const toSummarize = this.messages
      .filter(m => m.role !== 'system')
      .slice(0, overflow);

    if (toSummarize.length === 0) return;

    const summaryLines = toSummarize.map(m => {
      const prefix = m.role === 'user' ? 'User' : 'Assistant';
      const truncated = m.content.length > 200 ? m.content.slice(0, 200) + '...' : m.content;
      return `- ${prefix}: ${truncated}`;
    });

    const newSummary = this.summaryBuffer
      ? `${this.summaryBuffer}\n${summaryLines.join('\n')}`
      : summaryLines.join('\n');

    const maxSummaryLength = 2000;
    this.summaryBuffer = newSummary.length > maxSummaryLength
      ? newSummary.slice(-maxSummaryLength)
      : newSummary;

    const existingSystem = this.messages.filter(m => m.role === 'system' && !m.metadata?.isSummary);
    const remaining = this.messages
      .filter(m => m.role !== 'system')
      .slice(overflow);

    const summaryMessage: Message = {
      role: 'system',
      content: `[Summary of previous conversation]\n${this.summaryBuffer}`,
      timestamp: Date.now(),
      metadata: { isSummary: true },
    };

    this.messages = [...existingSystem, summaryMessage, ...remaining];
  }

  getSummary(): string {
    return this.summaryBuffer;
  }
}
