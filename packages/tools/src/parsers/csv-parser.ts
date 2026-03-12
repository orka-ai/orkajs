import type { OutputParser } from './types.js';

export interface CSVParserOptions {
  separator?: string;
  headers?: string[];
  strict?: boolean;
}

export class CSVParser implements OutputParser<Record<string, string>[]> {
  private separator: string;
  private headers: string[];
  private strict: boolean;

  constructor(options: CSVParserOptions = {}) {
    this.separator = options.separator ?? ',';
    this.headers = options.headers ?? [];
    this.strict = options.strict ?? false;
  }

  parse(text: string): Record<string, string>[] {
    const cleaned = this.extractCSV(text);
    const lines = cleaned.split('\n').map(l => l.trim()).filter(l => l.length > 0);

    if (lines.length === 0) {
      throw new Error('CSVParser: No data found in input.');
    }

    let headers: string[];
    let dataLines: string[];

    if (this.headers.length > 0) {
      headers = this.headers;
      dataLines = lines;
    } else {
      headers = this.parseLine(lines[0]);
      dataLines = lines.slice(1);
    }

    if (dataLines.length === 0) {
      throw new Error('CSVParser: No data rows found (only headers).');
    }

    const results: Record<string, string>[] = [];

    for (let i = 0; i < dataLines.length; i++) {
      const values = this.parseLine(dataLines[i]);

      if (this.strict && values.length !== headers.length) {
        throw new Error(
          `CSVParser: Row ${i + 1} has ${values.length} columns, expected ${headers.length}.`
        );
      }

      const row: Record<string, string> = {};
      for (let j = 0; j < headers.length; j++) {
        row[headers[j]] = values[j] ?? '';
      }
      results.push(row);
    }

    return results;
  }

  getFormatInstructions(): string {
    if (this.headers.length > 0) {
      return `Your response must be in CSV format with the following columns: ${this.headers.join(this.separator)}\nDo not include a header row. Separate values with "${this.separator}".`;
    }
    return `Your response must be in CSV format. The first row should contain column headers. Separate values with "${this.separator}".`;
  }

  private parseLine(line: string): string[] {
    const values: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];

      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === this.separator && !inQuotes) {
        values.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }

    values.push(current.trim());
    return values;
  }

  private extractCSV(text: string): string {
    const codeBlockMatch = text.match(/```(?:csv)?\s*\n?([\s\S]*?)\n?\s*```/);
    if (codeBlockMatch) {
      return codeBlockMatch[1].trim();
    }
    return text.trim();
  }
}
