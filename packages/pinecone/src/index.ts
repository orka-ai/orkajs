import type { 
  VectorDBAdapter, 
  VectorRecord, 
  VectorSearchOptions, 
  VectorSearchResult,
  CreateCollectionOptions 
} from '@orkajs/core';

export interface PineconeAdapterConfig {
  apiKey: string;
  environment?: string;
  indexHost: string;
}

export class PineconeAdapter implements VectorDBAdapter {
  readonly name = 'pinecone';
  private apiKey: string;
  private indexHost: string;

  constructor(config: PineconeAdapterConfig) {
    this.apiKey = config.apiKey;
    this.indexHost = config.indexHost;
  }

  async createCollection(_name: string, _options: CreateCollectionOptions = {}): Promise<void> {
    const response = await fetch(`${this.indexHost}/describe_index_stats`, {
      method: 'POST',
      headers: {
        'Api-Key': this.apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({}),
    });

    if (!response.ok && response.status !== 404) {
      const error = await response.text();
      throw new Error(`Pinecone error: ${response.status} - ${error}`);
    }
  }

  async deleteCollection(name: string): Promise<void> {
    await fetch(`${this.indexHost}/vectors/delete`, {
      method: 'POST',
      headers: {
        'Api-Key': this.apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        namespace: name,
        deleteAll: true,
      }),
    });
  }

  async upsert(collection: string, vectors: VectorRecord[]): Promise<void> {
    const pineconeVectors = vectors.map(v => ({
      id: v.id,
      values: v.vector,
      metadata: {
        ...v.metadata,
        _content: v.content,
      },
    }));

    const response = await fetch(`${this.indexHost}/vectors/upsert`, {
      method: 'POST',
      headers: {
        'Api-Key': this.apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        vectors: pineconeVectors,
        namespace: collection,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Pinecone upsert error: ${response.status} - ${error}`);
    }
  }

  async search(collection: string, vector: number[], options: VectorSearchOptions = {}): Promise<VectorSearchResult[]> {
    const { topK = 5, filter } = options;

    const response = await fetch(`${this.indexHost}/query`, {
      method: 'POST',
      headers: {
        'Api-Key': this.apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        vector,
        topK,
        namespace: collection,
        includeMetadata: true,
        filter,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Pinecone query error: ${response.status} - ${error}`);
    }

    const data = await response.json() as {
      matches: Array<{
        id: string;
        score: number;
        metadata?: Record<string, unknown>;
      }>;
    };

    return data.matches.map(match => {
      const { _content, ...metadata } = (match.metadata ?? {}) as { _content?: string; [key: string]: unknown };
      return {
        id: match.id,
        score: match.score,
        metadata,
        content: _content as string | undefined,
      };
    });
  }

  async delete(collection: string, ids: string[]): Promise<void> {
    const response = await fetch(`${this.indexHost}/vectors/delete`, {
      method: 'POST',
      headers: {
        'Api-Key': this.apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        ids,
        namespace: collection,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Pinecone delete error: ${response.status} - ${error}`);
    }
  }
}
