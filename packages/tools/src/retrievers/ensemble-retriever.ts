import type { VectorSearchResult } from '@orkajs/core';
import type { Retriever, EnsembleRetrieverOptions } from './types.js';

export class EnsembleRetriever implements Retriever {
  private retrievers: Retriever[];
  private weights: number[];
  private topK: number;

  constructor(options: EnsembleRetrieverOptions) {
    this.retrievers = options.retrievers;
    this.topK = options.topK ?? 5;

    if (options.weights) {
      if (options.weights.length !== options.retrievers.length) {
        throw new Error('weights length must match retrievers length');
      }
      const sum = options.weights.reduce((a, b) => a + b, 0);
      this.weights = options.weights.map(w => w / sum);
    } else {
      const equalWeight = 1 / options.retrievers.length;
      this.weights = options.retrievers.map(() => equalWeight);
    }
  }

  async retrieve(query: string, collection: string): Promise<VectorSearchResult[]> {
    const allRankedResults = await Promise.all(
      this.retrievers.map(r => r.retrieve(query, collection))
    );

    const scoreMap = new Map<string, { result: VectorSearchResult; fusionScore: number }>();

    for (let i = 0; i < allRankedResults.length; i++) {
      const results = allRankedResults[i];
      const weight = this.weights[i];

      for (let rank = 0; rank < results.length; rank++) {
        const result = results[rank];
        const key = result.content ?? result.id;

        // Reciprocal Rank Fusion (RRF) with weight
        const rrfScore = weight * (1 / (rank + 60));

        const existing = scoreMap.get(key);
        if (existing) {
          existing.fusionScore += rrfScore;
          if (result.score > existing.result.score) {
            existing.result = result;
          }
        } else {
          scoreMap.set(key, { result, fusionScore: rrfScore });
        }
      }
    }

    return Array.from(scoreMap.values())
      .sort((a, b) => b.fusionScore - a.fusionScore)
      .slice(0, this.topK)
      .map(({ result, fusionScore }) => ({
        ...result,
        score: fusionScore,
        metadata: {
          ...result.metadata,
          originalScore: result.score,
          fusionScore,
        },
      }));
  }
}
