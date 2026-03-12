import type { Document } from '@orkajs/core';
import type { DocumentLoader, CSVLoaderOptions } from './types.js';
import { generateId } from '@orkajs/core';

export class CSVLoader implements DocumentLoader {
  private path: string;
  private options: CSVLoaderOptions;

  constructor(path: string, options: CSVLoaderOptions = {}) {
    this.path = path;
    this.options = options;
  }

  async load(): Promise<Document[]> {
    const fs = await import('fs/promises');
    const raw = await fs.readFile(this.path, 'utf-8');
    const separator = this.options.separator ?? ',';

    const lines = this.parseCSV(raw, separator);
    if (lines.length < 2) return [];

    const headers = lines[0];
    const rows = lines.slice(1);

    const selectedColumns = this.options.columns ?? headers;
    const contentColumn = this.options.contentColumn;

    return rows
      .filter(row => row.some(cell => cell.trim() !== ''))
      .map((row) => {
        const rowData: Record<string, string> = {};
        headers.forEach((header, i) => {
          rowData[header] = row[i] ?? '';
        });

        let content: string;
        if (contentColumn && rowData[contentColumn] !== undefined) {
          content = rowData[contentColumn];
        } else {
          content = selectedColumns
            .map(col => `${col}: ${rowData[col] ?? ''}`)
            .join('\n');
        }

        const metadata: Record<string, unknown> = {
          ...this.options.metadata,
          source: this.path,
          loader: 'CSVLoader',
        };
        headers.forEach((header, i) => {
          if (header !== contentColumn) {
            metadata[header] = row[i] ?? '';
          }
        });

        return {
          id: generateId(),
          content,
          metadata,
        };
      });
  }

  private parseCSV(raw: string, separator: string): string[][] {
    const lines: string[][] = [];
    let current: string[] = [];
    let field = '';
    let inQuotes = false;

    for (let i = 0; i < raw.length; i++) {
      const char = raw[i];
      const next = raw[i + 1];

      if (inQuotes) {
        if (char === '"' && next === '"') {
          field += '"';
          i++;
        } else if (char === '"') {
          inQuotes = false;
        } else {
          field += char;
        }
      } else {
        if (char === '"') {
          inQuotes = true;
        } else if (char === separator) {
          current.push(field);
          field = '';
        } else if (char === '\n' || (char === '\r' && next === '\n')) {
          current.push(field);
          field = '';
          lines.push(current);
          current = [];
          if (char === '\r') i++;
        } else {
          field += char;
        }
      }
    }

    if (field || current.length > 0) {
      current.push(field);
      lines.push(current);
    }

    return lines;
  }
}
