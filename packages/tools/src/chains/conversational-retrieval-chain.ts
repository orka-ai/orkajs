import type { Retriever } from '../retrievers/types.js';
import type { LLMAdapter } from '@orka-js/core';
import type { ChainResult, ConversationalRetrievalChainOptions, ChatHistoryEntry } from './types.js';

export class ConversationalRetrievalChain {
  private llm: LLMAdapter;
  private retriever: Retriever;
  private collection: string;
  private systemPrompt: string;
  private returnSources: boolean;
  private maxHistoryLength: number;
  private condenseQuestionPrompt: string;
  private chatHistory: ChatHistoryEntry[] = [];

  constructor(options: ConversationalRetrievalChainOptions) {
    this.llm = options.llm;
    this.retriever = options.retriever;
    this.collection = options.collection;
    this.returnSources = options.returnSources ?? true;
    this.maxHistoryLength = options.maxHistoryLength ?? 10;
    this.systemPrompt = options.systemPrompt ??
      'You are a helpful assistant. Answer the question based on the provided context and conversation history. If the context does not contain enough information, say so clearly.';
    this.condenseQuestionPrompt = options.condenseQuestionPrompt ??
      `Given the following conversation history and a follow-up question, rephrase the follow-up question to be a standalone question that captures the full context.

Chat History:
{{history}}

Follow-up Question: {{question}}

Standalone Question:`;
  }

  async call(question: string): Promise<ChainResult> {
    const steps: ChainResult['intermediateSteps'] = [];

    // Step 1: Condense question with chat history
    let standaloneQuestion = question;

    if (this.chatHistory.length > 0) {
      const condenseStart = Date.now();
      standaloneQuestion = await this.condenseQuestion(question);
      steps.push({
        name: 'condense_question',
        input: question,
        output: standaloneQuestion,
        latencyMs: Date.now() - condenseStart,
      });
    }

    // Step 2: Retrieve relevant documents
    const retrieveStart = Date.now();
    const sources = await this.retriever.retrieve(standaloneQuestion, this.collection);
    steps.push({
      name: 'retrieve',
      input: standaloneQuestion,
      output: `Found ${sources.length} relevant documents`,
      latencyMs: Date.now() - retrieveStart,
    });

    // Step 3: Build context
    const context = sources
      .map(s => s.content ?? '')
      .filter(c => c.length > 0)
      .join('\n---\n');

    // Step 4: Build conversation history string
    const recentHistory = this.chatHistory.slice(-this.maxHistoryLength);
    const historyStr = recentHistory
      .map(h => `${h.role === 'user' ? 'Human' : 'Assistant'}: ${h.content}`)
      .join('\n');

    // Step 5: Generate answer
    const prompt = `Context:\n${context}\n\n${historyStr ? `Conversation History:\n${historyStr}\n\n` : ''}Question: ${question}\n\nAnswer:`;

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

    // Step 6: Update chat history
    this.chatHistory.push({ role: 'user', content: question });
    this.chatHistory.push({ role: 'assistant', content: result.content });

    // Trim history if too long
    if (this.chatHistory.length > this.maxHistoryLength * 2) {
      this.chatHistory = this.chatHistory.slice(-this.maxHistoryLength * 2);
    }

    return {
      answer: result.content,
      sources: this.returnSources ? sources : undefined,
      intermediateSteps: steps,
      usage: result.usage,
    };
  }

  getChatHistory(): ChatHistoryEntry[] {
    return [...this.chatHistory];
  }

  clearHistory(): void {
    this.chatHistory = [];
  }

  private async condenseQuestion(question: string): Promise<string> {
    const recentHistory = this.chatHistory.slice(-this.maxHistoryLength);
    const historyStr = recentHistory
      .map(h => `${h.role === 'user' ? 'Human' : 'Assistant'}: ${h.content}`)
      .join('\n');

    const prompt = this.condenseQuestionPrompt
      .replace('{{history}}', historyStr)
      .replace('{{question}}', question);

    const result = await this.llm.generate(prompt, {
      temperature: 0,
      maxTokens: 256,
    });

    return result.content.trim() || question;
  }
}
