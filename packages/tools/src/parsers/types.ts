export interface OutputParser<T = unknown> {
  parse(text: string): T;
  getFormatInstructions(): string;
}

export interface JSONParserOptions {
  strict?: boolean;
}

export interface StructuredOutputParserOptions<T> {
  schema: ZodLikeSchema<T>;
  strict?: boolean;
}

// Imported and re-exported from core so users can import from either package without breaking changes
import type { ZodLikeSchema } from '@orka-js/core';
export type { ZodLikeSchema };

export interface ListParserOptions {
  separator?: string;
  trim?: boolean;
}

export interface RegexParserOptions {
  regex: RegExp;
  outputKeys: string[];
}

export interface AutoFixParserOptions<T> {
  parser: OutputParser<T>;
  maxRetries?: number;
  llm?: {
    generate(prompt: string, options?: { temperature?: number; maxTokens?: number }): Promise<{ content: string }>;
  };
}

export interface XMLParserOptions {
  tags?: string[];
  strict?: boolean;
}

export interface CSVParserOptions {
  separator?: string;
  headers?: string[];
  strict?: boolean;
}

export interface CommaSeparatedListParserOptions {
  trim?: boolean;
  removeDuplicates?: boolean;
}
