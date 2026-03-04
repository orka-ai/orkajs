import type { Document } from '../types/index.js';
import type { DocumentLoader, JSONLoaderOptions } from './types.js';
import { generateId } from '../utils/id.js';

export class JSONLoader implements DocumentLoader {
  private pathOrData: string | Record<string, unknown> | Record<string, unknown>[];
  private options: JSONLoaderOptions;

  constructor(pathOrData: string | Record<string, unknown> | Record<string, unknown>[], options: JSONLoaderOptions = {}) {
    this.pathOrData = pathOrData;
    this.options = options;
  }

  async load(): Promise<Document[]> {
    let data: unknown;

    if (typeof this.pathOrData === 'string') {
      const fs = await import('fs/promises');
      const raw = await fs.readFile(this.pathOrData, 'utf-8');
      data = JSON.parse(raw);
    } else {
      data = this.pathOrData;
    }

    if (this.options.jsonPath) {
      data = this.resolvePath(data, this.options.jsonPath);
    }

    const items = Array.isArray(data) ? data : [data];

    return items.map((item) => {
      const obj = item as Record<string, unknown>;
      const contentField = this.options.contentField;

      let content: string;
      if (contentField && obj[contentField] !== undefined) {
        content = String(obj[contentField]);
      } else {
        content = JSON.stringify(obj, null, 2);
      }

      const metadata: Record<string, unknown> = {
        ...this.options.metadata,
        source: typeof this.pathOrData === 'string' ? this.pathOrData : 'inline',
        loader: 'JSONLoader',
      };

      if (this.options.metadataFields) {
        for (const field of this.options.metadataFields) {
          if (obj[field] !== undefined) {
            metadata[field] = obj[field];
          }
        }
      }

      return {
        id: generateId(),
        content,
        metadata,
      };
    });
  }

  private resolvePath(data: unknown, path: string): unknown {
    const parts = path.replace(/^\$\.?/, '').split('.');
    let current: unknown = data;

    for (const part of parts) {
      if (current === null || current === undefined) return current;

      const bracketMatch = part.match(/^(\w+)\[(\d+)\]$/);
      if (bracketMatch) {
        current = (current as Record<string, unknown>)[bracketMatch[1]];
        if (Array.isArray(current)) {
          current = current[parseInt(bracketMatch[2], 10)];
        }
      } else {
        current = (current as Record<string, unknown>)[part];
      }
    }

    return current;
  }
}
