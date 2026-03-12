/**
 * Document Extractor - Extract structured data from documents using OCR + LLM
 */

import type {
  ExtractOptions,
  ExtractResult,
  ExtractionSchema,
  SchemaField,
  OCREngineConfig,
} from '../types.js';
import { OCR } from '../ocr.js';

/**
 * DocumentExtractor - Extract structured data from documents
 * 
 * @example
 * ```typescript
 * import { DocumentExtractor } from '@orka-js/ocr';
 * import { OpenAIAdapter } from '@orka-js/openai';
 * 
 * const extractor = new DocumentExtractor();
 * 
 * const result = await extractor.extract({
 *   file: './invoice.pdf',
 *   schema: {
 *     invoiceNumber: 'string',
 *     date: 'date',
 *     total: 'number',
 *     items: {
 *       type: 'array',
 *       items: {
 *         type: 'object',
 *         properties: {
 *           description: { type: 'string' },
 *           quantity: { type: 'number' },
 *           price: { type: 'number' },
 *         },
 *       },
 *     },
 *   },
 *   llm: new OpenAIAdapter({ apiKey: process.env.OPENAI_API_KEY! }),
 * });
 * 
 * console.log(result.data);
 * // { invoiceNumber: 'INV-2024-001', date: '2024-03-15', total: 1250.00, items: [...] }
 * ```
 */
export class DocumentExtractor {
  private ocr: OCR;

  constructor(engineConfig?: OCREngineConfig) {
    this.ocr = new OCR(engineConfig);
  }

  /**
   * Extract structured data from a document
   */
  async extract<T = Record<string, unknown>>(options: ExtractOptions): Promise<ExtractResult<T>> {
    const startTime = Date.now();

    // Step 1: OCR the document
    const ocrResult = await this.ocr.process(options.file, options.ocr);

    // Step 2: If no LLM provided, return raw OCR result
    if (!options.llm) {
      return {
        data: { rawText: ocrResult.text } as T,
        confidence: ocrResult.confidence,
        rawText: options.includeRawText ? ocrResult.text : undefined,
        metadata: {
          engine: ocrResult.metadata.engine,
          processingTimeMs: Date.now() - startTime,
          pageCount: ocrResult.metadata.pageCount,
        },
      };
    }

    // Step 3: Use LLM to extract structured data
    const prompt = this.buildExtractionPrompt(ocrResult.text, options.schema, options.prompt);
    
    const llmResult = await options.llm.generate(prompt, {
      temperature: 0.1, // Low temperature for consistent extraction
      maxTokens: 4096,
    });

    // Step 4: Parse LLM response
    const { data, errors } = this.parseExtractedData<T>(llmResult.content, options.schema);

    return {
      data,
      confidence: errors && errors.length > 0 ? 0.7 : 0.9,
      rawText: options.includeRawText ? ocrResult.text : undefined,
      errors,
      metadata: {
        engine: ocrResult.metadata.engine,
        processingTimeMs: Date.now() - startTime,
        pageCount: ocrResult.metadata.pageCount,
      },
    };
  }

  private buildExtractionPrompt(
    text: string,
    schema: ExtractionSchema,
    customPrompt?: string
  ): string {
    const schemaDescription = this.describeSchema(schema);

    if (customPrompt) {
      return `${customPrompt}

Document text:
${text}

Extract the following fields:
${schemaDescription}

Return ONLY valid JSON matching this schema. No explanations.`;
    }

    return `You are a document data extraction assistant. Extract structured data from the following document text.

Document text:
---
${text}
---

Extract the following fields:
${schemaDescription}

Rules:
1. Return ONLY valid JSON matching the schema
2. Use null for fields that cannot be found
3. Parse dates as ISO 8601 format (YYYY-MM-DD)
4. Parse numbers without currency symbols
5. Be precise and extract exact values from the document

JSON output:`;
  }

  private describeSchema(schema: ExtractionSchema, indent = 0): string {
    const lines: string[] = [];
    const prefix = '  '.repeat(indent);

    for (const [key, value] of Object.entries(schema)) {
      if (typeof value === 'string') {
        lines.push(`${prefix}- ${key}: ${value}`);
      } else {
        const field = value as SchemaField;
        let desc = `${prefix}- ${key}: ${field.type}`;
        if (field.description) {
          desc += ` (${field.description})`;
        }
        if (field.required) {
          desc += ' [required]';
        }
        lines.push(desc);

        if (field.type === 'object' && field.properties) {
          lines.push(this.describeSchema(field.properties, indent + 1));
        }
        if (field.type === 'array' && field.items) {
          lines.push(`${prefix}  items: ${JSON.stringify(field.items)}`);
        }
      }
    }

    return lines.join('\n');
  }

  private parseExtractedData<T>(
    content: string,
    schema: ExtractionSchema
  ): { data: T; errors?: Array<{ field: string; message: string }> } {
    const errors: Array<{ field: string; message: string }> = [];

    // Try to extract JSON from the response
    let jsonStr = content.trim();
    
    // Handle markdown code blocks
    const jsonMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      jsonStr = jsonMatch[1].trim();
    }

    // Try to find JSON object
    const objectMatch = jsonStr.match(/\{[\s\S]*\}/);
    if (objectMatch) {
      jsonStr = objectMatch[0];
    }

    try {
      const data = JSON.parse(jsonStr) as T;
      
      // Validate required fields
      for (const [key, value] of Object.entries(schema)) {
        if (typeof value === 'object' && (value as SchemaField).required) {
          if ((data as Record<string, unknown>)[key] === undefined || (data as Record<string, unknown>)[key] === null) {
            errors.push({ field: key, message: `Required field '${key}' is missing` });
          }
        }
      }

      return { data, errors: errors.length > 0 ? errors : undefined };
    } catch (e) {
      errors.push({ field: '_parse', message: `Failed to parse JSON: ${(e as Error).message}` });
      return { data: {} as T, errors };
    }
  }

  /**
   * Set a different OCR engine
   */
  setEngine(engineConfig: OCREngineConfig): void {
    this.ocr.setEngine(engineConfig);
  }
}

/**
 * Quick extract function for simple use cases
 */
export async function extract<T = Record<string, unknown>>(
  options: ExtractOptions
): Promise<ExtractResult<T>> {
  const extractor = new DocumentExtractor();
  return extractor.extract<T>(options);
}
