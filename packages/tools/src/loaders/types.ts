import type { Document } from '@orka-js/core';

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

// ============ API-based Loaders ============

export interface NotionLoaderOptions extends LoaderOptions {
  apiKey: string;
  pageIds?: string[];
  databaseIds?: string[];
  recursive?: boolean;
  includeChildPages?: boolean;
  maxDepth?: number;
}

export interface SlackLoaderOptions extends LoaderOptions {
  token: string;
  channelIds?: string[];
  startDate?: Date;
  endDate?: Date;
  includeThreads?: boolean;
  includeFiles?: boolean;
  limit?: number;
}

export interface GitHubLoaderOptions extends LoaderOptions {
  token?: string;
  owner: string;
  repo: string;
  branch?: string;
  path?: string;
  recursive?: boolean;
  fileExtensions?: string[];
  excludePaths?: string[];
  includeReadme?: boolean;
}

export interface GoogleDriveLoaderOptions extends LoaderOptions {
  credentials: {
    clientId: string;
    clientSecret: string;
    refreshToken: string;
  };
  folderId?: string;
  fileIds?: string[];
  mimeTypes?: string[];
  recursive?: boolean;
  maxFiles?: number;
}
