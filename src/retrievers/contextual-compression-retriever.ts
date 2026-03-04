import type { VectorSearchResult } from '../types/index.js';
import type { Retriever, ContextualCompressionRetrieverOptions } from './types.js';

export class ContextualCompressionRetriever implements Retriever {
  private options: Required<Pick<ContextualCompressionRetrieverOptions, 'llm' | 'vectorDB'>> & ContextualCompressionRetrieverOptions;

  constructor(options: ContextualCompressionRetrieverOptions) {
    this.options = {
      topK: 10,
      maxCompressedLength: 500,
      ...options,
    };
  }

  async retrieve(query: string, collection: string): Promise<VectorSearchResult[]> {
    const [embedding] = await this.options.llm.embed([query]);
    const results = await this.options.vectorDB.search(collection, embedding, {
      topK: this.options.topK,
      minScore: this.options.minScore,
    });

    const compressed = await this.compressResults(query, results);
    return compressed.filter(r => r.content && r.content.trim().length > 0);
  }

  private async compressResults(query: string, results: VectorSearchResult[]): Promise<VectorSearchResult[]> {
    const compressed: VectorSearchResult[] = [];

    for (const result of results) {
      if (!result.content) {
        compressed.push(result);
        continue;
      }

      const prompt = `Given the following question and document, extract ONLY the parts of the document that are relevant to answering the question. If no part is relevant, respond with "NOT_RELEVANT".

Question: ${query}

Document:
${result.content}

Relevant extract:`;

      const llmResult = await this.options.llm.generate(prompt, {
        temperature: 0,
        maxTokens: this.options.maxCompressedLength,
      });

      const extract = llmResult.content.trim();

      if (extract === 'NOT_RELEVANT' || extract.length === 0) {
        continue;
      }

      compressed.push({
        ...result,
        content: extract,
        metadata: {
          ...result.metadata,
          originalLength: result.content.length,
          compressedLength: extract.length,
        },
      });
    }

    return compressed;
  }
}
