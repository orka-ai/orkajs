import type { OutputParser, StructuredOutputParserOptions, ZodLikeSchema } from './types.js';

export class StructuredOutputParser<T> implements OutputParser<T> {
  private schema: ZodLikeSchema<T>;
  private strict: boolean;

  constructor(options: StructuredOutputParserOptions<T>) {
    this.schema = options.schema;
    this.strict = options.strict ?? true;
  }

  static fromZodSchema<T>(schema: ZodLikeSchema<T>, options?: { strict?: boolean }): StructuredOutputParser<T> {
    return new StructuredOutputParser({ schema, strict: options?.strict });
  }

  parse(text: string): T {
    const cleaned = this.extractJSON(text);

    let parsed: unknown;
    try {
      parsed = JSON.parse(cleaned);
    } catch (e) {
      throw new Error(`Failed to parse JSON: ${(e as Error).message}\nInput: ${text.slice(0, 200)}`);
    }

    if (this.strict) {
      const result = this.schema.safeParse(parsed);
      if (!result.success) {
        const issues = result.error?.issues
          ?.map(i => `  - ${i.path.join('.')}: ${i.message}`)
          .join('\n') ?? result.error?.message ?? 'Unknown validation error';
        throw new Error(`Validation failed:\n${issues}`);
      }
      return result.data!;
    }

    return this.schema.parse(parsed);
  }

  getFormatInstructions(): string {
    const schemaDescription = this.describeSchema();
    return `Your response must be a valid JSON object matching this exact schema:

${schemaDescription}

Important:
- Return ONLY the JSON object, no additional text
- All required fields must be present
- Values must match the expected types`;
  }

  private extractJSON(text: string): string {
    const codeBlockMatch = text.match(/```(?:json)?\s*\n?([\s\S]*?)\n?\s*```/);
    if (codeBlockMatch) {
      return codeBlockMatch[1].trim();
    }

    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return jsonMatch[0];
    }

    return text.trim();
  }

  private describeSchema(): string {
    if (this.schema.shape) {
      const fields = Object.entries(this.schema.shape)
        .map(([key, value]) => {
          const desc = (value as { description?: string }).description ?? '';
          return `  "${key}": ${desc || '...'}`;
        })
        .join(',\n');
      return `\`\`\`json\n{\n${fields}\n}\n\`\`\``;
    }

    if (this.schema.description) {
      return this.schema.description;
    }

    return '{ ... }';
  }
}
