import type { 
  VectorDBAdapter, 
  VectorRecord, 
  VectorSearchOptions, 
  VectorSearchResult,
  CreateCollectionOptions 
} from '@orka-js/core';

export interface ChromaAdapterConfig {
  url?: string;
  tenant?: string;
  database?: string;
}

const SPACE_MAP: Record<NonNullable<CreateCollectionOptions['metric']>, string> = {
  cosine: 'cosine',
  euclidean: 'l2',
  dotProduct: 'ip',
};

export class ChromaAdapter implements VectorDBAdapter {
  readonly name = 'chroma';
  private url: string;
  private collectionIds: Map<string, string> = new Map();
  private collectionSpaces: Map<string, string> = new Map();

  constructor(config: ChromaAdapterConfig = {}) {
    this.url = (config.url ?? 'http://localhost:8000').replace(/\/$/, '');
  }

  async createCollection(name: string, options: CreateCollectionOptions = {}): Promise<void> {
    const { metric = 'cosine' } = options;
    const space = SPACE_MAP[metric];

    const response = await fetch(`${this.url}/api/v1/collections`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name,
        metadata: { 'hnsw:space': space },
        get_or_create: true,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Chroma create collection error: ${response.status} - ${error}`);
    }

    const data = await response.json() as { id: string };
    this.collectionIds.set(name, data.id);
    this.collectionSpaces.set(name, space);
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

    const data = await response.json() as { id: string; metadata?: Record<string, unknown> };
    this.collectionIds.set(name, data.id);
    const space = data.metadata?.['hnsw:space'];
    if (typeof space === 'string') {
      this.collectionSpaces.set(name, space);
    }
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
    const { topK = 5, minScore, filter } = options;
    const collectionId = await this.getCollectionId(collection);

    const response = await fetch(`${this.url}/api/v1/collections/${collectionId}/query`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query_embeddings: [vector],
        n_results: topK,
        where: filter,
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

    // Chroma defaults to l2 when the space is unknown; convert the raw
    // distance into a similarity score consistent with the collection's space.
    const space = this.collectionSpaces.get(collection) ?? 'l2';
    const toScore = (distance: number): number => {
      switch (space) {
        case 'cosine':
        case 'ip':
          return 1 - distance;
        default:
          // l2 distance is unbounded above; map it into (0, 1].
          return 1 / (1 + distance);
      }
    };

    const results = ids.map((id, i) => ({
      id,
      score: toScore(distances[i] ?? 0),
      content: documents[i] ?? undefined,
      metadata: metadatas[i] ?? undefined,
    }));

    return minScore !== undefined
      ? results.filter(r => r.score >= minScore)
      : results;
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
