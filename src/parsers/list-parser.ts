import type { OutputParser, ListParserOptions } from './types.js';

export class ListParser implements OutputParser<string[]> {
  private separator: string;
  private trim: boolean;

  constructor(options: ListParserOptions = {}) {
    this.separator = options.separator ?? '\n';
    this.trim = options.trim ?? true;
  }

  parse(text: string): string[] {
    let items = text.split(this.separator);

    if (this.trim) {
      items = items.map(item => item.trim());
    }

    // Remove common list prefixes (-, *, 1., etc.)
    items = items.map(item => item.replace(/^[-*•]\s+/, '').replace(/^\d+[.)]\s+/, ''));

    return items.filter(item => item.length > 0);
  }

  getFormatInstructions(): string {
    if (this.separator === '\n') {
      return `Your response must be a list of items, one per line. Do not include bullet points, numbers, or other prefixes.`;
    }
    return `Your response must be a list of items separated by "${this.separator}".`;
  }
}
