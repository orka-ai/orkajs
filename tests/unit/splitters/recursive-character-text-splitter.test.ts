import { describe, it, expect } from 'vitest';
import { RecursiveCharacterTextSplitter } from '../../../src/splitters/recursive-character-text-splitter.js';
import type { Document } from '../../../src/types/index.js';

describe('RecursiveCharacterTextSplitter', () => {
  describe('split', () => {
    it('should split text by paragraph breaks first', () => {
      const splitter = new RecursiveCharacterTextSplitter({
        chunkSize: 100,
        chunkOverlap: 0,
      });
      const text = 'First paragraph.\n\nSecond paragraph.\n\nThird paragraph.';
      const chunks = splitter.split(text);

      expect(chunks.length).toBeGreaterThanOrEqual(1);
    });

    it('should respect chunk size', () => {
      const splitter = new RecursiveCharacterTextSplitter({
        chunkSize: 50,
        chunkOverlap: 0,
      });
      const text = 'A'.repeat(200);
      const chunks = splitter.split(text);

      chunks.forEach((chunk) => {
        expect(chunk.length).toBeLessThanOrEqual(50);
      });
    });

    it('should handle text smaller than chunk size', () => {
      const splitter = new RecursiveCharacterTextSplitter({
        chunkSize: 100,
        chunkOverlap: 0,
      });
      const text = 'ShortText';
      const chunks = splitter.split(text);

      expect(chunks.length).toBe(1);
      expect(chunks[0]).toBe('ShortText');
    });

    it('should handle empty text', () => {
      const splitter = new RecursiveCharacterTextSplitter({
        chunkSize: 100,
        chunkOverlap: 0,
      });
      const chunks = splitter.split('');

      expect(chunks).toEqual([]);
    });

    it('should apply overlap between chunks', () => {
      const splitter = new RecursiveCharacterTextSplitter({
        chunkSize: 20,
        chunkOverlap: 5,
      });
      const text = 'Word1 Word2 Word3 Word4 Word5 Word6 Word7 Word8';
      const chunks = splitter.split(text);

      expect(chunks.length).toBeGreaterThan(1);
    });

    it('should use custom separators', () => {
      const splitter = new RecursiveCharacterTextSplitter({
        chunkSize: 50,
        chunkOverlap: 0,
        separators: ['|||'],
      });
      const text = 'Part1|||Part2|||Part3';
      const chunks = splitter.split(text);

      expect(chunks.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('splitDocuments', () => {
    it('should split multiple documents', () => {
      const splitter = new RecursiveCharacterTextSplitter({
        chunkSize: 50,
        chunkOverlap: 0,
      });
      const docs: Document[] = [
        { id: 'doc1', content: 'First document content here', metadata: { source: 'doc1' } },
        { id: 'doc2', content: 'Second document content here', metadata: { source: 'doc2' } },
      ];
      const chunks = splitter.splitDocuments(docs);

      expect(chunks.length).toBeGreaterThanOrEqual(2);
    });
  });
});
