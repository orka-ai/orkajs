import type { LLMAdapter, VectorDBAdapter } from '@orka-js/core';
import { OrkaError, OrkaErrorCode, generateId } from '@orka-js/core';
import type { Knowledge } from '@orka-js/core';
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
    const cb = this.config.callbacks;
    const chainRunId = generateId();

    await cb?.emit({ type: 'chain_start', timestamp: Date.now(), runId: chainRunId, chainName: this.config.name, input: inputStr });

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

    try {
      for (const step of this.config.steps) {
        let retries = 0;
        const maxRetries = this.config.maxRetries ?? 0;
        const stepRunId = generateId();

        while (true) {
          try {
            await cb?.emit({ type: 'tool_start', timestamp: Date.now(), runId: stepRunId, parentRunId: chainRunId, toolName: step.name, input: ctx.input });
            const stepStartTime = Date.now();
            ctx = await step.execute(ctx);

            const lastStep = ctx.history[ctx.history.length - 1];
            if (lastStep) {
              await cb?.emit({ type: 'tool_end', timestamp: Date.now(), runId: stepRunId, parentRunId: chainRunId, toolName: step.name, input: ctx.input, output: lastStep.output, durationMs: Date.now() - stepStartTime });
              if (this.config.onStepComplete) {
                this.config.onStepComplete(lastStep, ctx);
              }
            }

            break;
          } catch (error) {
            retries++;
            await cb?.emit({ type: 'tool_error', timestamp: Date.now(), runId: stepRunId, parentRunId: chainRunId, toolName: step.name, input: ctx.input, error: error instanceof Error ? error : new Error(String(error)) });
            if (this.config.onError) {
              this.config.onError(error as Error, step.name, ctx);
            }

            if (retries > maxRetries) {
              throw new OrkaError(
                `Workflow step "${step.name}" failed after ${retries} attempts: ${error instanceof Error ? error.message : String(error)}`,
                OrkaErrorCode.EXTERNAL_SERVICE_ERROR,
                'Workflow',
                error instanceof Error ? error : undefined,
                { stepName: step.name, attempts: retries }
              );
            }
          }
        }
      }
    } catch (err) {
      await cb?.emit({ type: 'chain_error', timestamp: Date.now(), runId: chainRunId, chainName: this.config.name, error: err instanceof Error ? err : new Error(String(err)) });
      throw err;
    }

    const totalTokens = ctx.history.reduce(
      (sum, step) => sum + (step.usage?.totalTokens ?? 0),
      0
    );

    const result: WorkflowResult = {
      name: this.config.name,
      input: inputStr,
      output: ctx.output,
      steps: ctx.history,
      totalLatencyMs: Date.now() - startTime,
      totalTokens,
      metadata: ctx.metadata,
    };

    await cb?.emit({ type: 'chain_end', timestamp: Date.now(), runId: chainRunId, chainName: this.config.name, output: result, durationMs: result.totalLatencyMs });

    return result;
  }
}
