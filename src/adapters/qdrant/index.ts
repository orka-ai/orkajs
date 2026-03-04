import type { 
  VectorDBAdapter, 
  VectorRecord, 
  VectorSearchOptions, 
  VectorSearchResult,
  CreateCollectionOptions 
} from '../../types/index.js';

export interface QdrantAdapterConfig {
  url: string;
  apiKey?: string;
}

export class QdrantAdapter implements VectorDBAdapter {
  readonly name = 'qdrant';
  private url: string;
  private apiKey?: string;

  constructor(config: QdrantAdapterConfig) {
    this.url = config.url.replace(/\/$/, '');
    this.apiKey = config.apiKey;
  }

  private getHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (this.apiKey) {
      headers['api-key'] = this.apiKey;
    }
    return headers;
  }

  async createCollection(name: string, options: CreateCollectionOptions = {}): Promise<void> {
    const { dimension = 1536, metric = 'cosine' } = options;

    const distanceMap = {
      cosine: 'Cosine',
      euclidean: 'Euclid',
      dotProduct: 'Dot',
    };

    const response = await fetch(`${this.url}/collections/${name}`, {
      method: 'PUT',
      headers: this.getHeaders(),
      body: JSON.stringify({
        vectors: {
          size: dimension,
          distance: distanceMap[metric],
        },
      }),
    });

    if (!response.ok && response.status !== 409) {
      const error = await response.text();
      throw new Error(`Qdrant create collection error: ${response.status} - ${error}`);
    }
  }

  async deleteCollection(name: string): Promise<void> {
    const response = await fetch(`${this.url}/collections/${name}`, {
      method: 'DELETE',
      headers: this.getHeaders(),
    });

    if (!response.ok && response.status !== 404) {
      const error = await response.text();
      throw new Error(`Qdrant delete collection error: ${response.status} - ${error}`);
    }
  }

  async upsert(collection: string, vectors: VectorRecord[]): Promise<void> {
    const points = vectors.map(v => ({
      id: v.id,
      vector: v.vector,
      payload: {
        ...v.metadata,
        _content: v.content,
      },
    }));

    const response = await fetch(`${this.url}/collections/${collection}/points`, {
      method: 'PUT',
      headers: this.getHeaders(),
      body: JSON.stringify({
        points,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Qdrant upsert error: ${response.status} - ${error}`);
    }
  }

  async search(collection: string, vector: number[], options: VectorSearchOptions = {}): Promise<VectorSearchResult[]> {
    const { topK = 5, minScore, filter } = options;

    const response = await fetch(`${this.url}/collections/${collection}/points/search`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({
        vector,
        limit: topK,
        score_threshold: minScore,
        filter,
        with_payload: true,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Qdrant search error: ${response.status} - ${error}`);
    }

    const data = await response.json() as {
      result: Array<{
        id: string | number;
        score: number;
        payload?: Record<string, unknown>;
      }>;
    };

    return data.result.map(match => {
      const { _content, ...metadata } = (match.payload ?? {}) as { _content?: string; [key: string]: unknown };
      return {
        id: String(match.id),
        score: match.score,
        metadata,
        content: _content as string | undefined,
      };
    });
  }

  async delete(collection: string, ids: string[]): Promise<void> {
    const response = await fetch(`${this.url}/collections/${collection}/points/delete`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({
        points: ids,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Qdrant delete error: ${response.status} - ${error}`);
    }
  }
}
