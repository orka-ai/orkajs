import type { 
  OrkaConfig, 
  AskOptions, 
  AskResult,
  RetrievedContext,
  LLMAdapter,
  VectorDBAdapter,
  DatabaseAdapter,
  OrkaDefaults
} from '../types/index.js';
import { Knowledge } from './knowledge.js';
import { Workflow } from '../workflow/workflow.js';
import type { WorkflowConfig } from '../workflow/types.js';
import { Evaluator } from '../evaluation/evaluator.js';
import type { EvaluateOptions } from '../evaluation/evaluator.js';
import type { EvalSummary } from '../evaluation/metrics.js';
import { Agent } from '../agent/agent.js';
import type { AgentConfig } from '../agent/types.js';
import { Memory, type MemoryConfig } from '../memory/memory.js';
import { SessionMemory } from '../memory/session-memory.js';
import { Tracer } from '../observability/tracer.js';
import type { ObservabilityHook, LogLevel } from '../observability/types.js';
import { GraphWorkflow } from '../graph/graph-workflow.js';
import type { GraphConfig } from '../graph/types.js';
import { PromptRegistry } from '../prompts/registry.js';
import type { PromptRegistryConfig } from '../prompts/types.js';
import { TestRunner } from '../evaluation/test-runner.js';
import type { TestSuiteConfig } from '../evaluation/test-runner.js';
import type { TestSuiteReport } from '../evaluation/reporters.js';

export interface OrkaFullConfig extends OrkaConfig {
  observability?: {
    logLevel?: LogLevel;
    hooks?: ObservabilityHook[];
  };
  memory?: MemoryConfig;
  prompts?: PromptRegistryConfig;
}

export class Orka {
  private llm: LLMAdapter;
  private vectorDB?: VectorDBAdapter;
  private database?: DatabaseAdapter;
  private defaults: OrkaDefaults;
  
  public readonly knowledge: Knowledge;
  public readonly tracer: Tracer;
  public readonly prompts: PromptRegistry;
  private _memory?: Memory;
  private _sessionMemory?: SessionMemory;

  constructor(config: OrkaFullConfig) {
    this.llm = config.llm;
    this.vectorDB = config.vectorDB;
    this.database = config.database;
    this.defaults = config.defaults ?? {};

    if (!this.vectorDB) {
      throw new Error('VectorDB adapter is required. Use MemoryVectorAdapter for quick start.');
    }

    this.knowledge = new Knowledge(this.llm, this.vectorDB, this.defaults);
    this.tracer = new Tracer(config.observability);

    this.prompts = new PromptRegistry(config.prompts);

    if (config.memory) {
      this._memory = new Memory(config.memory);
    }
  }

  /**
   * Ask a question using the knowledge base
   * @param options - Ask options
   * @returns Ask result
   */
  async ask(options: AskOptions): Promise<AskResult> {
    const startTime = Date.now();
    const {
      knowledge,
      question,
      systemPrompt,
      topK = this.defaults.topK ?? 5,
      temperature = this.defaults.temperature ?? 0.7,
      maxTokens = this.defaults.maxTokens ?? 1024,
      includeContext = false,
    } = options;

    let context: RetrievedContext[] = [];
    let contextText = '';

    if (knowledge) {
      const results = await this.knowledge.search(knowledge, question, { topK });
      context = results.map(r => ({
        content: r.content ?? '',
        score: r.score,
        metadata: r.metadata,
      }));
      contextText = context.map(c => c.content).join('\n\n---\n\n');
    }

    const prompt = this.buildPrompt(question, contextText, systemPrompt);
    
    const result = await this.llm.generate(prompt, {
      temperature,
      maxTokens,
      systemPrompt: systemPrompt ?? this.getDefaultSystemPrompt(!!knowledge),
    });

    const latencyMs = Date.now() - startTime;

    const askResult: AskResult = {
      answer: result.content,
      usage: {
        promptTokens: result.usage.promptTokens,
        completionTokens: result.usage.completionTokens,
        totalTokens: result.usage.totalTokens,
      },
      latencyMs,
    };

    if (includeContext) {
      askResult.context = context;
    }

    return askResult;
  }

  /**
   * Generate a response using the LLM
   * @param prompt - The prompt to generate a response for
   * @param options - Generation options
   * @returns Generated response
   */
  async generate(prompt: string, options?: { temperature?: number; maxTokens?: number; systemPrompt?: string }): Promise<string> {
    const result = await this.llm.generate(prompt, {
      temperature: options?.temperature ?? this.defaults.temperature ?? 0.7,
      maxTokens: options?.maxTokens ?? this.defaults.maxTokens ?? 1024,
      systemPrompt: options?.systemPrompt,
    });
    return result.content;
  }

  /**
   * Embed text using the LLM
   * @param text - The text to embed
   * @returns Embeddings
   */
  async embed(text: string | string[]): Promise<number[][]> {
    const texts = Array.isArray(text) ? text : [text];
    return this.llm.embed(texts);
  }

  /**
   * Create a new workflow
   * @param config - Workflow configuration 
   * @returns Workflow instance
   */
  workflow(config: WorkflowConfig): Workflow {
    return new Workflow(config, this.llm, this.vectorDB, this.knowledge);
  }

  /**
   * Create a new agent
   * @param config - Agent configuration
   * @returns Agent instance
   */
  agent(config: AgentConfig): Agent {
    return new Agent(config, this.llm, this.vectorDB, this.knowledge, this._memory);
  }

  /**
   * Evaluate a workflow or agent
   * @param options - Evaluation options
   * @returns Evaluation summary
   */
  async evaluate(options: EvaluateOptions): Promise<EvalSummary> {
    const evaluator = new Evaluator(this, this.llm);
    return evaluator.evaluate(options);
  }

  /**
   * Get or create memory instance
   * @returns Memory instance
   */
  memory(): Memory {
    if (!this._memory) {
      this._memory = new Memory();
    }
    return this._memory;
  }

  /**
   * Get or create session memory instance
   * @returns SessionMemory instance
   */
  sessions(): SessionMemory {
    if (!this._sessionMemory) {
      this._sessionMemory = new SessionMemory();
    }
    return this._sessionMemory;
  }

  /**
   * Get database adapter
   * @returns Database adapter or undefined
   */
  getDatabase(): DatabaseAdapter | undefined {
    return this.database;
  }

  /**
   * Create a new graph workflow
   * @param config - Graph configuration
   * @returns GraphWorkflow instance
   */
  graph(config: GraphConfig): GraphWorkflow {
    return new GraphWorkflow(config, this.llm, this.vectorDB, this.knowledge);
  }

  /**
   * Run a test suite
   * @param config - Test suite configuration
   * @returns Test suite report
   */
  async test(config: TestSuiteConfig): Promise<TestSuiteReport> {
    const runner = new TestRunner(this);
    return runner.run(config);
  }

  /**
   * Get the LLM adapter
   * @returns LLM adapter
   */
  getLLM(): LLMAdapter {
    return this.llm;
  }

  /**
   * Build a prompt from question and context
   * @param question - The question to answer
   * @param context - The context to use
   * @param _systemPrompt - The system prompt to use (unused)
   * @returns The built prompt
   */
  private buildPrompt(question: string, context: string, _systemPrompt?: string): string {
    if (!context) {
      return question;
    }

    return `Context information:
---
${context}
---

Based on the context above, please answer the following question:
${question}`;
  }

  /**
   * Get the default system prompt
   * @param hasContext - Whether context is available
   * @returns The default system prompt
   */
  private getDefaultSystemPrompt(hasContext: boolean): string {
    if (hasContext) {
      return `You are a helpful assistant. Answer questions based on the provided context. If the context doesn't contain enough information to answer the question, say so clearly. Do not make up information.`;
    }
    return `You are a helpful assistant.`;
  }
}

/**
 * Create a new Orka instance
 * @param config - Orka configuration
 * @returns Orka instance
 */
export function createOrka(config: OrkaFullConfig): Orka {
  return new Orka(config);
}
