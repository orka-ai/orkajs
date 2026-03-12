import type { Document } from '@orka-js/core';
import type { DocumentLoader, TextLoaderOptions } from './types.js';
import { generateId } from '@orka-js/core';

export class TextLoader implements DocumentLoader {
  private path: string;
  private options: TextLoaderOptions;

  constructor(path: string, options: TextLoaderOptions = {}) {
    this.path = path;
    this.options = options;
  }

  async load(): Promise<Document[]> {
    const fs = await import('fs/promises');
    const content = await fs.readFile(this.path, this.options.encoding ?? 'utf-8');

    return [{
      id: generateId(),
      content: content as string,
      metadata: {
        ...this.options.metadata,
        source: this.path,
        loader: 'TextLoader',
      },
    }];
  }
}
