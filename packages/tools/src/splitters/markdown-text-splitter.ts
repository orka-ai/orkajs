import type { Document, Chunk } from '@orkajs/core';
import type { TextSplitter, MarkdownTextSplitterOptions } from './types.js';
import { RecursiveCharacterTextSplitter } from './recursive-character-text-splitter.js';

const MARKDOWN_SEPARATORS = [
  '\n## ',     // H2
  '\n### ',    // H3
  '\n#### ',   // H4
  '\n##### ',  // H5
  '\n###### ', // H6
  '\n```\n',   // Code blocks
  '\n---\n',   // Horizontal rules
  '\n***\n',   // Horizontal rules
  '\n\n',      // Double newline (paragraphs)
  '\n',        // Single newline
  '. ',        // Sentences
  ' ',         // Words
  '',          // Characters
];

export class MarkdownTextSplitter implements TextSplitter {
  private splitter: RecursiveCharacterTextSplitter;

  constructor(options: MarkdownTextSplitterOptions = {}) {
    this.splitter = new RecursiveCharacterTextSplitter({
      chunkSize: options.chunkSize ?? 1000,
      chunkOverlap: options.chunkOverlap ?? 200,
      separators: MARKDOWN_SEPARATORS,
      keepSeparator: true,
      trimWhitespace: options.trimWhitespace ?? true,
    });
  }

  split(text: string): string[] {
    return this.splitter.split(text);
  }

  splitDocuments(documents: Document[]): Chunk[] {
    return this.splitter.splitDocuments(documents);
  }
}
