import type { LLMAdapter, VectorSearchResult } from '@orka-js/core';

export interface RerankerConfig {
  llm: LLMAdapter;
  model?: string;
  batchSize?: number;
}

export interface RerankOptions {
  topK?: number;
  minScore?: number;
  returnScores?: boolean;
}

export interface RerankResult extends VectorSearchResult {
  originalScore: number;
  rerankScore: number;
  relevanceExplanation?: string;
}

/**
 * Reranker - Uses LLM to rerank search results for improved relevance
 */
export class Reranker {
  private llm: LLMAdapter;
  private batchSize: number;

  constructor(config: RerankerConfig) {
    this.llm = config.llm;
    this.batchSize = config.batchSize ?? 10;
  }

  /**
   * Rerank search results using LLM-based relevance scoring
   */
  async rerank(
    query: string,
    results: VectorSearchResult[],
    options: RerankOptions = {}
  ): Promise<RerankResult[]> {
    const { topK = results.length, minScore = 0, returnScores = false } = options;

    if (results.length === 0) return [];

    // Process in batches
    const rerankedResults: RerankResult[] = [];
    
    for (let i = 0; i < results.length; i += this.batchSize) {
      const batch = results.slice(i, i + this.batchSize);
      const batchResults = await this.rerankBatch(query, batch, returnScores);
      rerankedResults.push(...batchResults);
    }

    // Sort by rerank score and filter
    return rerankedResults
      .sort((a, b) => b.rerankScore - a.rerankScore)
      .filter(r => r.rerankScore >= minScore)
      .slice(0, topK);
  }

  /**
   * Rerank a batch of results
   */
  private async rerankBatch(
    query: string,
    results: VectorSearchResult[],
    returnScores: boolean
  ): Promise<RerankResult[]> {
    const prompt = this.buildRerankPrompt(query, results, returnScores);
    
    const response = await this.llm.generate(prompt, {
      temperature: 0,
      maxTokens: 2000,
    });

    return this.parseRerankResponse(response.content, results, returnScores);
  }

  /**
   * Build the reranking prompt
   */
  private buildRerankPrompt(
    query: string,
    results: VectorSearchResult[],
    includeExplanation: boolean
  ): string {
    const documentsText = results
      .map((r, i) => `[${i}] ${r.content?.slice(0, 500) ?? ''}`)
      .join('\n\n');

    if (includeExplanation) {
      return `You are a relevance scoring assistant. Given a query and a list of documents, score each document's relevance to the query on a scale of 0-10.

Query: "${query}"

Documents:
${documentsText}

For each document, provide:
1. The document index [0-${results.length - 1}]
2. A relevance score (0-10)
3. A brief explanation

Format your response as JSON:
[
  {"index": 0, "score": 8.5, "explanation": "Directly addresses the query..."},
  {"index": 1, "score": 3.2, "explanation": "Tangentially related..."}
]

Respond ONLY with the JSON array, no other text.`;
    }

    return `You are a relevance scoring assistant. Given a query and a list of documents, score each document's relevance to the query on a scale of 0-10.

Query: "${query}"

Documents:
${documentsText}

For each document, provide the document index and a relevance score.

Format your response as JSON:
[
  {"index": 0, "score": 8.5},
  {"index": 1, "score": 3.2}
]

Respond ONLY with the JSON array, no other text.`;
  }

  /**
   * Parse the LLM response for reranking scores
   */
  private parseRerankResponse(
    response: string,
    results: VectorSearchResult[],
    includeExplanation: boolean
  ): RerankResult[] {
    try {
      // Extract JSON from response
      const jsonMatch = response.match(/\[[\s\S]*\]/);
      if (!jsonMatch) {
        // Fallback: return results with original scores
        return results.map(r => ({
          ...r,
          originalScore: r.score,
          rerankScore: r.score,
        }));
      }

      const scores = JSON.parse(jsonMatch[0]) as Array<{
        index: number;
        score: number;
        explanation?: string;
      }>;

      // Map scores to results
      const scoreMap = new Map<number, { score: number; explanation?: string }>();
      for (const s of scores) {
        scoreMap.set(s.index, { score: s.score / 10, explanation: s.explanation });
      }

      return results.map((r, i) => {
        const scoreData = scoreMap.get(i);
        return {
          ...r,
          originalScore: r.score,
          rerankScore: scoreData?.score ?? r.score,
          relevanceExplanation: includeExplanation ? scoreData?.explanation : undefined,
        };
      });
    } catch {
      // Fallback: return results with original scores
      return results.map(r => ({
        ...r,
        originalScore: r.score,
        rerankScore: r.score,
      }));
    }
  }
}

/**
 * Cross-Encoder Reranker - Uses cross-encoder style prompting for more accurate reranking
 */
export class CrossEncoderReranker {
  private llm: LLMAdapter;

  constructor(config: RerankerConfig) {
    this.llm = config.llm;
  }

  /**
   * Rerank using pairwise comparison (more accurate but slower)
   */
  async rerank(
    query: string,
    results: VectorSearchResult[],
    options: RerankOptions = {}
  ): Promise<RerankResult[]> {
    const { topK = results.length, minScore = 0 } = options;

    if (results.length === 0) return [];

    // Score each document individually with cross-encoder style prompt
    const scoredResults = await Promise.all(
      results.map(async (result) => {
        const score = await this.scoreDocument(query, result.content ?? '');
        return {
          ...result,
          originalScore: result.score,
          rerankScore: score,
        };
      })
    );

    return scoredResults
      .sort((a, b) => b.rerankScore - a.rerankScore)
      .filter(r => r.rerankScore >= minScore)
      .slice(0, topK);
  }

  /**
   * Score a single document's relevance to the query
   */
  private async scoreDocument(query: string, document: string): Promise<number> {
    const prompt = `On a scale of 0 to 10, how relevant is this document to the query?

Query: "${query}"

Document: "${document.slice(0, 1000)}"

Respond with ONLY a number between 0 and 10 (can include decimals).`;

    const response = await this.llm.generate(prompt, {
      temperature: 0,
      maxTokens: 10,
    });

    const score = parseFloat(response.content.trim());
    return isNaN(score) ? 0 : Math.min(10, Math.max(0, score)) / 10;
  }
}

/**
 * Cohere-style Reranker using external API
 */
export interface CohereRerankerConfig {
  apiKey: string;
  model?: string;
  baseURL?: string;
}

export class CohereReranker {
  private apiKey: string;
  private model: string;
  private baseURL: string;

  constructor(config: CohereRerankerConfig) {
    this.apiKey = config.apiKey;
    this.model = config.model ?? 'rerank-english-v3.0';
    this.baseURL = config.baseURL ?? 'https://api.cohere.ai/v1';
  }

  /**
   * Rerank using Cohere's rerank API
   */
  async rerank(
    query: string,
    results: VectorSearchResult[],
    options: RerankOptions = {}
  ): Promise<RerankResult[]> {
    const { topK = results.length, minScore = 0 } = options;

    if (results.length === 0) return [];

    const documents = results.map(r => r.content ?? '');

    const response = await fetch(`${this.baseURL}/rerank`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: this.model,
        query,
        documents,
        top_n: topK,
        return_documents: false,
      }),
    });

    if (!response.ok) {
      throw new Error(`Cohere rerank API error: ${response.status}`);
    }

    const data = await response.json() as {
      results: Array<{ index: number; relevance_score: number }>;
    };

    // Map scores back to results
    const rerankedResults: RerankResult[] = data.results
      .map(r => ({
        ...results[r.index],
        originalScore: results[r.index].score,
        rerankScore: r.relevance_score,
      }))
      .filter(r => r.rerankScore >= minScore);

    return rerankedResults;
  }
}
