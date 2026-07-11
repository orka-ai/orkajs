import type { Retriever } from '../retrievers/types.js';
import type { LLMAdapter } from '@orka-js/core';
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
      if (!text) continue;

      const remainingTokens = this.maxSourceTokens - tokenEstimate;
      if (remainingTokens <= 0) break;

      // Truncate a source that exceeds the remaining budget rather than
      // skipping it, so an oversized first document never yields empty context.
      const estimatedTokens = Math.ceil(text.length / 4);
      const included = estimatedTokens > remainingTokens ? text.slice(0, remainingTokens * 4) : text;

      context += `---\n${included}\n\n`;
      tokenEstimate += Math.ceil(included.length / 4);
      usedSources.push(source);
    }

    if (context === '') {
      return {
        answer: 'No relevant documents found to answer this question.',
        sources: this.returnSources ? [] : undefined,
        intermediateSteps: steps,
      };
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
