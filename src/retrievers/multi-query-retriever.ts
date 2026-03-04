import type { VectorSearchResult } from '../types/index.js';
import type { Retriever, MultiQueryRetrieverOptions } from './types.js';

export class MultiQueryRetriever implements Retriever {
  private options: Required<Pick<MultiQueryRetrieverOptions, 'llm' | 'vectorDB'>> & MultiQueryRetrieverOptions;

  constructor(options: MultiQueryRetrieverOptions) {
    this.options = {
      queryCount: 3,
      topK: 5,
      deduplicateByContent: true,
      ...options,
    };
  }

  async retrieve(query: string, collection: string): Promise<VectorSearchResult[]> {
    const queries = await this.generateQueries(query);
    const allResults: VectorSearchResult[] = [];

    for (const q of queries) {
      const [embedding] = await this.options.llm.embed([q]);
      const results = await this.options.vectorDB.search(collection, embedding, {
        topK: this.options.topK,
        minScore: this.options.minScore,
      });
      allResults.push(...results);
    }

    return this.deduplicateAndRank(allResults);
  }

  private async generateQueries(originalQuery: string): Promise<string[]> {
    const prompt = `You are an AI assistant helping to generate alternative search queries.
Given the original query, generate ${this.options.queryCount} alternative versions that capture different aspects or phrasings of the same information need.
Return ONLY the queries, one per line, without numbering or bullets.

Original query: ${originalQuery}

Alternative queries:`;

    const result = await this.options.llm.generate(prompt, {
      temperature: 0.7,
      maxTokens: 256,
    });

    const queries = result.content
      .split('\n')
      .map(q => q.trim())
      .filter(q => q.length > 0)
      .slice(0, this.options.queryCount);

    return [originalQuery, ...queries];
  }

  private deduplicateAndRank(results: VectorSearchResult[]): VectorSearchResult[] {
    if (!this.options.deduplicateByContent) {
      return results.sort((a, b) => b.score - a.score).slice(0, this.options.topK);
    }

    const seen = new Map<string, VectorSearchResult>();

    for (const result of results) {
      const key = result.content ?? result.id;
      const existing = seen.get(key);

      if (!existing || result.score > existing.score) {
        seen.set(key, result);
      }
    }

    return Array.from(seen.values())
      .sort((a, b) => b.score - a.score)
      .slice(0, this.options.topK);
  }
}
