import type { LLMAdapter, VectorDBAdapter } from '../types/index.js';
import type { Knowledge } from '../core/knowledge.js';
import type { 
  WorkflowConfig, 
  WorkflowContext, 
  WorkflowResult 
} from './types.js';

export class Workflow {
  private config: WorkflowConfig;
  private llm: LLMAdapter;
  private vectorDB?: VectorDBAdapter;
  private knowledge?: Knowledge;

  constructor(
    config: WorkflowConfig, 
    llm: LLMAdapter, 
    vectorDB?: VectorDBAdapter,
    knowledge?: Knowledge,
  ) {
    this.config = config;
    this.llm = llm;
    this.vectorDB = vectorDB;
    this.knowledge = knowledge;
  }

  async run(input: string | { input: string; metadata?: Record<string, unknown> }): Promise<WorkflowResult> {
    const startTime = Date.now();
    const inputStr = typeof input === 'string' ? input : input.input;
    const inputMetadata = typeof input === 'string' ? {} : (input.metadata ?? {});

    let ctx: WorkflowContext = {
      input: inputStr,
      output: '',
      history: [],
      context: [],
      metadata: { ...inputMetadata },
      llm: this.llm,
      vectorDB: this.vectorDB,
      knowledge: this.knowledge,
    };

    for (const step of this.config.steps) {
      let retries = 0;
      const maxRetries = this.config.maxRetries ?? 0;

      while (true) {
        try {
          ctx = await step.execute(ctx);

          const lastStep = ctx.history[ctx.history.length - 1];
          if (lastStep && this.config.onStepComplete) {
            this.config.onStepComplete(lastStep, ctx);
          }

          break;
        } catch (error) {
          retries++;
          if (this.config.onError) {
            this.config.onError(error as Error, step.name, ctx);
          }

          if (retries > maxRetries) {
            throw new Error(`Workflow step "${step.name}" failed after ${retries} attempts: ${(error as Error).message}`);
          }
        }
      }
    }

    const totalTokens = ctx.history.reduce(
      (sum, step) => sum + (step.usage?.totalTokens ?? 0), 
      0
    );

    return {
      name: this.config.name,
      input: inputStr,
      output: ctx.output,
      steps: ctx.history,
      totalLatencyMs: Date.now() - startTime,
      totalTokens,
      metadata: ctx.metadata,
    };
  }
}
