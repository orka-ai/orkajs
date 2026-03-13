import type { LLMAdapter, VectorDBAdapter, VectorSearchResult } from '@orka-js/core';

export interface HybridRetrieverConfig {
  vectorDB: VectorDBAdapter;
  llm: LLMAdapter;
  collection: string;
  vectorWeight?: number;
  keywordWeight?: number;
  topK?: number;
  minScore?: number;
}

export interface HybridSearchOptions {
  topK?: number;
  minScore?: number;
  vectorWeight?: number;
  keywordWeight?: number;
  filter?: Record<string, unknown>;
}

export interface HybridSearchResult extends VectorSearchResult {
  vectorScore: number;
  keywordScore: number;
  combinedScore: number;
}

/**
 * Hybrid Retriever - Combines vector similarity search with keyword (BM25-like) search
 * for improved retrieval accuracy
 */
export class HybridRetriever {
  private vectorDB: VectorDBAdapter;
  private llm: LLMAdapter;
  private collection: string;
  private defaultVectorWeight: number;
  private defaultKeywordWeight: number;
  private defaultTopK: number;
  private defaultMinScore: number;
  private documents: Map<string, { content: string; metadata?: Record<string, unknown> }> = new Map();

  constructor(config: HybridRetrieverConfig) {
    this.vectorDB = config.vectorDB;
    this.llm = config.llm;
    this.collection = config.collection;
    this.defaultVectorWeight = config.vectorWeight ?? 0.7;
    this.defaultKeywordWeight = config.keywordWeight ?? 0.3;
    this.defaultTopK = config.topK ?? 10;
    this.defaultMinScore = config.minScore ?? 0;
  }

  /**
   * Add documents to the retriever for keyword search
   */
  addDocuments(docs: Array<{ id: string; content: string; metadata?: Record<string, unknown> }>): void {
    for (const doc of docs) {
      this.documents.set(doc.id, { content: doc.content, metadata: doc.metadata });
    }
  }

  /**
   * Perform hybrid search combining vector and keyword search
   */
  async search(query: string, options: HybridSearchOptions = {}): Promise<HybridSearchResult[]> {
    const {
      topK = this.defaultTopK,
      minScore = this.defaultMinScore,
      vectorWeight = this.defaultVectorWeight,
      keywordWeight = this.defaultKeywordWeight,
      filter,
    } = options;

    // Get more results than needed for reranking
    const fetchK = Math.min(topK * 3, 100);

    // Vector search
    const [queryEmbedding] = await this.llm.embed([query]);
    const vectorResults = await this.vectorDB.search(this.collection, queryEmbedding, {
      topK: fetchK,
      filter,
    });

    // Keyword search (BM25-like scoring)
    const keywordResults = this.keywordSearch(query, fetchK);

    // Combine results using Reciprocal Rank Fusion (RRF)
    const combinedResults = this.fuseResults(
      vectorResults,
      keywordResults,
      vectorWeight,
      keywordWeight
    );

    // Filter by min score and limit to topK
    return combinedResults
      .filter(r => r.combinedScore >= minScore)
      .slice(0, topK);
  }

  /**
   * Simple BM25-like keyword search
   */
  private keywordSearch(query: string, topK: number): Array<{ id: string; score: number }> {
    const queryTerms = this.tokenize(query);
    const scores: Array<{ id: string; score: number }> = [];

    // Calculate document frequencies
    const docFreq = new Map<string, number>();
    for (const [, doc] of this.documents) {
      const terms = new Set(this.tokenize(doc.content));
      for (const term of terms) {
        docFreq.set(term, (docFreq.get(term) || 0) + 1);
      }
    }

    const N = this.documents.size;
    const avgDl = this.calculateAvgDocLength();
    const k1 = 1.2;
    const b = 0.75;

    for (const [id, doc] of this.documents) {
      const docTerms = this.tokenize(doc.content);
      const dl = docTerms.length;
      let score = 0;

      // Calculate term frequencies in document
      const termFreq = new Map<string, number>();
      for (const term of docTerms) {
        termFreq.set(term, (termFreq.get(term) || 0) + 1);
      }

      // BM25 scoring
      for (const term of queryTerms) {
        const tf = termFreq.get(term) || 0;
        const df = docFreq.get(term) || 0;
        
        if (tf > 0 && df > 0) {
          const idf = Math.log((N - df + 0.5) / (df + 0.5) + 1);
          const tfNorm = (tf * (k1 + 1)) / (tf + k1 * (1 - b + b * (dl / avgDl)));
          score += idf * tfNorm;
        }
      }

      if (score > 0) {
        scores.push({ id, score });
      }
    }

    // Sort by score and return top K
    return scores
      .sort((a, b) => b.score - a.score)
      .slice(0, topK);
  }

  /**
   * Fuse vector and keyword results using Reciprocal Rank Fusion
   */
  private fuseResults(
    vectorResults: VectorSearchResult[],
    keywordResults: Array<{ id: string; score: number }>,
    vectorWeight: number,
    keywordWeight: number
  ): HybridSearchResult[] {
    const k = 60; // RRF constant
    const fusedScores = new Map<string, {
      vectorScore: number;
      keywordScore: number;
      vectorRank: number;
      keywordRank: number;
      result: VectorSearchResult;
    }>();

    // Process vector results
    vectorResults.forEach((result, index) => {
      fusedScores.set(result.id, {
        vectorScore: result.score,
        keywordScore: 0,
        vectorRank: index + 1,
        keywordRank: Infinity,
        result,
      });
    });

    // Process keyword results
    keywordResults.forEach((result, index) => {
      const existing = fusedScores.get(result.id);
      if (existing) {
        existing.keywordScore = result.score;
        existing.keywordRank = index + 1;
      } else {
        // Find the document content
        const doc = this.documents.get(result.id);
        fusedScores.set(result.id, {
          vectorScore: 0,
          keywordScore: result.score,
          vectorRank: Infinity,
          keywordRank: index + 1,
          result: {
            id: result.id,
            score: 0,
            content: doc?.content,
            metadata: doc?.metadata,
          },
        });
      }
    });

    // Calculate combined scores using RRF
    const results: HybridSearchResult[] = [];
    for (const [id, data] of fusedScores) {
      const vectorRRF = data.vectorRank < Infinity ? 1 / (k + data.vectorRank) : 0;
      const keywordRRF = data.keywordRank < Infinity ? 1 / (k + data.keywordRank) : 0;
      const combinedScore = vectorWeight * vectorRRF + keywordWeight * keywordRRF;

      results.push({
        id,
        score: data.result.score,
        content: data.result.content,
        metadata: data.result.metadata,
        vectorScore: data.vectorScore,
        keywordScore: data.keywordScore,
        combinedScore,
      });
    }

    return results.sort((a, b) => b.combinedScore - a.combinedScore);
  }

  /**
   * Tokenize text for keyword search
   */
  private tokenize(text: string): string[] {
    return text
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(t => t.length > 2);
  }

  /**
   * Calculate average document length
   */
  private calculateAvgDocLength(): number {
    if (this.documents.size === 0) return 1;
    let totalLength = 0;
    for (const [, doc] of this.documents) {
      totalLength += this.tokenize(doc.content).length;
    }
    return totalLength / this.documents.size;
  }
}
