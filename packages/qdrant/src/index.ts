import { createHash } from 'node:crypto';
import type {
  VectorDBAdapter,
  VectorRecord,
  VectorSearchOptions,
  VectorSearchResult,
  CreateCollectionOptions
} from '@orka-js/core';

export interface QdrantAdapterConfig {
  url: string;
  apiKey?: string;
}

// Fixed namespace used to derive deterministic UUIDv5 point ids from the
// arbitrary string ids allowed by VectorRecord. Qdrant only accepts unsigned
// integers or UUIDs as point ids, so the original id is preserved in the
// payload (see _id) and reconstructed on read.
const QDRANT_ID_NAMESPACE = '6ba7b810-9dad-11d1-80b4-00c04fd430c8';

function uuidV5(name: string, namespace: string): string {
  const namespaceBytes = Buffer.from(namespace.replace(/-/g, ''), 'hex');
  const hash = createHash('sha1')
    .update(namespaceBytes)
    .update(Buffer.from(name, 'utf8'))
    .digest();
  const bytes = hash.subarray(0, 16);
  bytes[6] = (bytes[6] & 0x0f) | 0x50; // version 5
  bytes[8] = (bytes[8] & 0x3f) | 0x80; // RFC 4122 variant
  const hex = bytes.toString('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function toPointId(id: string): string {
  return uuidV5(id, QDRANT_ID_NAMESPACE);
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
      id: toPointId(v.id),
      vector: v.vector,
      payload: {
        ...v.metadata,
        _content: v.content,
        _id: v.id,
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
      const { _content, _id, ...metadata } = (match.payload ?? {}) as { _content?: string; _id?: string; [key: string]: unknown };
      return {
        id: _id ?? String(match.id),
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
        points: ids.map(toPointId),
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Qdrant delete error: ${response.status} - ${error}`);
    }
  }
}
