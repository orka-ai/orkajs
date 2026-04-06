import { Injectable, BadRequestException } from '@nestjs/common';
import type { PipeTransform, ArgumentMetadata } from '@nestjs/common';
import type { LLMAdapter, OrkaSchema } from '@orka-js/core';

/**
 * AgentValidationPipe — validates and transforms request data using LLM + schema.
 *
 * Instead of requiring clients to send perfectly structured JSON, this pipe accepts
 * natural language and uses `llm.generateObject()` to extract a typed DTO.
 *
 * Input priority:
 * 1. If value is `{ input: "..." }` → use LLM to extract structured data
 * 2. If value is a direct object → try `schema.safeParse()` first (no LLM cost)
 *    and fall back to LLM if validation fails
 * 3. If value is a string → pass directly to LLM
 *
 * @example
 * ```typescript
 * import { z } from 'zod'
 * import { AgentValidationPipe } from '@orka-js/nestjs'
 *
 * const SearchSchema = z.object({
 *   color: z.string().optional(),
 *   maxPrice: z.number().optional(),
 *   category: z.string(),
 * })
 *
 * @Post('search')
 * async search(
 *   @Body(new AgentValidationPipe(SearchSchema, llm, { description: 'product search filters' }))
 *   query: z.infer<typeof SearchSchema>
 * ) {}
 *
 * // Client can send either:
 * // { "query": "shoes" }  ← structured (no LLM call)
 * // { "input": "red shoes under $50 in size 42" }  ← natural language
 * ```
 */
@Injectable()
export class AgentValidationPipe<T> implements PipeTransform<unknown, Promise<T>> {
  constructor(
    private readonly schema: OrkaSchema<T>,
    private readonly llm: LLMAdapter,
    private readonly options: {
      description?: string;
      temperature?: number;
      maxTokens?: number;
    } = {},
  ) {}

  async transform(value: unknown, _metadata: ArgumentMetadata): Promise<T> {
    let naturalLanguageInput: string | null = null;

    if (value !== null && typeof value === 'object') {
      const obj = value as Record<string, unknown>;

      if (typeof obj['input'] === 'string') {
        // { input: "natural language..." } form
        naturalLanguageInput = obj['input'];
      } else {
        // Direct structured object — try schema validation first (avoids LLM cost)
        const directResult = this.schema.safeParse(value);
        if (directResult.success) {
          return directResult.data;
        }
        // Schema failed → fall back to LLM with stringified value
        naturalLanguageInput = JSON.stringify(value);
      }
    } else if (typeof value === 'string') {
      naturalLanguageInput = value;
    } else {
      throw new BadRequestException(
        'AgentValidationPipe: expected an object or string input',
      );
    }

    const description = this.options.description ?? 'structured data';
    const prompt = [
      `Extract ${description} from the following natural language input.`,
      'Return a valid JSON object matching the expected structure.',
      '',
      `Input: ${naturalLanguageInput}`,
    ].join('\n');

    try {
      const extracted = await this.llm.generateObject<T>(this.schema, prompt, {
        temperature: this.options.temperature ?? 0,
        ...(this.options.maxTokens ? { maxTokens: this.options.maxTokens } : {}),
      });

      // Final validation pass to ensure the LLM output matches the schema
      const validated = this.schema.safeParse(extracted);
      if (!validated.success) {
        throw new BadRequestException(
          `LLM output did not match schema: ${JSON.stringify(validated.error)}`,
        );
      }

      return validated.data;
    } catch (err) {
      if (err instanceof BadRequestException) throw err;
      throw new BadRequestException(
        `Failed to parse input: ${(err as Error).message}`,
      );
    }
  }
}
