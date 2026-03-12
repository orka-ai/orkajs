import type { OutputParser, AutoFixParserOptions } from './types.js';

export class AutoFixParser<T> implements OutputParser<T> {
  private parser: OutputParser<T>;
  private maxRetries: number;
  private llm?: AutoFixParserOptions<T>['llm'];

  constructor(options: AutoFixParserOptions<T>) {
    this.parser = options.parser;
    this.maxRetries = options.maxRetries ?? 3;
    this.llm = options.llm;
  }

  parse(text: string): T {
    try {
      return this.parser.parse(text);
    } catch {
      throw new Error(
        `AutoFixParser: Initial parse failed. Use parseWithRetry() for auto-fix with LLM.\nInput: ${text.slice(0, 200)}`
      );
    }
  }

  async parseWithRetry(text: string): Promise<T> {
    let lastError: Error | null = null;
    let currentText = text;

    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        return this.parser.parse(currentText);
      } catch (e) {
        lastError = e as Error;

        if (attempt < this.maxRetries && this.llm) {
          currentText = await this.attemptFix(currentText, lastError);
        }
      }
    }

    throw new Error(
      `AutoFixParser: Failed after ${this.maxRetries} retries.\nLast error: ${lastError?.message}`
    );
  }

  getFormatInstructions(): string {
    return this.parser.getFormatInstructions();
  }

  private async attemptFix(text: string, error: Error): Promise<string> {
    if (!this.llm) {
      throw new Error('AutoFixParser: LLM is required for auto-fix');
    }

    const formatInstructions = this.parser.getFormatInstructions();

    const prompt = `The following text was supposed to match a specific format but failed to parse.

Original text:
\`\`\`
${text}
\`\`\`

Parse error: ${error.message}

Expected format:
${formatInstructions}

Please fix the text to match the expected format. Return ONLY the fixed output, nothing else.`;

    const result = await this.llm.generate(prompt, {
      temperature: 0,
      maxTokens: 1024,
    });

    return result.content;
  }
}
