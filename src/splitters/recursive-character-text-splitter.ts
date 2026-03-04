import type { Document, Chunk } from '../types/index.js';
import type { TextSplitter, RecursiveCharacterTextSplitterOptions } from './types.js';

const DEFAULT_SEPARATORS = ['\n\n', '\n', '. ', ', ', ' ', ''];

export class RecursiveCharacterTextSplitter implements TextSplitter {
  private chunkSize: number;
  private chunkOverlap: number;
  private separators: string[];
  private keepSeparator: boolean;
  private trimWhitespace: boolean;

  constructor(options: RecursiveCharacterTextSplitterOptions = {}) {
    this.chunkSize = options.chunkSize ?? 1000;
    this.chunkOverlap = options.chunkOverlap ?? 200;
    this.separators = options.separators ?? DEFAULT_SEPARATORS;
    this.keepSeparator = options.keepSeparator ?? true;
    this.trimWhitespace = options.trimWhitespace ?? true;

    if (this.chunkOverlap >= this.chunkSize) {
      throw new Error('chunkOverlap must be less than chunkSize');
    }
  }

  split(text: string): string[] {
    return this.splitText(text, this.separators);
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

  private splitText(text: string, separators: string[]): string[] {
    const finalChunks: string[] = [];

    let separator = separators[separators.length - 1];
    let newSeparators: string[] = [];

    for (let i = 0; i < separators.length; i++) {
      const sep = separators[i];
      if (sep === '') {
        separator = sep;
        break;
      }
      if (text.includes(sep)) {
        separator = sep;
        newSeparators = separators.slice(i + 1);
        break;
      }
    }

    const splits = this.splitBySeparator(text, separator);

    let goodSplits: string[] = [];

    for (const s of splits) {
      if (s.length < this.chunkSize) {
        goodSplits.push(s);
      } else {
        if (goodSplits.length > 0) {
          const merged = this.mergeSplits(goodSplits, separator);
          finalChunks.push(...merged);
          goodSplits = [];
        }

        if (newSeparators.length === 0) {
          finalChunks.push(s);
        } else {
          const subChunks = this.splitText(s, newSeparators);
          finalChunks.push(...subChunks);
        }
      }
    }

    if (goodSplits.length > 0) {
      const merged = this.mergeSplits(goodSplits, separator);
      finalChunks.push(...merged);
    }

    return finalChunks
      .map(c => this.trimWhitespace ? c.trim() : c)
      .filter(c => c.length > 0);
  }

  private splitBySeparator(text: string, separator: string): string[] {
    if (separator === '') {
      return [...text];
    }

    const parts = text.split(separator);

    if (!this.keepSeparator) {
      return parts.filter(p => p !== '');
    }

    const result: string[] = [];
    for (let i = 0; i < parts.length; i++) {
      if (i === 0) {
        result.push(parts[i]);
      } else {
        result.push(separator + parts[i]);
      }
    }

    return result.filter(p => p !== '' && p !== separator);
  }

  private mergeSplits(splits: string[], separator: string): string[] {
    const merged: string[] = [];
    const currentParts: string[] = [];
    let currentLength = 0;

    for (const split of splits) {
      const splitLen = split.length;
      const sepLen = currentParts.length > 0 ? separator.length : 0;

      if (currentLength + splitLen + sepLen > this.chunkSize && currentParts.length > 0) {
        const chunk = currentParts.join(separator);
        merged.push(chunk);

        while (currentLength > this.chunkOverlap || (currentLength + splitLen + separator.length > this.chunkSize && currentLength > 0)) {
          if (currentParts.length === 0) break;
          const removed = currentParts.shift()!;
          currentLength -= removed.length + (currentParts.length > 0 ? separator.length : 0);
        }
      }

      currentParts.push(split);
      currentLength += splitLen + sepLen;
    }

    if (currentParts.length > 0) {
      merged.push(currentParts.join(separator));
    }

    return merged;
  }
}
