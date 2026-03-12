import crypto from 'crypto';
import type { LLMAdapter } from '@orkajs/core';
import type { Memory } from '@orkajs/memory-store';
import type { AgentStepResult } from '../types.js';
import { BaseAgent } from '../base-agent.js';
import type {
  HITLAgentConfig,
  HITLAgentResult,
  HITLConfig,
  InterruptRequest,
  InterruptResponse,
  InterruptData,
  InterruptReason,
  Checkpoint,
  CheckpointState,
  CheckpointStep,
} from './types.js';
import { MemoryCheckpointStore } from './memory-checkpoint-store.js';

export class HITLAgent extends BaseAgent {
  private verbose: boolean;
  private hitlConfig: HITLConfig;
  private agentId: string;
  private interrupts: InterruptResponse[] = [];
  private checkpointIds: string[] = [];

  constructor(config: HITLAgentConfig, llm: LLMAdapter, memory?: Memory) {
    super(config, llm, memory, 'hitl');
    this.verbose = config.verbose ?? false;
    this.hitlConfig = config.hitl;
    this.agentId = config.name ?? this.generateId();
    
    if (!this.hitlConfig.checkpointStore) {
      this.hitlConfig.checkpointStore = new MemoryCheckpointStore();
    }
  }

  async run(input: string, resumeFromCheckpoint?: string): Promise<HITLAgentResult> {
    const startTime = Date.now();
    let steps: AgentStepResult[] = [];
    let startStep = 0;
    let resumedFromCheckpoint: string | undefined;

    if (resumeFromCheckpoint) {
      const checkpoint = await this.hitlConfig.checkpointStore?.load(resumeFromCheckpoint);
      if (checkpoint) {
        steps = checkpoint.state.steps.map(s => ({
          ...s,
          latencyMs: 0,
        }));
        startStep = checkpoint.stepNumber;
        resumedFromCheckpoint = checkpoint.id;
        if (this.verbose) {
          console.log(`[HITL] Resumed from checkpoint ${checkpoint.id} at step ${startStep}`);
        }
      }
    }

    this.interrupts = [];
    this.checkpointIds = [];
    const memoryContext = this.getMemoryContext();

    this.emit({ type: 'step:start', agentType: this.agentType, input });

    for (let step = startStep; step < this.maxSteps; step++) {
      const stepStart = Date.now();
      const prompt = this.buildPrompt(input, steps, memoryContext);

      const result = await this.llm.generate(prompt, {
        temperature: this.temperature,
        maxTokens: 2048,
        systemPrompt: this.buildSystemPrompt(),
      });

      const parsed = this.parseResponse(result.content);

      if (this.verbose) {
        console.log(`[HITL Step ${step + 1}]`);
        console.log(`  Thought: ${parsed.thought}`);
        console.log(`  Action: ${parsed.action}`);
        console.log(`  Action Input: ${JSON.stringify(parsed.actionInput)}`);
      }

      if (parsed.action === 'finish') {
        const finalAnswer = (parsed.actionInput.answer as string) ?? parsed.thought;
        this.saveToMemory(input, finalAnswer);
        this.emit({ type: 'complete', agentType: this.agentType, output: finalAnswer });

        return this.buildHITLResult(input, finalAnswer, steps, startTime, resumedFromCheckpoint);
      }

      const shouldCheckpoint = this.hitlConfig.checkpointEvery && 
        (step + 1) % this.hitlConfig.checkpointEvery === 0;

      if (shouldCheckpoint) {
        await this.createCheckpoint(input, steps, step);
      }

      const approvalResult = await this.handleToolApproval(parsed.action, parsed.actionInput, step, parsed.thought);
      
      if (approvalResult.status === 'rejected') {
        const rejectionMessage = `Tool "${parsed.action}" was rejected by human reviewer. Feedback: ${approvalResult.feedback ?? 'No feedback provided'}`;
        
        steps.push({
          thought: parsed.thought,
          action: parsed.action,
          actionInput: parsed.actionInput,
          observation: rejectionMessage,
          latencyMs: Date.now() - stepStart,
          usage: {
            promptTokens: result.usage.promptTokens,
            completionTokens: result.usage.completionTokens,
            totalTokens: result.usage.totalTokens,
          },
        });

        this.emit({ type: 'step:end', agentType: this.agentType, step, output: rejectionMessage });
        continue;
      }

      const toolName = approvalResult.status === 'modified' && approvalResult.modifiedData?.toolName
        ? approvalResult.modifiedData.toolName
        : parsed.action;
      
      const toolInput = approvalResult.status === 'modified' && approvalResult.modifiedData?.toolInput
        ? approvalResult.modifiedData.toolInput
        : parsed.actionInput;

      const observation = await this.executeTool(toolName, toolInput);

      if (this.verbose) {
        console.log(`  Observation: ${observation.slice(0, 200)}`);
      }

      steps.push({
        thought: parsed.thought,
        action: toolName,
        actionInput: toolInput,
        observation,
        latencyMs: Date.now() - stepStart,
        usage: {
          promptTokens: result.usage.promptTokens,
          completionTokens: result.usage.completionTokens,
          totalTokens: result.usage.totalTokens,
        },
      });

      this.emit({ type: 'step:end', agentType: this.agentType, step, output: observation });
    }

    const fallback = steps.length > 0
      ? `Reached max steps (${this.maxSteps}). Last observations:\n${steps.slice(-3).map(s => s.observation).join('\n')}`
      : 'Unable to process request.';

    this.saveToMemory(input, fallback);
    return this.buildHITLResult(input, fallback, steps, startTime, resumedFromCheckpoint, true);
  }

  async interrupt(
    reason: InterruptReason,
    message: string,
    data: InterruptData = {},
  ): Promise<InterruptResponse> {
    if (!this.hitlConfig.onInterrupt) {
      return {
        id: this.generateId(),
        status: 'approved',
        respondedAt: new Date(),
      };
    }

    const request: InterruptRequest = {
      id: this.generateId(),
      agentId: this.agentId,
      reason,
      message,
      data,
      createdAt: new Date(),
      timeoutMs: this.hitlConfig.defaultTimeoutMs,
    };

    if (this.verbose) {
      console.log(`[HITL] Interrupt requested: ${reason} - ${message}`);
    }

    const response = await this.hitlConfig.onInterrupt(request);
    this.interrupts.push(response);

    if (this.verbose) {
      console.log(`[HITL] Interrupt response: ${response.status}`);
    }

    return response;
  }

  async requestConfirmation(message: string, context?: Record<string, unknown>): Promise<InterruptResponse> {
    return this.interrupt('confirmation', message, { context });
  }

  async requestReview(message: string, stepNumber: number, thought: string): Promise<InterruptResponse> {
    return this.interrupt('review', message, { stepNumber, thought });
  }

  private async handleToolApproval(
    toolName: string,
    toolInput: Record<string, unknown>,
    stepNumber: number,
    thought: string,
  ): Promise<InterruptResponse> {
    if (this.hitlConfig.autoApproveTools?.includes(toolName)) {
      return {
        id: this.generateId(),
        status: 'approved',
        respondedAt: new Date(),
      };
    }

    const requiresApproval = this.hitlConfig.requireApprovalFor?.includes(toolName) ||
      (this.hitlConfig.requireApprovalFor?.includes('*') && !this.hitlConfig.autoApproveTools?.includes(toolName));

    if (!requiresApproval) {
      return {
        id: this.generateId(),
        status: 'approved',
        respondedAt: new Date(),
      };
    }

    return this.interrupt('tool_approval', `Approve tool "${toolName}"?`, {
      toolName,
      toolInput,
      stepNumber,
      thought,
    });
  }

  private async createCheckpoint(input: string, steps: AgentStepResult[], stepNumber: number): Promise<void> {
    const checkpointSteps: CheckpointStep[] = steps.map(s => ({
      thought: s.thought,
      action: s.action,
      actionInput: s.actionInput,
      observation: s.observation,
    }));

    const state: CheckpointState = {
      input,
      steps: checkpointSteps,
      context: {},
    };

    const checkpoint: Checkpoint = {
      id: this.generateId(),
      agentId: this.agentId,
      stepNumber,
      state,
      createdAt: new Date(),
    };

    await this.hitlConfig.checkpointStore?.save(checkpoint);
    this.checkpointIds.push(checkpoint.id);

    if (this.verbose) {
      console.log(`[HITL] Checkpoint created: ${checkpoint.id} at step ${stepNumber}`);
    }

    await this.interrupt('checkpoint', `Checkpoint created at step ${stepNumber}`, {
      stepNumber,
      context: { checkpointId: checkpoint.id },
    });
  }

  async getCheckpoints(): Promise<Checkpoint[]> {
    return this.hitlConfig.checkpointStore?.list(this.agentId) ?? [];
  }

  async loadCheckpoint(checkpointId: string): Promise<Checkpoint | null> {
    return this.hitlConfig.checkpointStore?.load(checkpointId) ?? null;
  }

  private buildHITLResult(
    input: string,
    output: string,
    steps: AgentStepResult[],
    startTime: number,
    resumedFromCheckpoint?: string,
    maxStepsReached = false,
  ): HITLAgentResult {
    const baseResult = this.buildResult(input, output, steps, startTime, { maxStepsReached });
    
    return {
      ...baseResult,
      interrupts: this.interrupts,
      checkpoints: this.checkpointIds,
      wasInterrupted: this.interrupts.length > 0,
      resumedFromCheckpoint,
    };
  }

  private buildSystemPrompt(): string {
    const toolDescriptions = this.getToolDescriptions();
    const rules = this.getRulesString();

    return `You are an AI agent with human-in-the-loop capabilities. Your goal: ${this.goal}

You follow a structured reasoning pattern:
1. THINK about what you need to do
2. ACT by using a tool (some tools may require human approval)
3. OBSERVE the result
4. REPEAT until you can provide a final answer

Available tools:
${toolDescriptions}

${rules ? `Rules:\n${rules}\n` : ''}
You MUST respond in this EXACT format:

Thought: <your step-by-step reasoning about what to do next>
Action: <tool_name>
Action Input: <JSON object with tool parameters>

When you have enough information to answer, use:
Thought: <your final reasoning>
Action: finish
Action Input: {"answer": "<your comprehensive final answer>"}

${this.systemPrompt ?? ''}`;
  }

  private buildPrompt(input: string, steps: AgentStepResult[], memoryContext: string): string {
    let prompt = `${memoryContext}\nQuestion: ${input}\n`;

    if (steps.length > 0) {
      prompt += '\n';
      for (const step of steps) {
        prompt += `Thought: ${step.thought}\n`;
        prompt += `Action: ${step.action}\n`;
        prompt += `Action Input: ${JSON.stringify(step.actionInput)}\n`;
        prompt += `Observation: ${step.observation}\n\n`;
      }
    }

    return prompt;
  }

  private parseResponse(content: string): { thought: string; action: string; actionInput: Record<string, unknown> } {
    const thoughtMatch = content.match(/Thought:\s*(.*?)(?=\nAction:)/s);
    const actionMatch = content.match(/Action:\s*(.*?)(?=\nAction Input:)/s);
    const actionInputMatch = content.match(/Action Input:\s*(.*)/s);

    const thought = thoughtMatch?.[1]?.trim() ?? content;
    const action = actionMatch?.[1]?.trim() ?? 'finish';

    let actionInput: Record<string, unknown> = {};
    if (actionInputMatch?.[1]) {
      actionInput = this.parseJsonFromText(actionInputMatch[1]);
    }

    if (action === 'finish' && !actionInput.answer) {
      actionInput.answer = thought;
    }

    return { thought, action, actionInput };
  }

  private generateId(): string {
    const timestamp = Date.now().toString(36);
    const random = crypto.randomBytes(4).toString('hex');
    return `${timestamp}-${random}`;
  }
}
