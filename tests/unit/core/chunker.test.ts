import { describe, it, expect } from 'vitest';
import { chunkDocument, chunkDocuments, type ChunkerOptions } from '@orkajs/core';
import type { Document, Chunk } from '@orkajs/core';

describe('Chunker', () => {
  const createDoc = (content: string, id = 'doc-1'): Document => ({
    id,
    content,
    metadata: { source: 'test' },
  });

  const defaultOptions: ChunkerOptions = { chunkSize: 100, chunkOverlap: 20 };

  describe('chunkDocument', () => {
    it('should split text into chunks', () => {
      const doc = createDoc('A'.repeat(250));
      const chunks = chunkDocument(doc, defaultOptions);

      expect(chunks.length).toBeGreaterThan(0);
      // Chunks should be created from the document
      const totalLength = chunks.reduce((sum: number, c: Chunk) => sum + c.content.length, 0);
      expect(totalLength).toBeGreaterThan(0);
    });

    it('should handle empty text', () => {
      const doc = createDoc('');
      const chunks = chunkDocument(doc, defaultOptions);

      expect(chunks).toEqual([]);
    });

    it('should handle text smaller than chunk size', () => {
      const doc = createDoc('Short text');
      const chunks = chunkDocument(doc, defaultOptions);

      expect(chunks.length).toBe(1);
      expect(chunks[0].content).toBe('Short text');
    });

    it('should apply overlap between chunks', () => {
      const doc = createDoc('A'.repeat(100));
      const chunks = chunkDocument(doc, { chunkSize: 50, chunkOverlap: 10 });

      expect(chunks.length).toBeGreaterThan(1);
    });

    it('should assign unique IDs to chunks', () => {
      const doc = createDoc('A'.repeat(200));
      const chunks = chunkDocument(doc, { chunkSize: 50, chunkOverlap: 10 });

      const ids = chunks.map((c: Chunk) => c.id);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(ids.length);
    });

    it('should assign sequential indices to chunks', () => {
      const doc = createDoc('A'.repeat(200));
      const chunks = chunkDocument(doc, { chunkSize: 50, chunkOverlap: 10 });

      chunks.forEach((chunk: Chunk, index: number) => {
        expect(chunk.index).toBe(index);
      });
    });

    it('should preserve document metadata in chunks', () => {
      const doc = createDoc('Some text content');
      doc.metadata = { source: 'test', category: 'unit' };
      const chunks = chunkDocument(doc, defaultOptions);

      expect(chunks[0].metadata).toEqual({ source: 'test', category: 'unit' });
    });

    it('should set documentId on all chunks', () => {
      const doc = createDoc('A'.repeat(200), 'my-doc-id');
      const chunks = chunkDocument(doc, { chunkSize: 50, chunkOverlap: 10 });

      chunks.forEach((chunk: Chunk) => {
        expect(chunk.documentId).toBe('my-doc-id');
      });
    });
  });

  describe('chunkDocuments', () => {
    it('should chunk multiple documents', () => {
      const docs = [
        createDoc('First document content', 'doc-1'),
        createDoc('Second document content', 'doc-2'),
      ];
      const chunks = chunkDocuments(docs, defaultOptions);

      expect(chunks.length).toBeGreaterThanOrEqual(2);
      expect(chunks.some((c: Chunk) => c.documentId === 'doc-1')).toBe(true);
      expect(chunks.some((c: Chunk) => c.documentId === 'doc-2')).toBe(true);
    });

    it('should handle empty documents array', () => {
      const chunks = chunkDocuments([], defaultOptions);

      expect(chunks).toEqual([]);
    });
  });
});
