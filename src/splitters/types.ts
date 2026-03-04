import type { Document, Chunk } from '../types/index.js';

export interface TextSplitter {
  split(text: string): string[];
  splitDocuments(documents: Document[]): Chunk[];
}

export interface RecursiveCharacterTextSplitterOptions {
  chunkSize?: number;
  chunkOverlap?: number;
  separators?: string[];
  keepSeparator?: boolean;
  trimWhitespace?: boolean;
}

export interface MarkdownTextSplitterOptions {
  chunkSize?: number;
  chunkOverlap?: number;
  trimWhitespace?: boolean;
}

export interface CodeTextSplitterOptions {
  chunkSize?: number;
  chunkOverlap?: number;
  language: 'typescript' | 'javascript' | 'python' | 'java' | 'go' | 'rust' | 'cpp' | 'html' | 'css';
  trimWhitespace?: boolean;
}

export interface TokenTextSplitterOptions {
  chunkSize?: number;
  chunkOverlap?: number;
  estimatedTokensPerChar?: number;
}
