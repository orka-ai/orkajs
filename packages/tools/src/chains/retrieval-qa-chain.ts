import type { Retriever } from '../retrievers/types.js';
import type { LLMAdapter } from '@orkajs/core';
import type { ChainResult, RetrievalQAChainOptions } from './types.js';

export class RetrievalQAChain {
  private llm: LLMAdapter;
  private retriever: Retriever;
  private collection: string;
  private systemPrompt: string;
  private returnSources: boolean;
  private maxSourceTokens: number;

  constructor(options: RetrievalQAChainOptions) {
    this.llm = options.llm;
    this.retriever = options.retriever;
    this.collection = options.collection;
    this.returnSources = options.returnSources ?? true;
    this.maxSourceTokens = options.maxSourceTokens ?? 3000;
    this.systemPrompt = options.systemPrompt ??
      'You are a helpful assistant. Answer the question based ONLY on the provided context. If the context does not contain enough information, say so clearly.';
  }

  async call(question: string): Promise<ChainResult> {
    const steps: ChainResult['intermediateSteps'] = [];

    // Step 1: Retrieve relevant documents
    const retrieveStart = Date.now();
    const sources = await this.retriever.retrieve(question, this.collection);
    steps.push({
      name: 'retrieve',
      input: question,
      output: `Found ${sources.length} relevant documents`,
      latencyMs: Date.now() - retrieveStart,
    });

    // Step 2: Build context from sources
    let context = '';
    let tokenEstimate = 0;
    const usedSources = [];

    for (const source of sources) {
      const text = source.content ?? '';
      const estimatedTokens = Math.ceil(text.length / 4);
      if (tokenEstimate + estimatedTokens > this.maxSourceTokens) break;
      context += `---\n${text}\n\n`;
      tokenEstimate += estimatedTokens;
      usedSources.push(source);
    }

    // Step 3: Generate answer
    const prompt = `Context:\n${context}\n\nQuestion: ${question}\n\nAnswer:`;

    const generateStart = Date.now();
    const result = await this.llm.generate(prompt, {
      systemPrompt: this.systemPrompt,
      temperature: 0.3,
    });
    steps.push({
      name: 'generate',
      input: prompt.slice(0, 200) + '...',
      output: result.content.slice(0, 200),
      latencyMs: Date.now() - generateStart,
    });

    return {
      answer: result.content,
      sources: this.returnSources ? usedSources : undefined,
      intermediateSteps: steps,
      usage: {
        ...result.usage,
        totalTokens: result.usage.totalTokens,
      },
    };
  }
}
