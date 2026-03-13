import type { Message } from './memory.js';
import type { BaseEmbeddings, BaseVectorDB, MemoryVectorSearchResult, MemorySearchResult } from './types.js';

export interface VectorMemoryConfig {
  embeddings: BaseEmbeddings;
  vectorDB: BaseVectorDB;
  maxMessages?: number;
  searchTopK?: number;
  similarityThreshold?: number;
  chunkSize?: number;
  includeMetadata?: boolean;
}

interface StoredMessage extends Message {
  id: string;
  embedding?: number[];
}

export class VectorMemory {
  private messages: StoredMessage[] = [];
  private config: Required<VectorMemoryConfig>;
  private messageIdCounter: number = 0;

  constructor(config: VectorMemoryConfig) {
    this.config = {
      embeddings: config.embeddings,
      vectorDB: config.vectorDB,
      maxMessages: config.maxMessages ?? 100,
      searchTopK: config.searchTopK ?? 5,
      similarityThreshold: config.similarityThreshold ?? 0.7,
      chunkSize: config.chunkSize ?? 3,
      includeMetadata: config.includeMetadata ?? true,
    };
  }

  async addMessage(message: Message): Promise<string> {
    const id = this.generateId();
    const storedMessage: StoredMessage = {
      ...message,
      id,
      timestamp: message.timestamp ?? Date.now(),
    };

    this.messages.push(storedMessage);

    const embedding = await this.config.embeddings.embed(message.content);
    storedMessage.embedding = embedding;

    const metadata: Record<string, unknown> = {
      role: message.role,
      timestamp: storedMessage.timestamp,
      messageId: id,
    };

    if (this.config.includeMetadata && message.metadata) {
      Object.assign(metadata, message.metadata);
    }

    await this.config.vectorDB.add(
      [embedding],
      [message.content],
      [metadata]
    );

    await this.trimIfNeeded();

    return id;
  }

  async addMessages(messages: Message[]): Promise<string[]> {
    const ids: string[] = [];
    const storedMessages: StoredMessage[] = [];
    const contents: string[] = [];

    for (const message of messages) {
      const id = this.generateId();
      ids.push(id);

      const storedMessage: StoredMessage = {
        ...message,
        id,
        timestamp: message.timestamp ?? Date.now(),
      };
      storedMessages.push(storedMessage);
      contents.push(message.content);
    }

    const embeddings = await this.config.embeddings.embedBatch(contents);

    const metadataList: Record<string, unknown>[] = [];
    for (let i = 0; i < storedMessages.length; i++) {
      storedMessages[i].embedding = embeddings[i];
      this.messages.push(storedMessages[i]);

      const metadata: Record<string, unknown> = {
        role: messages[i].role,
        timestamp: storedMessages[i].timestamp,
        messageId: ids[i],
      };

      if (this.config.includeMetadata && messages[i].metadata) {
        Object.assign(metadata, messages[i].metadata);
      }

      metadataList.push(metadata);
    }

    await this.config.vectorDB.add(embeddings, contents, metadataList);

    await this.trimIfNeeded();

    return ids;
  }

  async search(query: string, topK?: number): Promise<MemorySearchResult[]> {
    const k = topK ?? this.config.searchTopK;
    const queryEmbedding = await this.config.embeddings.embed(query);

    const results = await this.config.vectorDB.search(queryEmbedding, k);

    return results
      .filter(r => r.score >= this.config.similarityThreshold)
      .map(r => this.resultToMemorySearch(r));
  }

  async searchWithContext(query: string, topK?: number): Promise<MemorySearchResult[]> {
    const k = topK ?? this.config.searchTopK;
    const queryEmbedding = await this.config.embeddings.embed(query);

    const results = await this.config.vectorDB.search(queryEmbedding, k);

    const enrichedResults: MemorySearchResult[] = [];

    for (const result of results) {
      if (result.score < this.config.similarityThreshold) continue;

      const messageId = result.metadata?.messageId as string | undefined;
      if (!messageId) {
        enrichedResults.push(this.resultToMemorySearch(result));
        continue;
      }

      const messageIndex = this.messages.findIndex(m => m.id === messageId);
      if (messageIndex === -1) {
        enrichedResults.push(this.resultToMemorySearch(result));
        continue;
      }

      const contextStart = Math.max(0, messageIndex - this.config.chunkSize);
      const contextEnd = Math.min(this.messages.length, messageIndex + this.config.chunkSize + 1);
      const contextMessages = this.messages.slice(contextStart, contextEnd);

      const contextText = contextMessages
        .map(m => `${m.role}: ${m.content}`)
        .join('\n');

      enrichedResults.push({
        messages: contextMessages.map(m => ({
          role: m.role,
          content: m.content,
          timestamp: m.timestamp,
          metadata: m.metadata,
        })),
        score: result.score,
        context: contextText,
      });
    }

    return enrichedResults;
  }

  getHistory(): Message[] {
    return this.messages.map(m => ({
      role: m.role,
      content: m.content,
      timestamp: m.timestamp,
      metadata: m.metadata,
    }));
  }

  getRecentMessages(count: number): Message[] {
    return this.messages.slice(-count).map(m => ({
      role: m.role,
      content: m.content,
      timestamp: m.timestamp,
      metadata: m.metadata,
    }));
  }

  async getRelevantHistory(query: string, maxMessages?: number): Promise<Message[]> {
    const results = await this.searchWithContext(query, maxMessages ?? this.config.searchTopK);

    const uniqueMessages = new Map<string, Message>();

    for (const result of results) {
      for (const msg of result.messages) {
        const key = `${msg.timestamp}-${msg.role}`;
        if (!uniqueMessages.has(key)) {
          uniqueMessages.set(key, msg);
        }
      }
    }

    return Array.from(uniqueMessages.values())
      .sort((a, b) => (a.timestamp ?? 0) - (b.timestamp ?? 0));
  }

  async clear(): Promise<void> {
    const ids = this.messages.map(m => m.id);
    if (ids.length > 0) {
      await this.config.vectorDB.delete(ids);
    }
    this.messages = [];
  }

  getMessageCount(): number {
    return this.messages.length;
  }

  private generateId(): string {
    return `msg_${Date.now()}_${this.messageIdCounter++}`;
  }

  private async trimIfNeeded(): Promise<void> {
    if (this.messages.length <= this.config.maxMessages) return;

    const overflow = this.messages.length - this.config.maxMessages;
    const toRemove = this.messages.slice(0, overflow);
    const idsToRemove = toRemove.map(m => m.id);

    await this.config.vectorDB.delete(idsToRemove);

    this.messages = this.messages.slice(overflow);
  }

  private resultToMemorySearch(result: MemoryVectorSearchResult): MemorySearchResult {
    const message: Message = {
      role: (result.metadata?.role as Message['role']) ?? 'user',
      content: result.document,
      timestamp: result.metadata?.timestamp as number | undefined,
      metadata: result.metadata,
    };

    return {
      messages: [message],
      score: result.score,
    };
  }

  toJSON(): object {
    return {
      messages: this.messages.map(m => ({
        id: m.id,
        role: m.role,
        content: m.content,
        timestamp: m.timestamp,
        metadata: m.metadata,
      })),
      config: {
        maxMessages: this.config.maxMessages,
        searchTopK: this.config.searchTopK,
        similarityThreshold: this.config.similarityThreshold,
        chunkSize: this.config.chunkSize,
        includeMetadata: this.config.includeMetadata,
      },
    };
  }
}
