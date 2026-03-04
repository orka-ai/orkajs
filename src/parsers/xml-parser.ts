import type { OutputParser } from './types.js';

export interface XMLParserOptions {
  tags?: string[];
  strict?: boolean;
}

export class XMLParser implements OutputParser<Record<string, string>> {
  private tags: string[];
  private strict: boolean;

  constructor(options: XMLParserOptions = {}) {
    this.tags = options.tags ?? [];
    this.strict = options.strict ?? false;
  }

  parse(text: string): Record<string, string> {
    const result: Record<string, string> = {};
    const cleaned = this.extractXML(text);

    const tagPattern = /<(\w+)>([\s\S]*?)<\/\1>/g;
    let match: RegExpExecArray | null;

    while ((match = tagPattern.exec(cleaned)) !== null) {
      const [, tag, content] = match;
      if (this.tags.length === 0 || this.tags.includes(tag)) {
        result[tag] = content.trim();
      }
    }

    if (this.strict && this.tags.length > 0) {
      const missing = this.tags.filter(t => !(t in result));
      if (missing.length > 0) {
        throw new Error(`XMLParser: Missing required tags: ${missing.join(', ')}\nInput: ${text.slice(0, 200)}`);
      }
    }

    if (Object.keys(result).length === 0) {
      throw new Error(`XMLParser: No XML tags found in input.\nInput: ${text.slice(0, 200)}`);
    }

    return result;
  }

  getFormatInstructions(): string {
    if (this.tags.length > 0) {
      const example = this.tags.map(t => `<${t}>value</${t}>`).join('\n');
      return `Your response must use the following XML tags:\n${example}\n\nWrap each value in its corresponding XML tag.`;
    }
    return `Your response must use XML tags to structure the output.\nExample:\n<key>value</key>\n<another_key>another value</another_key>`;
  }

  private extractXML(text: string): string {
    const codeBlockMatch = text.match(/```(?:xml)?\s*\n?([\s\S]*?)\n?\s*```/);
    if (codeBlockMatch) {
      return codeBlockMatch[1].trim();
    }
    return text;
  }
}
