import type { Document } from '@orkajs/core';

export interface LoaderOptions {
  metadata?: Record<string, unknown>;
}

export interface DocumentLoader {
  load(): Promise<Document[]>;
}

export interface CSVLoaderOptions extends LoaderOptions {
  separator?: string;
  columns?: string[];
  contentColumn?: string;
}

export interface JSONLoaderOptions extends LoaderOptions {
  contentField?: string;
  metadataFields?: string[];
  jsonPath?: string;
}

export interface MarkdownLoaderOptions extends LoaderOptions {
  removeFrontmatter?: boolean;
  includeHeaders?: boolean;
}

export interface PDFLoaderOptions extends LoaderOptions {
  pages?: number[];
  maxPages?: number;
}

export interface TextLoaderOptions extends LoaderOptions {
  encoding?: BufferEncoding;
}

export interface DirectoryLoaderOptions extends LoaderOptions {
  glob?: string;
  recursive?: boolean;
  exclude?: string[];
  loaders?: Record<string, (path: string, options?: LoaderOptions) => DocumentLoader>;
}
