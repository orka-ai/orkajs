import type {
  LLMAdapter,
  LLMGenerateOptions,
  LLMResult,
  StreamingLLMAdapter,
  StreamGenerateOptions,
  StreamResult,
  LLMStreamEvent,
} from '@orka-js/core';
import { createStreamEvent } from '@orka-js/core';
import type { MockResponse, MockCall } from './types.js';

export class MockLLMAdapter implements LLMAdapter, StreamingLLMAdapter {
  readonly name = 'mock';
  readonly supportsStreaming = true;
  private responses: MockResponse[];
  private calls: MockCall[] = [];
  private defaultOutput: string;

  constructor(responses: MockResponse[] = [], defaultOutput = 'Mock response') {
    this.responses = responses;
    this.defaultOutput = defaultOutput;
  }

  private findResponse(prompt: string): MockResponse | null {
    for (const response of this.responses) {
      if (!response.when) return response;
      if (typeof response.when === 'string') {
        if (prompt.includes(response.when)) return response;
      } else if (response.when instanceof RegExp) {
        if (response.when.test(prompt)) return response;
      } else if (typeof response.when === 'function') {
        if (response.when(prompt)) return response;
      }
    }
    return null;
  }

  private getPromptText(prompt: string, options?: LLMGenerateOptions): string {
    // Also search in messages
    const messagesText = options?.messages
      ?.map(m => (typeof m.content === 'string' ? m.content : JSON.stringify(m.content)))
      .join(' ') ?? '';
    return prompt + ' ' + messagesText;
  }

  async generate(prompt: string, options?: LLMGenerateOptions): Promise<LLMResult> {
    const fullPrompt = this.getPromptText(prompt, options);
    const response = this.findResponse(fullPrompt);

    this.calls.push({ prompt: fullPrompt, options, timestamp: Date.now(), response });

    if (response?.latencyMs) {
      await new Promise(resolve => setTimeout(resolve, response.latencyMs));
    }

    if (response?.error) throw response.error;

    const output = response?.output ?? this.defaultOutput;

    return {
      content: output,
      usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 },
      model: 'mock-model',
      finishReason: 'stop',
      cost: 0,
    };
  }

  async *stream(prompt: string, options?: StreamGenerateOptions): AsyncIterable<LLMStreamEvent> {
    const fullPrompt = prompt + ' ' + (options?.messages?.map(m =>
      typeof m.content === 'string' ? m.content : JSON.stringify(m.content)
    ).join(' ') ?? '');

    const response = this.findResponse(fullPrompt);
    this.calls.push({ prompt: fullPrompt, options, timestamp: Date.now(), response });

    if (response?.latencyMs) {
      await new Promise(resolve => setTimeout(resolve, response.latencyMs));
    }

    if (response?.error) {
      yield createStreamEvent('error', {
        error: response.error,
        message: response.error.message,
      } as never);
      return;
    }

    // Simulate tool call if configured
    if (response?.toolCall) {
      const callId = response.toolCall.id ?? `call_mock_${Date.now()}`;
      yield createStreamEvent('tool_call', {
        toolCallId: callId,
        name: response.toolCall.name,
        arguments: JSON.stringify(response.toolCall.args),
      } as never);
      yield createStreamEvent('done', {
        content: '',
        finishReason: 'tool_calls',
      } as never);
      return;
    }

    // Stream tokens one by one
    const output = response?.output ?? this.defaultOutput;
    const tokens = output.split(' ');
    let index = 0;

    for (const token of tokens) {
      const tokenStr = index === 0 ? token : ' ' + token;
      yield createStreamEvent('token', { token: tokenStr, index } as never);
      index++;
    }

    yield createStreamEvent('usage', {
      usage: { promptTokens: 100, completionTokens: tokens.length, totalTokens: 100 + tokens.length },
    } as never);

    yield createStreamEvent('done', {
      content: output,
      finishReason: 'stop',
      usage: { promptTokens: 100, completionTokens: tokens.length, totalTokens: 100 + tokens.length },
      cost: 0,
    } as never);
  }

  async streamGenerate(prompt: string, options?: StreamGenerateOptions): Promise<StreamResult> {
    let content = '';
    const startTime = Date.now();
    let usage = { promptTokens: 0, completionTokens: 0, totalTokens: 0 };

    for await (const event of this.stream(prompt, options)) {
      if (event.type === 'token') content += event.token;
      if (event.type === 'done') {
        content = event.content || content;
        if (event.usage) usage = event.usage;
      }
      if (event.type === 'error') throw event.error;
    }

    return {
      content,
      usage,
      model: 'mock-model',
      finishReason: 'stop',
      durationMs: Date.now() - startTime,
    };
  }

  async embed(text: string | string[]): Promise<number[][]> {
    const inputs = Array.isArray(text) ? text : [text];
    // Return deterministic mock embeddings
    return inputs.map(() => Array.from({ length: 1536 }, (_, i) => Math.sin(i * 0.1)));
  }

  async generateObject<T>(schema: { parse(d: unknown): T }, prompt: string, options?: LLMGenerateOptions): Promise<T> {
    const result = await this.generate(prompt, options);
    try {
      return schema.parse(JSON.parse(result.content));
    } catch {
      return schema.parse({});
    }
  }

  // ---- Assertion helpers ----

  getCalls(): MockCall[] {
    return [...this.calls];
  }

  getCallCount(): number {
    return this.calls.length;
  }

  wasCalledWith(pattern: string | RegExp): boolean {
    return this.calls.some(c =>
      typeof pattern === 'string' ? c.prompt.includes(pattern) : pattern.test(c.prompt)
    );
  }

  getLastCall(): MockCall | undefined {
    return this.calls[this.calls.length - 1];
  }

  reset(): void {
    this.calls = [];
  }
}

export function mockLLM(responses: MockResponse[] = [], defaultOutput?: string): MockLLMAdapter {
  return new MockLLMAdapter(responses, defaultOutput);
}
