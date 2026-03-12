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

export interface ZodLikeSchema<T = unknown> {
  parse(data: unknown): T;
  safeParse(data: unknown): { success: boolean; data?: T; error?: { message: string; issues?: Array<{ path: (string | number)[]; message: string }> } };
  shape?: Record<string, unknown>;
  description?: string;
}

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
