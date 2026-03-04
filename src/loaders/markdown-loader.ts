import type { Document } from '../types/index.js';
import type { DocumentLoader, MarkdownLoaderOptions } from './types.js';
import { generateId } from '../utils/id.js';

export class MarkdownLoader implements DocumentLoader {
  private pathOrContent: string;
  private isFilePath: boolean;
  private options: MarkdownLoaderOptions;

  constructor(pathOrContent: string, options: MarkdownLoaderOptions & { isContent?: boolean } = {}) {
    this.pathOrContent = pathOrContent;
    this.isFilePath = !options.isContent;
    this.options = options;
  }

  async load(): Promise<Document[]> {
    let raw: string;

    if (this.isFilePath) {
      const fs = await import('fs/promises');
      raw = await fs.readFile(this.pathOrContent, 'utf-8');
    } else {
      raw = this.pathOrContent;
    }

    let content = raw;
    let frontmatter: Record<string, unknown> = {};

    if (this.options.removeFrontmatter !== false) {
      const fmResult = this.extractFrontmatter(content);
      content = fmResult.content;
      frontmatter = fmResult.frontmatter;
    }

    const metadata: Record<string, unknown> = {
      ...this.options.metadata,
      ...frontmatter,
      source: this.isFilePath ? this.pathOrContent : 'inline',
      loader: 'MarkdownLoader',
    };

    if (this.options.includeHeaders) {
      const headers = this.extractHeaders(content);
      metadata.headers = headers;
    }

    return [{
      id: generateId(),
      content: content.trim(),
      metadata,
    }];
  }

  private extractFrontmatter(text: string): { content: string; frontmatter: Record<string, unknown> } {
    const match = text.match(/^---\s*\n([\s\S]*?)\n---\s*\n/);
    if (!match) return { content: text, frontmatter: {} };

    const frontmatter: Record<string, unknown> = {};
    const lines = match[1].split('\n');

    for (const line of lines) {
      const colonIndex = line.indexOf(':');
      if (colonIndex === -1) continue;
      const key = line.slice(0, colonIndex).trim();
      let value: string | boolean | number = line.slice(colonIndex + 1).trim();

      if (value === 'true') value = true;
      else if (value === 'false') value = false;
      else if (!isNaN(Number(value)) && value !== '') value = Number(value);

      frontmatter[key] = value;
    }

    return {
      content: text.slice(match[0].length),
      frontmatter,
    };
  }

  private extractHeaders(text: string): string[] {
    const headers: string[] = [];
    const lines = text.split('\n');

    for (const line of lines) {
      const match = line.match(/^(#{1,6})\s+(.+)/);
      if (match) {
        headers.push(match[2].trim());
      }
    }

    return headers;
  }
}
