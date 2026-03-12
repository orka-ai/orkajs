import type { VectorSearchResult, LLMAdapter, VectorDBAdapter } from '@orka-js/core';
import type { Retriever, ParentDocumentRetrieverOptions } from './types.js';

export class ParentDocumentRetriever implements Retriever {
  private vectorDB: VectorDBAdapter;
  private llm: LLMAdapter;
  private childTopK: number;
  private parentTopK: number;
  private minScore?: number;

  constructor(options: ParentDocumentRetrieverOptions) {
    this.vectorDB = options.vectorDB;
    this.llm = options.llm;
    this.childTopK = options.childTopK ?? 10;
    this.parentTopK = options.parentTopK ?? 3;
    this.minScore = options.minScore;
  }

  async retrieve(query: string, collection: string): Promise<VectorSearchResult[]> {
    const [embedding] = await this.llm.embed([query]);

    // Step 1: Search for child chunks (small, precise)
    const childResults = await this.vectorDB.search(collection, embedding, {
      topK: this.childTopK,
      minScore: this.minScore,
    });

    if (childResults.length === 0) return [];

    // Step 2: Group by parent document ID
    const parentMap = new Map<string, {
      children: VectorSearchResult[];
      bestScore: number;
    }>();

    for (const child of childResults) {
      const parentId = (child.metadata?.parentId as string) ?? (child.metadata?.documentId as string) ?? child.id;

      const existing = parentMap.get(parentId);
      if (existing) {
        existing.children.push(child);
        existing.bestScore = Math.max(existing.bestScore, child.score);
      } else {
        parentMap.set(parentId, {
          children: [child],
          bestScore: child.score,
        });
      }
    }

    // Step 3: Sort parents by best child score and take top N
    const sortedParents = Array.from(parentMap.entries())
      .sort(([, a], [, b]) => b.bestScore - a.bestScore)
      .slice(0, this.parentTopK);

    // Step 4: Reconstruct parent context from children
    const results: VectorSearchResult[] = [];

    for (const [parentId, { children, bestScore }] of sortedParents) {
      // Sort children by their index/position within the parent
      const sortedChildren = children.sort((a, b) => {
        const indexA = (a.metadata?.chunkIndex as number) ?? 0;
        const indexB = (b.metadata?.chunkIndex as number) ?? 0;
        return indexA - indexB;
      });

      // If parent content is stored in metadata, use it
      const parentContent = sortedChildren[0]?.metadata?.parentContent as string | undefined;

      const content = parentContent
        ? parentContent
        : sortedChildren.map(c => c.content ?? '').join('\n\n');

      results.push({
        id: parentId,
        score: bestScore,
        content,
        metadata: {
          ...sortedChildren[0]?.metadata,
          childCount: children.length,
          retrieverType: 'parent-document',
        },
      });
    }

    return results;
  }
}
