import type { Document } from '@orka-js/core';
import type { DocumentLoader, DirectoryLoaderOptions, LoaderOptions } from './types.js';
import { TextLoader } from './text-loader.js';
import { CSVLoader } from './csv-loader.js';
import { JSONLoader } from './json-loader.js';
import { MarkdownLoader } from './markdown-loader.js';

const DEFAULT_LOADERS: Record<string, (path: string, options?: LoaderOptions) => DocumentLoader> = {
  '.txt': (p, o) => new TextLoader(p, o),
  '.md': (p, o) => new MarkdownLoader(p, o),
  '.mdx': (p, o) => new MarkdownLoader(p, o),
  '.csv': (p, o) => new CSVLoader(p, o),
  '.json': (p, o) => new JSONLoader(p, o),
  '.jsonl': (p, o) => new JSONLoader(p, o),
  '.ts': (p, o) => new TextLoader(p, o),
  '.js': (p, o) => new TextLoader(p, o),
  '.py': (p, o) => new TextLoader(p, o),
  '.html': (p, o) => new TextLoader(p, o),
  '.xml': (p, o) => new TextLoader(p, o),
  '.yaml': (p, o) => new TextLoader(p, o),
  '.yml': (p, o) => new TextLoader(p, o),
};

export class DirectoryLoader implements DocumentLoader {
  private dirPath: string;
  private options: DirectoryLoaderOptions;

  constructor(dirPath: string, options: DirectoryLoaderOptions = {}) {
    this.dirPath = dirPath;
    this.options = options;
  }

  async load(): Promise<Document[]> {
    const fs = await import('fs/promises');
    const path = await import('path');

    const loaders = { ...DEFAULT_LOADERS, ...this.options.loaders };
    const exclude = this.options.exclude ?? ['node_modules', '.git', '.DS_Store'];
    const recursive = this.options.recursive ?? true;

    const documents: Document[] = [];
    const files = await this.getFiles(this.dirPath, recursive, exclude, fs, path);

    for (const filePath of files) {
      const ext = path.extname(filePath).toLowerCase();
      const loaderFactory = loaders[ext];

      if (!loaderFactory) continue;

      if (this.options.glob) {
        const fileName = path.basename(filePath);
        if (!this.matchGlob(fileName, this.options.glob)) continue;
      }

      try {
        const loader = loaderFactory(filePath, { metadata: this.options.metadata });
        const docs = await loader.load();
        documents.push(...docs);
      } catch {
        // Skip files that fail to load
      }
    }

    return documents;
  }

  private async getFiles(
    dir: string,
    recursive: boolean,
    exclude: string[],
    fs: typeof import('fs/promises'),
    path: typeof import('path')
  ): Promise<string[]> {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    const files: string[] = [];

    for (const entry of entries) {
      if (exclude.includes(entry.name)) continue;

      const fullPath = path.join(dir, entry.name);

      if (entry.isFile()) {
        files.push(fullPath);
      } else if (entry.isDirectory() && recursive) {
        const subFiles = await this.getFiles(fullPath, recursive, exclude, fs, path);
        files.push(...subFiles);
      }
    }

    return files;
  }

  private matchGlob(filename: string, pattern: string): boolean {
    const regex = pattern
      .replace(/\./g, '\\.')
      .replace(/\*/g, '.*')
      .replace(/\?/g, '.');
    return new RegExp(`^${regex}$`).test(filename);
  }
}
