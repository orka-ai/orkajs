import type { 
  VectorDBAdapter, 
  VectorRecord, 
  VectorSearchOptions, 
  VectorSearchResult,
  CreateCollectionOptions 
} from '@orkajs/core';

export interface ChromaAdapterConfig {
  url?: string;
  tenant?: string;
  database?: string;
}

export class ChromaAdapter implements VectorDBAdapter {
  readonly name = 'chroma';
  private url: string;
  private collectionIds: Map<string, string> = new Map();

  constructor(config: ChromaAdapterConfig = {}) {
    this.url = (config.url ?? 'http://localhost:8000').replace(/\/$/, '');
  }

  async createCollection(name: string, _options: CreateCollectionOptions = {}): Promise<void> {
    const response = await fetch(`${this.url}/api/v1/collections`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name,
        metadata: {},
        get_or_create: true,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Chroma create collection error: ${response.status} - ${error}`);
    }

    const data = await response.json() as { id: string };
    this.collectionIds.set(name, data.id);
  }

  async deleteCollection(name: string): Promise<void> {
    const response = await fetch(`${this.url}/api/v1/collections/${name}`, {
      method: 'DELETE',
    });

    if (!response.ok && response.status !== 404) {
      const error = await response.text();
      throw new Error(`Chroma delete collection error: ${response.status} - ${error}`);
    }

    this.collectionIds.delete(name);
  }

  private async getCollectionId(name: string): Promise<string> {
    if (this.collectionIds.has(name)) {
      return this.collectionIds.get(name)!;
    }

    const response = await fetch(`${this.url}/api/v1/collections/${name}`);
    if (!response.ok) {
      throw new Error(`Collection "${name}" not found`);
    }

    const data = await response.json() as { id: string };
    this.collectionIds.set(name, data.id);
    return data.id;
  }

  async upsert(collection: string, vectors: VectorRecord[]): Promise<void> {
    const collectionId = await this.getCollectionId(collection);

    const response = await fetch(`${this.url}/api/v1/collections/${collectionId}/upsert`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ids: vectors.map(v => v.id),
        embeddings: vectors.map(v => v.vector),
        documents: vectors.map(v => v.content ?? ''),
        metadatas: vectors.map(v => v.metadata ?? {}),
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Chroma upsert error: ${response.status} - ${error}`);
    }
  }

  async search(collection: string, vector: number[], options: VectorSearchOptions = {}): Promise<VectorSearchResult[]> {
    const { topK = 5 } = options;
    const collectionId = await this.getCollectionId(collection);

    const response = await fetch(`${this.url}/api/v1/collections/${collectionId}/query`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query_embeddings: [vector],
        n_results: topK,
        include: ['documents', 'metadatas', 'distances'],
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Chroma query error: ${response.status} - ${error}`);
    }

    const data = await response.json() as {
      ids: string[][];
      documents: (string | null)[][];
      metadatas: (Record<string, unknown> | null)[][];
      distances: number[][];
    };

    const ids = data.ids[0] ?? [];
    const documents = data.documents[0] ?? [];
    const metadatas = data.metadatas[0] ?? [];
    const distances = data.distances[0] ?? [];

    return ids.map((id, i) => ({
      id,
      score: 1 - (distances[i] ?? 0),
      content: documents[i] ?? undefined,
      metadata: metadatas[i] ?? undefined,
    }));
  }

  async delete(collection: string, ids: string[]): Promise<void> {
    const collectionId = await this.getCollectionId(collection);

    const response = await fetch(`${this.url}/api/v1/collections/${collectionId}/delete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Chroma delete error: ${response.status} - ${error}`);
    }
  }
}
