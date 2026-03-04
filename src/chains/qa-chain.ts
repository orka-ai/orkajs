import type { Retriever } from '../retrievers/types.js';
import type { LLMAdapter, VectorSearchResult } from '../types/index.js';
import type { ChainResult, QAChainOptions } from './types.js';

export class QAChain {
  private llm: LLMAdapter;
  private retriever: Retriever;
  private collection: string;
  private systemPrompt: string;
  private returnSources: boolean;
  private strategy: 'stuff' | 'map-reduce' | 'refine';
  private maxSourceTokens: number;

  constructor(options: QAChainOptions) {
    this.llm = options.llm;
    this.retriever = options.retriever;
    this.collection = options.collection;
    this.returnSources = options.returnSources ?? true;
    this.strategy = options.strategy ?? 'stuff';
    this.maxSourceTokens = options.maxSourceTokens ?? 3000;
    this.systemPrompt = options.systemPrompt ??
      'You are a helpful assistant. Answer the question based ONLY on the provided documents. Cite specific parts of the documents when possible. If the documents do not contain the answer, say so.';
  }

  async call(question: string): Promise<ChainResult> {
    const steps: ChainResult['intermediateSteps'] = [];

    // Step 1: Retrieve
    const retrieveStart = Date.now();
    const sources = await this.retriever.retrieve(question, this.collection);
    steps.push({
      name: 'retrieve',
      input: question,
      output: `Found ${sources.length} documents`,
      latencyMs: Date.now() - retrieveStart,
    });

    if (sources.length === 0) {
      return {
        answer: 'No relevant documents found to answer this question.',
        sources: [],
        intermediateSteps: steps,
      };
    }

    // Step 2: Answer based on strategy
    let answer: string;
    let usage = { promptTokens: 0, completionTokens: 0, totalTokens: 0 };

    switch (this.strategy) {
      case 'stuff':
        ({ answer, usage } = await this.stuffQA(question, sources, steps));
        break;
      case 'map-reduce':
        ({ answer, usage } = await this.mapReduceQA(question, sources, steps));
        break;
      case 'refine':
        ({ answer, usage } = await this.refineQA(question, sources, steps));
        break;
    }

    return {
      answer,
      sources: this.returnSources ? sources : undefined,
      intermediateSteps: steps,
      usage,
    };
  }

  private async stuffQA(
    question: string,
    sources: VectorSearchResult[],
    steps: ChainResult['intermediateSteps']
  ): Promise<{ answer: string; usage: ChainResult['usage'] & Record<string, number> }> {
    let context = '';
    let tokenEstimate = 0;

    for (const source of sources) {
      const text = source.content ?? '';
      const est = Math.ceil(text.length / 4);
      if (tokenEstimate + est > this.maxSourceTokens) break;
      context += `[Document ${source.id}]:\n${text}\n\n`;
      tokenEstimate += est;
    }

    const prompt = `Documents:\n${context}\nQuestion: ${question}\n\nProvide a detailed answer based on the documents above:`;

    const start = Date.now();
    const result = await this.llm.generate(prompt, {
      systemPrompt: this.systemPrompt,
      temperature: 0.3,
    });
    steps!.push({
      name: 'stuff_answer',
      input: `${sources.length} docs, question: ${question}`,
      output: result.content.slice(0, 200),
      latencyMs: Date.now() - start,
    });

    return { answer: result.content, usage: result.usage };
  }

  private async mapReduceQA(
    question: string,
    sources: VectorSearchResult[],
    steps: ChainResult['intermediateSteps']
  ): Promise<{ answer: string; usage: ChainResult['usage'] & Record<string, number> }> {
    const totalUsage = { promptTokens: 0, completionTokens: 0, totalTokens: 0 };

    // Map: extract relevant info from each document
    const partialAnswers: string[] = [];

    for (let i = 0; i < sources.length; i++) {
      const text = sources[i].content ?? '';
      if (!text) continue;

      const prompt = `Document:\n${text}\n\nQuestion: ${question}\n\nExtract any information from this document that is relevant to answering the question:`;

      const start = Date.now();
      const result = await this.llm.generate(prompt, {
        systemPrompt: 'Extract relevant information concisely.',
        temperature: 0,
        maxTokens: 512,
      });

      partialAnswers.push(result.content);
      totalUsage.promptTokens += result.usage.promptTokens;
      totalUsage.completionTokens += result.usage.completionTokens;
      totalUsage.totalTokens += result.usage.totalTokens;

      steps!.push({
        name: `map_doc_${i}`,
        input: text.slice(0, 100) + '...',
        output: result.content.slice(0, 100),
        latencyMs: Date.now() - start,
      });
    }

    // Reduce: combine partial answers
    const combined = partialAnswers.join('\n\n');
    const reducePrompt = `Based on the following extracted information, provide a comprehensive answer to the question.\n\nExtracted Information:\n${combined}\n\nQuestion: ${question}\n\nAnswer:`;

    const reduceStart = Date.now();
    const finalResult = await this.llm.generate(reducePrompt, {
      systemPrompt: this.systemPrompt,
      temperature: 0.3,
    });

    totalUsage.promptTokens += finalResult.usage.promptTokens;
    totalUsage.completionTokens += finalResult.usage.completionTokens;
    totalUsage.totalTokens += finalResult.usage.totalTokens;

    steps!.push({
      name: 'reduce_answer',
      input: `${partialAnswers.length} partial answers`,
      output: finalResult.content.slice(0, 200),
      latencyMs: Date.now() - reduceStart,
    });

    return { answer: finalResult.content, usage: totalUsage };
  }

  private async refineQA(
    question: string,
    sources: VectorSearchResult[],
    steps: ChainResult['intermediateSteps']
  ): Promise<{ answer: string; usage: ChainResult['usage'] & Record<string, number> }> {
    const totalUsage = { promptTokens: 0, completionTokens: 0, totalTokens: 0 };

    // Initial answer from first document
    const firstText = sources[0]?.content ?? '';
    const initialPrompt = `Document:\n${firstText}\n\nQuestion: ${question}\n\nAnswer based on this document:`;

    const initialStart = Date.now();
    const initialResult = await this.llm.generate(initialPrompt, {
      systemPrompt: this.systemPrompt,
      temperature: 0.3,
    });

    let currentAnswer = initialResult.content;
    totalUsage.promptTokens += initialResult.usage.promptTokens;
    totalUsage.completionTokens += initialResult.usage.completionTokens;
    totalUsage.totalTokens += initialResult.usage.totalTokens;

    steps!.push({
      name: 'initial_answer',
      input: firstText.slice(0, 100) + '...',
      output: currentAnswer.slice(0, 100),
      latencyMs: Date.now() - initialStart,
    });

    // Refine with each subsequent document
    for (let i = 1; i < sources.length; i++) {
      const text = sources[i].content ?? '';
      if (!text) continue;

      const refinePrompt = `Existing answer:\n${currentAnswer}\n\nNew document:\n${text}\n\nQuestion: ${question}\n\nRefine the existing answer using the new document. If the new document adds relevant information, incorporate it. If not, keep the existing answer:`;

      const refineStart = Date.now();
      const refineResult = await this.llm.generate(refinePrompt, {
        systemPrompt: this.systemPrompt,
        temperature: 0.3,
      });

      currentAnswer = refineResult.content;
      totalUsage.promptTokens += refineResult.usage.promptTokens;
      totalUsage.completionTokens += refineResult.usage.completionTokens;
      totalUsage.totalTokens += refineResult.usage.totalTokens;

      steps!.push({
        name: `refine_${i}`,
        input: text.slice(0, 100) + '...',
        output: currentAnswer.slice(0, 100),
        latencyMs: Date.now() - refineStart,
      });
    }

    return { answer: currentAnswer, usage: totalUsage };
  }
}
