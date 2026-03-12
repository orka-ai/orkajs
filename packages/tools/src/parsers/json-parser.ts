import type { OutputParser, JSONParserOptions } from './types.js';

export class JSONParser implements OutputParser<Record<string, unknown>> {
  private strict: boolean;

  constructor(options: JSONParserOptions = {}) {
    this.strict = options.strict ?? false;
  }

  parse(text: string): Record<string, unknown> {
    const cleaned = this.extractJSON(text);

    try {
      const parsed = JSON.parse(cleaned);
      if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
        if (this.strict) {
          throw new Error('Expected a JSON object, got: ' + typeof parsed);
        }
        return { value: parsed };
      }
      return parsed;
    } catch (e) {
      throw new Error(`Failed to parse JSON: ${(e as Error).message}\nInput: ${text.slice(0, 200)}`);
    }
  }

  getFormatInstructions(): string {
    return `Your response must be a valid JSON object. Do not include any text before or after the JSON.
Example format:
\`\`\`json
{
  "key": "value"
}
\`\`\``;
  }

  private extractJSON(text: string): string {
    // Try to extract JSON from markdown code blocks
    const codeBlockMatch = text.match(/```(?:json)?\s*\n?([\s\S]*?)\n?\s*```/);
    if (codeBlockMatch) {
      return codeBlockMatch[1].trim();
    }

    // Try to find JSON object in text
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return jsonMatch[0];
    }

    // Try to find JSON array in text
    const arrayMatch = text.match(/\[[\s\S]*\]/);
    if (arrayMatch) {
      return arrayMatch[0];
    }

    return text.trim();
  }
}
