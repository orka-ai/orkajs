import type { OutputParser } from './types.js';

export interface CommaSeparatedListParserOptions {
  trim?: boolean;
  removeDuplicates?: boolean;
}

export class CommaSeparatedListParser implements OutputParser<string[]> {
  private trim: boolean;
  private removeDuplicates: boolean;

  constructor(options: CommaSeparatedListParserOptions = {}) {
    this.trim = options.trim ?? true;
    this.removeDuplicates = options.removeDuplicates ?? false;
  }

  parse(text: string): string[] {
    const cleaned = text.replace(/```[\s\S]*?```/g, '').trim();

    let items = cleaned.split(',');

    if (this.trim) {
      items = items.map(item => item.trim());
    }

    items = items.filter(item => item.length > 0);

    if (this.removeDuplicates) {
      items = [...new Set(items)];
    }

    if (items.length === 0) {
      throw new Error(`CommaSeparatedListParser: No items found in input.\nInput: ${text.slice(0, 200)}`);
    }

    return items;
  }

  getFormatInstructions(): string {
    return `Your response must be a comma-separated list of values.\nExample: item1, item2, item3\nDo not include any additional text, numbering, or formatting.`;
  }
}
