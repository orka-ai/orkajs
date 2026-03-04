import type { LLMAdapter } from '../types/index.js';
import type { Memory } from '../memory/memory.js';
import type {
  PlanAndExecuteAgentConfig,
  PlanAndExecuteResult,
  PlanStep,
  AgentStepResult,
  Tool,
} from './types.js';

export class PlanAndExecuteAgent {
  private config: PlanAndExecuteAgentConfig;
  private llm: LLMAdapter;
  private memory?: Memory;
  private tools: Map<string, Tool>;

  constructor(config: PlanAndExecuteAgentConfig, llm: LLMAdapter, memory?: Memory) {
    this.config = config;
    this.llm = llm;
    this.memory = memory;
    this.tools = new Map(config.tools.map(t => [t.name, t]));
  }

  async run(input: string): Promise<PlanAndExecuteResult> {
    const startTime = Date.now();
    const steps: AgentStepResult[] = [];

    // Phase 1: Create a plan
    const plan = await this.createPlan(input);
    const planStep: AgentStepResult = {
      thought: 'Creating execution plan',
      action: 'plan',
      actionInput: { input },
      observation: plan.map(s => `${s.id}. ${s.description}`).join('\n'),
      latencyMs: 0,
    };
    steps.push(planStep);

    // Phase 2: Execute each step
    for (const planItem of plan) {
      if (steps.length > (this.config.maxSteps ?? 15)) break;

      planItem.status = 'in_progress';
      const stepStart = Date.now();

      const executionResult = await this.executeStep(planItem, plan, steps, input);

      planItem.status = executionResult.success ? 'completed' : 'failed';
      planItem.result = executionResult.observation;

      steps.push({
        thought: `Executing step ${planItem.id}: ${planItem.description}`,
        action: executionResult.toolUsed,
        actionInput: executionResult.actionInput,
        observation: executionResult.observation,
        latencyMs: Date.now() - stepStart,
        usage: executionResult.usage,
      });

      // Replan on failure if enabled
      if (!executionResult.success && this.config.replanOnFailure) {
        const remainingSteps = plan.filter(s => s.status === 'pending');
        if (remainingSteps.length > 0) {
          const newPlan = await this.replan(input, plan, executionResult.observation);
          for (let i = 0; i < remainingSteps.length && i < newPlan.length; i++) {
            remainingSteps[i].description = newPlan[i];
          }
        }
      }
    }

    // Phase 3: Synthesize final answer
    const synthesisStart = Date.now();
    const finalAnswer = await this.synthesize(input, plan);

    steps.push({
      thought: 'Synthesizing final answer from all step results',
      action: 'synthesize',
      actionInput: {},
      observation: finalAnswer,
      latencyMs: Date.now() - synthesisStart,
    });

    if (this.memory) {
      this.memory.addMessage({ role: 'user', content: input });
      this.memory.addMessage({ role: 'assistant', content: finalAnswer });
    }

    return {
      input,
      output: finalAnswer,
      steps,
      plan,
      totalLatencyMs: Date.now() - startTime,
      totalTokens: steps.reduce((s, st) => s + (st.usage?.totalTokens ?? 0), 0),
      toolsUsed: [...new Set(steps.map(s => s.action).filter(a => a !== 'plan' && a !== 'synthesize'))],
      metadata: { agentType: 'plan-and-execute', planSteps: plan.length },
    };
  }

  private async createPlan(input: string): Promise<PlanStep[]> {
    const toolList = [...this.tools.values()]
      .map(t => `- ${t.name}: ${t.description}`)
      .join('\n');

    const prompt = `Create a step-by-step plan to accomplish the following task.

Task: ${input}

Available tools:
${toolList}

Respond with a numbered list of steps. Each step should be a clear, actionable instruction.
Only include necessary steps. Be concise.

Plan:`;

    const result = await this.llm.generate(prompt, {
      temperature: this.config.temperature ?? 0.2,
      maxTokens: 1024,
      systemPrompt: `You are a planning agent. Your goal: ${this.config.goal}\n${this.config.systemPrompt ?? ''}`,
    });

    return this.parsePlan(result.content);
  }

  private async executeStep(
    planItem: PlanStep,
    allSteps: PlanStep[],
    _previousResults: AgentStepResult[],
    originalInput: string,
  ): Promise<{ success: boolean; observation: string; toolUsed: string; actionInput: Record<string, unknown>; usage?: AgentStepResult['usage'] }> {
    const completedContext = allSteps
      .filter(s => s.status === 'completed')
      .map(s => `Step ${s.id}: ${s.description} → ${s.result}`)
      .join('\n');

    const toolList = [...this.tools.values()]
      .map(t => {
        const params = t.parameters?.map(p => `  ${p.name} (${p.type}): ${p.description}`).join('\n') ?? '';
        return `${t.name}: ${t.description}${params ? '\n' + params : ''}`;
      })
      .join('\n');

    const prompt = `You are executing step ${planItem.id} of a plan.

Original task: ${originalInput}

Current step: ${planItem.description}

${completedContext ? `Completed steps:\n${completedContext}\n` : ''}
Available tools:
${toolList}

Choose a tool and provide the input. Respond in this format:
Tool: <tool_name>
Input: <JSON object with parameters>`;

    const result = await this.llm.generate(prompt, {
      temperature: this.config.temperature ?? 0.2,
      maxTokens: 1024,
    });

    const toolMatch = result.content.match(/Tool:\s*(.*?)(?=\nInput:)/s);
    const inputMatch = result.content.match(/Input:\s*(.*)/s);

    const toolName = toolMatch?.[1]?.trim() ?? '';
    let actionInput: Record<string, unknown> = {};

    if (inputMatch?.[1]) {
      try {
        const jsonMatch = inputMatch[1].match(/\{[\s\S]*\}/);
        actionInput = JSON.parse(jsonMatch?.[0] ?? '{}');
      } catch {
        actionInput = { raw: inputMatch[1].trim() };
      }
    }

    const tool = this.tools.get(toolName);
    if (!tool) {
      return {
        success: false,
        observation: `Tool "${toolName}" not found. Available: ${[...this.tools.keys()].join(', ')}`,
        toolUsed: toolName,
        actionInput,
        usage: { promptTokens: result.usage.promptTokens, completionTokens: result.usage.completionTokens, totalTokens: result.usage.totalTokens },
      };
    }

    try {
      const toolResult = await tool.execute(actionInput);
      return {
        success: !toolResult.error,
        observation: toolResult.error ?? toolResult.output,
        toolUsed: toolName,
        actionInput,
        usage: { promptTokens: result.usage.promptTokens, completionTokens: result.usage.completionTokens, totalTokens: result.usage.totalTokens },
      };
    } catch (error) {
      return {
        success: false,
        observation: `Error: ${(error as Error).message}`,
        toolUsed: toolName,
        actionInput,
        usage: { promptTokens: result.usage.promptTokens, completionTokens: result.usage.completionTokens, totalTokens: result.usage.totalTokens },
      };
    }
  }

  private async replan(input: string, currentPlan: PlanStep[], failureReason: string): Promise<string[]> {
    const completed = currentPlan.filter(s => s.status === 'completed').map(s => `✅ ${s.description}: ${s.result}`).join('\n');
    const failed = currentPlan.filter(s => s.status === 'failed').map(s => `❌ ${s.description}`).join('\n');

    const prompt = `A step in the plan failed. Replan the remaining steps.

Original task: ${input}
Completed: ${completed || 'None'}
Failed: ${failed}
Failure reason: ${failureReason}

Provide updated remaining steps as a numbered list:`;

    const result = await this.llm.generate(prompt, { temperature: 0.2, maxTokens: 512 });
    return result.content.split('\n').map(l => l.replace(/^\d+[.)]\s*/, '').trim()).filter(l => l.length > 0);
  }

  private async synthesize(input: string, plan: PlanStep[]): Promise<string> {
    const results = plan
      .filter(s => s.result)
      .map(s => `Step ${s.id} (${s.description}): ${s.result}`)
      .join('\n\n');

    const prompt = `Based on the following step results, provide a comprehensive answer to the original question.

Original question: ${input}

Step results:
${results}

Provide a clear, well-structured answer:`;

    const result = await this.llm.generate(prompt, {
      temperature: 0.3,
      maxTokens: 2048,
    });

    return result.content;
  }

  private parsePlan(content: string): PlanStep[] {
    const lines = content.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    const steps: PlanStep[] = [];

    for (const line of lines) {
      const match = line.match(/^\d+[.)]\s*(.*)/);
      if (match) {
        steps.push({
          id: steps.length + 1,
          description: match[1].trim(),
          status: 'pending',
        });
      }
    }

    return steps;
  }
}
