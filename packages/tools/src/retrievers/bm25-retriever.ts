import type { VectorSearchResult } from '@orka-js/core';
import type { Retriever } from './types.js';

export interface BM25RetrieverOptions {
  documents: BM25Document[];
  topK?: number;
  k1?: number;
  b?: number;
}

export interface BM25Document {
  id: string;
  content: string;
  metadata?: Record<string, unknown>;
}

export class BM25Retriever implements Retriever {
  private documents: BM25Document[];
  private topK: number;
  private k1: number;
  private b: number;
  private avgDocLength: number;
  private docFrequencies: Map<string, number>;
  private totalDocs: number;

  constructor(options: BM25RetrieverOptions) {
    this.documents = options.documents;
    this.topK = options.topK ?? 5;
    this.k1 = options.k1 ?? 1.5;
    this.b = options.b ?? 0.75;
    this.totalDocs = options.documents.length;

    // Pre-compute statistics
    let totalLength = 0;
    this.docFrequencies = new Map();

    for (const doc of this.documents) {
      const tokens = this.tokenize(doc.content);
      totalLength += tokens.length;

      const uniqueTokens = new Set(tokens);
      for (const token of uniqueTokens) {
        this.docFrequencies.set(token, (this.docFrequencies.get(token) ?? 0) + 1);
      }
    }

    this.avgDocLength = this.totalDocs > 0 ? totalLength / this.totalDocs : 0;
  }

  async retrieve(query: string, _collection: string): Promise<VectorSearchResult[]> {
    const queryTokens = this.tokenize(query);
    const scores: Array<{ doc: BM25Document; score: number }> = [];

    for (const doc of this.documents) {
      const score = this.computeBM25(queryTokens, doc.content);
      if (score > 0) {
        scores.push({ doc, score });
      }
    }

    return scores
      .sort((a, b) => b.score - a.score)
      .slice(0, this.topK)
      .map(({ doc, score }) => ({
        id: doc.id,
        score,
        content: doc.content,
        metadata: {
          ...doc.metadata,
          retrieverType: 'bm25',
        },
      }));
  }

  addDocuments(documents: BM25Document[]): void {
    for (const doc of documents) {
      this.documents.push(doc);
      const tokens = this.tokenize(doc.content);
      const uniqueTokens = new Set(tokens);
      for (const token of uniqueTokens) {
        this.docFrequencies.set(token, (this.docFrequencies.get(token) ?? 0) + 1);
      }
    }

    this.totalDocs = this.documents.length;
    let totalLength = 0;
    for (const doc of this.documents) {
      totalLength += this.tokenize(doc.content).length;
    }
    this.avgDocLength = this.totalDocs > 0 ? totalLength / this.totalDocs : 0;
  }

  private computeBM25(queryTokens: string[], docContent: string): number {
    const docTokens = this.tokenize(docContent);
    const docLength = docTokens.length;

    // Count term frequencies in document
    const termFreqs = new Map<string, number>();
    for (const token of docTokens) {
      termFreqs.set(token, (termFreqs.get(token) ?? 0) + 1);
    }

    let score = 0;

    for (const queryToken of queryTokens) {
      const tf = termFreqs.get(queryToken) ?? 0;
      if (tf === 0) continue;

      const df = this.docFrequencies.get(queryToken) ?? 0;
      const idf = Math.log(1 + (this.totalDocs - df + 0.5) / (df + 0.5));

      const numerator = tf * (this.k1 + 1);
      const denominator = tf + this.k1 * (1 - this.b + this.b * (docLength / this.avgDocLength));

      score += idf * (numerator / denominator);
    }

    return score;
  }

  private tokenize(text: string): string[] {
    return text
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(t => t.length > 1);
  }
}
