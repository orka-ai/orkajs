import type { Document } from '../types/index.js';
import type { DocumentLoader, PDFLoaderOptions } from './types.js';
import { generateId } from '../utils/id.js';

export class PDFLoader implements DocumentLoader {
  private path: string;
  private options: PDFLoaderOptions;

  constructor(path: string, options: PDFLoaderOptions = {}) {
    this.path = path;
    this.options = options;
  }

  async load(): Promise<Document[]> {
    let pdfParse: (buffer: Buffer) => Promise<{ numpages: number; text: string; info: Record<string, unknown> }>;

    try {
      const mod = await import('pdf-parse');
      pdfParse = (mod.default ?? mod) as typeof pdfParse;
    } catch {
      throw new Error(
        'PDFLoader requires the "pdf-parse" package. Install it with: npm install pdf-parse'
      );
    }

    const fs = await import('fs/promises');
    const buffer = await fs.readFile(this.path);
    const data = await pdfParse(buffer as unknown as Buffer);

    const pages = data.text.split(/\f/);
    const maxPages = this.options.maxPages ?? pages.length;
    const selectedPages = this.options.pages;

    const documents: Document[] = [];

    for (let i = 0; i < Math.min(pages.length, maxPages); i++) {
      if (selectedPages && !selectedPages.includes(i + 1)) continue;

      const content = pages[i].trim();
      if (!content) continue;

      documents.push({
        id: generateId(),
        content,
        metadata: {
          ...this.options.metadata,
          source: this.path,
          loader: 'PDFLoader',
          page: i + 1,
          totalPages: pages.length,
          ...(data.info ? { pdfInfo: data.info } : {}),
        },
      });
    }

    if (documents.length === 0 && data.text.trim()) {
      documents.push({
        id: generateId(),
        content: data.text.trim(),
        metadata: {
          ...this.options.metadata,
          source: this.path,
          loader: 'PDFLoader',
          totalPages: data.numpages,
        },
      });
    }

    return documents;
  }
}
