import type { LLMAdapter, LLMGenerateOptions, LLMResult } from '@orka-js/core';

export interface OllamaAdapterConfig {
  model?: string;
  embeddingModel?: string;
  baseURL?: string;
  timeoutMs?: number;
}

export class OllamaAdapter implements LLMAdapter {
  readonly name = 'ollama';
  private model: string;
  private embeddingModel: string;
  private baseURL: string;
  private timeoutMs: number;

  constructor(config: OllamaAdapterConfig = {}) {
    this.model = config.model ?? 'llama3.2';
    this.embeddingModel = config.embeddingModel ?? 'nomic-embed-text';
    this.baseURL = config.baseURL ?? 'http://localhost:11434';
    this.timeoutMs = config.timeoutMs ?? 120_000;
  }

  async generate(prompt: string, options: LLMGenerateOptions = {}): Promise<LLMResult> {
    const messages: Array<{ role: string; content: string }> = [];
    
    if (options.systemPrompt) {
      messages.push({ role: 'system', content: options.systemPrompt });
    }
    messages.push({ role: 'user', content: prompt });

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

    let response: Response;
    try {
      response = await fetch(`${this.baseURL}/api/chat`, {
        method: 'POST',
        signal: controller.signal,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: this.model,
          messages,
          stream: false,
          options: {
            temperature: options.temperature ?? 0.7,
            num_predict: options.maxTokens ?? 1024,
            stop: options.stopSequences,
          },
        }),
      });
    } catch (error) {
      clearTimeout(timeout);
      if ((error as Error).name === 'AbortError') {
        throw new Error(`Ollama API request timed out after ${this.timeoutMs}ms`);
      }
      throw error;
    } finally {
      clearTimeout(timeout);
    }

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Ollama API error: ${response.status} - ${error}`);
    }

    const data = await response.json() as {
      message: { content: string };
      model: string;
      done: boolean;
      prompt_eval_count?: number;
      eval_count?: number;
    };

    return {
      content: data.message?.content ?? '',
      usage: {
        promptTokens: data.prompt_eval_count ?? 0,
        completionTokens: data.eval_count ?? 0,
        totalTokens: (data.prompt_eval_count ?? 0) + (data.eval_count ?? 0),
      },
      model: data.model,
      finishReason: data.done ? 'stop' : 'length',
    };
  }

  async embed(texts: string | string[]): Promise<number[][]> {
    const input = Array.isArray(texts) ? texts : [texts];
    const embeddings: number[][] = [];

    for (const text of input) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

      let response: Response;
      try {
        response = await fetch(`${this.baseURL}/api/embeddings`, {
          method: 'POST',
          signal: controller.signal,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: this.embeddingModel,
            prompt: text,
          }),
        });
      } catch (error) {
        clearTimeout(timeout);
        if ((error as Error).name === 'AbortError') {
          throw new Error(`Ollama Embeddings API request timed out after ${this.timeoutMs}ms`);
        }
        throw error;
      } finally {
        clearTimeout(timeout);
      }

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Ollama Embeddings API error: ${response.status} - ${error}`);
      }

      const data = await response.json() as { embedding: number[] };
      embeddings.push(data.embedding);
    }

    return embeddings;
  }
}
