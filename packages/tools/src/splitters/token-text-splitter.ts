import type { Document, Chunk } from '@orkajs/core';
import type { TextSplitter, TokenTextSplitterOptions } from './types.js';

export class TokenTextSplitter implements TextSplitter {
  private chunkSize: number;
  private chunkOverlap: number;
  private tokensPerChar: number;

  constructor(options: TokenTextSplitterOptions = {}) {
    this.chunkSize = options.chunkSize ?? 500;
    this.chunkOverlap = options.chunkOverlap ?? 50;
    this.tokensPerChar = options.estimatedTokensPerChar ?? 0.25;

    if (this.chunkOverlap >= this.chunkSize) {
      throw new Error('chunkOverlap must be less than chunkSize');
    }
  }

  split(text: string): string[] {
    const charChunkSize = Math.floor(this.chunkSize / this.tokensPerChar);
    const charOverlap = Math.floor(this.chunkOverlap / this.tokensPerChar);

    const chunks: string[] = [];
    let start = 0;

    while (start < text.length) {
      let end = Math.min(start + charChunkSize, text.length);

      if (end < text.length) {
        const lastSpace = text.lastIndexOf(' ', end);
        if (lastSpace > start) {
          end = lastSpace;
        }
      }

      const chunk = text.slice(start, end).trim();
      if (chunk) {
        chunks.push(chunk);
      }

      start = end - charOverlap;
      if (start >= text.length) break;
    }

    return chunks;
  }

  splitDocuments(documents: Document[]): Chunk[] {
    const chunks: Chunk[] = [];

    for (const doc of documents) {
      const textChunks = this.split(doc.content);

      for (let i = 0; i < textChunks.length; i++) {
        chunks.push({
          id: `${doc.id}_chunk_${i}`,
          content: textChunks[i],
          documentId: doc.id,
          index: i,
          metadata: { ...doc.metadata },
        });
      }
    }

    return chunks;
  }
}
