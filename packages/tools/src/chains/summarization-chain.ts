import type { LLMAdapter } from '@orka-js/core';
import type { ChainResult, SummarizationChainOptions } from './types.js';

export class SummarizationChain {
  private llm: LLMAdapter;
  private strategy: 'stuff' | 'map-reduce' | 'refine';
  private systemPrompt: string;
  private maxChunkSize: number;
  private combinePrompt: string;
  private refinePrompt: string;

  constructor(options: SummarizationChainOptions) {
    this.llm = options.llm;
    this.strategy = options.strategy;
    this.maxChunkSize = options.maxChunkSize ?? 3000;
    this.systemPrompt = options.systemPrompt ?? 'You are an expert summarizer. Provide clear, concise, and accurate summaries.';
    this.combinePrompt = options.combinePrompt ??
      'Combine the following summaries into a single coherent summary:\n\n{{summaries}}\n\nCombined Summary:';
    this.refinePrompt = options.refinePrompt ??
      'Here is an existing summary:\n{{existingSummary}}\n\nRefine this summary with the following additional context:\n{{context}}\n\nRefined Summary:';
  }

  async call(texts: string[]): Promise<ChainResult> {
    switch (this.strategy) {
      case 'stuff':
        return this.stuffStrategy(texts);
      case 'map-reduce':
        return this.mapReduceStrategy(texts);
      case 'refine':
        return this.refineStrategy(texts);
      default:
        throw new Error(`Unknown strategy: ${this.strategy}`);
    }
  }

  private async stuffStrategy(texts: string[]): Promise<ChainResult> {
    const steps: ChainResult['intermediateSteps'] = [];
    const combined = texts.join('\n\n---\n\n');

    const prompt = `Summarize the following text:\n\n${combined}\n\nSummary:`;

    const start = Date.now();
    const result = await this.llm.generate(prompt, {
      systemPrompt: this.systemPrompt,
      temperature: 0.3,
    });
    steps.push({
      name: 'stuff_summarize',
      input: `${texts.length} documents (${combined.length} chars)`,
      output: result.content.slice(0, 200),
      latencyMs: Date.now() - start,
    });

    return {
      answer: result.content,
      intermediateSteps: steps,
      usage: result.usage,
    };
  }

  private async mapReduceStrategy(texts: string[]): Promise<ChainResult> {
    const steps: ChainResult['intermediateSteps'] = [];
    let totalUsage = { promptTokens: 0, completionTokens: 0, totalTokens: 0 };

    // Map phase: summarize each chunk independently
    const chunkSummaries: string[] = [];

    for (let i = 0; i < texts.length; i++) {
      const chunks = this.splitText(texts[i]);

      for (const chunk of chunks) {
        const prompt = `Summarize the following text:\n\n${chunk}\n\nSummary:`;
        const start = Date.now();
        const result = await this.llm.generate(prompt, {
          systemPrompt: this.systemPrompt,
          temperature: 0.3,
        });

        chunkSummaries.push(result.content);
        totalUsage.promptTokens += result.usage.promptTokens;
        totalUsage.completionTokens += result.usage.completionTokens;
        totalUsage.totalTokens += result.usage.totalTokens;

        steps.push({
          name: `map_chunk_${i}`,
          input: chunk.slice(0, 100) + '...',
          output: result.content.slice(0, 100),
          latencyMs: Date.now() - start,
        });
      }
    }

    // Reduce phase: combine all summaries
    const combinedSummaries = chunkSummaries.join('\n\n');
    const combinePrompt = this.combinePrompt.replace('{{summaries}}', combinedSummaries);

    const reduceStart = Date.now();
    const finalResult = await this.llm.generate(combinePrompt, {
      systemPrompt: this.systemPrompt,
      temperature: 0.3,
    });

    totalUsage.promptTokens += finalResult.usage.promptTokens;
    totalUsage.completionTokens += finalResult.usage.completionTokens;
    totalUsage.totalTokens += finalResult.usage.totalTokens;

    steps.push({
      name: 'reduce_combine',
      input: `${chunkSummaries.length} summaries`,
      output: finalResult.content.slice(0, 200),
      latencyMs: Date.now() - reduceStart,
    });

    return {
      answer: finalResult.content,
      intermediateSteps: steps,
      usage: totalUsage,
    };
  }

  private async refineStrategy(texts: string[]): Promise<ChainResult> {
    const steps: ChainResult['intermediateSteps'] = [];
    let totalUsage = { promptTokens: 0, completionTokens: 0, totalTokens: 0 };

    // Get all chunks
    const allChunks: string[] = [];
    for (const text of texts) {
      allChunks.push(...this.splitText(text));
    }

    if (allChunks.length === 0) {
      return { answer: '', intermediateSteps: steps };
    }

    // Initial summary from first chunk
    const initialPrompt = `Summarize the following text:\n\n${allChunks[0]}\n\nSummary:`;
    const initialStart = Date.now();
    const initialResult = await this.llm.generate(initialPrompt, {
      systemPrompt: this.systemPrompt,
      temperature: 0.3,
    });

    let currentSummary = initialResult.content;
    totalUsage.promptTokens += initialResult.usage.promptTokens;
    totalUsage.completionTokens += initialResult.usage.completionTokens;
    totalUsage.totalTokens += initialResult.usage.totalTokens;

    steps.push({
      name: 'initial_summary',
      input: allChunks[0].slice(0, 100) + '...',
      output: currentSummary.slice(0, 100),
      latencyMs: Date.now() - initialStart,
    });

    // Refine with each subsequent chunk
    for (let i = 1; i < allChunks.length; i++) {
      const refinePromptText = this.refinePrompt
        .replace('{{existingSummary}}', currentSummary)
        .replace('{{context}}', allChunks[i]);

      const refineStart = Date.now();
      const refineResult = await this.llm.generate(refinePromptText, {
        systemPrompt: this.systemPrompt,
        temperature: 0.3,
      });

      currentSummary = refineResult.content;
      totalUsage.promptTokens += refineResult.usage.promptTokens;
      totalUsage.completionTokens += refineResult.usage.completionTokens;
      totalUsage.totalTokens += refineResult.usage.totalTokens;

      steps.push({
        name: `refine_${i}`,
        input: allChunks[i].slice(0, 100) + '...',
        output: currentSummary.slice(0, 100),
        latencyMs: Date.now() - refineStart,
      });
    }

    return {
      answer: currentSummary,
      intermediateSteps: steps,
      usage: totalUsage,
    };
  }

  private splitText(text: string): string[] {
    if (text.length <= this.maxChunkSize) return [text];

    const chunks: string[] = [];
    const paragraphs = text.split('\n\n');
    let current = '';

    for (const para of paragraphs) {
      if (current.length + para.length > this.maxChunkSize && current.length > 0) {
        chunks.push(current.trim());
        current = '';
      }
      current += para + '\n\n';
    }

    if (current.trim().length > 0) {
      chunks.push(current.trim());
    }

    return chunks;
  }
}
