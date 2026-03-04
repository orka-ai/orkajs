import type { 
  VectorDBAdapter, 
  VectorRecord, 
  VectorSearchOptions, 
  VectorSearchResult,
  CreateCollectionOptions 
} from '../../types/index.js';

interface Collection {
  dimension: number;
  metric: 'cosine' | 'euclidean' | 'dotProduct';
  records: Map<string, VectorRecord>;
}

export class MemoryVectorAdapter implements VectorDBAdapter {
  readonly name = 'memory';
  private collections: Map<string, Collection> = new Map();

  async createCollection(name: string, options: CreateCollectionOptions = {}): Promise<void> {
    if (this.collections.has(name)) {
      return;
    }
    
    this.collections.set(name, {
      dimension: options.dimension ?? 1536,
      metric: options.metric ?? 'cosine',
      records: new Map(),
    });
  }

  async deleteCollection(name: string): Promise<void> {
    this.collections.delete(name);
  }

  async upsert(collection: string, vectors: VectorRecord[]): Promise<void> {
    const col = this.collections.get(collection);
    if (!col) {
      throw new Error(`Collection "${collection}" not found`);
    }

    for (const vector of vectors) {
      col.records.set(vector.id, vector);
    }
  }

  async search(collection: string, vector: number[], options: VectorSearchOptions = {}): Promise<VectorSearchResult[]> {
    const col = this.collections.get(collection);
    if (!col) {
      throw new Error(`Collection "${collection}" not found`);
    }

    const { topK = 5, minScore = 0 } = options;
    const results: VectorSearchResult[] = [];

    for (const record of col.records.values()) {
      const score = this.computeSimilarity(vector, record.vector, col.metric);
      
      if (score >= minScore) {
        results.push({
          id: record.id,
          score,
          metadata: record.metadata,
          content: record.content,
        });
      }
    }

    results.sort((a, b) => b.score - a.score);
    return results.slice(0, topK);
  }

  async delete(collection: string, ids: string[]): Promise<void> {
    const col = this.collections.get(collection);
    if (!col) {
      throw new Error(`Collection "${collection}" not found`);
    }

    for (const id of ids) {
      col.records.delete(id);
    }
  }

  private computeSimilarity(a: number[], b: number[], metric: 'cosine' | 'euclidean' | 'dotProduct'): number {
    if (a.length !== b.length) {
      throw new Error('Vector dimensions must match');
    }

    switch (metric) {
      case 'cosine':
        return this.cosineSimilarity(a, b);
      case 'euclidean':
        return 1 / (1 + this.euclideanDistance(a, b));
      case 'dotProduct':
        return this.dotProduct(a, b);
      default:
        return this.cosineSimilarity(a, b);
    }
  }

  private cosineSimilarity(a: number[], b: number[]): number {
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    const denominator = Math.sqrt(normA) * Math.sqrt(normB);
    return denominator === 0 ? 0 : dotProduct / denominator;
  }

  private euclideanDistance(a: number[], b: number[]): number {
    let sum = 0;
    for (let i = 0; i < a.length; i++) {
      sum += (a[i] - b[i]) ** 2;
    }
    return Math.sqrt(sum);
  }

  private dotProduct(a: number[], b: number[]): number {
    let sum = 0;
    for (let i = 0; i < a.length; i++) {
      sum += a[i] * b[i];
    }
    return sum;
  }

  getCollectionStats(name: string): { recordCount: number; dimension: number } | null {
    const col = this.collections.get(name);
    if (!col) return null;
    
    return {
      recordCount: col.records.size,
      dimension: col.dimension,
    };
  }
}
