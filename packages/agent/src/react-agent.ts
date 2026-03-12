import type { LLMAdapter } from '@orka-js/core';
import type { Memory } from '@orka-js/memory-store';
import type {
  ReActAgentConfig,
  AgentResult,
  AgentStepResult,
} from './types.js';
import { BaseAgent } from './base-agent.js';

export class ReActAgent extends BaseAgent {
  private verbose: boolean;

  constructor(config: ReActAgentConfig, llm: LLMAdapter, memory?: Memory) {
    super(config, llm, memory, 'react');
    this.verbose = config.verbose ?? false;
  }

  async run(input: string): Promise<AgentResult> {
    const startTime = Date.now();
    const steps: AgentStepResult[] = [];
    const memoryContext = this.getMemoryContext();

    this.emit({ type: 'step:start', agentType: this.agentType, input });

    for (let step = 0; step < this.maxSteps; step++) {
      const stepStart = Date.now();
      const prompt = this.buildPrompt(input, steps, memoryContext);

      const result = await this.llm.generate(prompt, {
        temperature: this.temperature,
        maxTokens: 2048,
        systemPrompt: this.buildSystemPrompt(),
      });

      const parsed = this.parseReActResponse(result.content);

      if (this.verbose) {
        console.log(`[ReAct Step ${step + 1}]`);
        console.log(`  Thought: ${parsed.thought}`);
        console.log(`  Action: ${parsed.action}`);
        console.log(`  Action Input: ${JSON.stringify(parsed.actionInput)}`);
      }

      if (parsed.action === 'finish') {
        const finalAnswer = (parsed.actionInput.answer as string) ?? parsed.thought;
        this.saveToMemory(input, finalAnswer);
        this.emit({ type: 'complete', agentType: this.agentType, output: finalAnswer });

        const agentResult = this.buildResult(input, finalAnswer, steps, startTime, { stepsUsed: steps.length });
        agentResult.totalTokens += result.usage.totalTokens;
        return agentResult;
      }

      const observation = await this.executeTool(parsed.action, parsed.actionInput);

      if (this.verbose) {
        console.log(`  Observation: ${observation.slice(0, 200)}`);
      }

      steps.push({
        thought: parsed.thought,
        action: parsed.action,
        actionInput: parsed.actionInput,
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
    return this.buildResult(input, fallback, steps, startTime, { maxStepsReached: true });
  }

  private buildSystemPrompt(): string {
    const toolDescriptions = this.getToolDescriptions();
    const rules = this.getRulesString();

    return `You are a ReAct (Reasoning + Acting) agent. Your goal: ${this.goal}

You follow the ReAct pattern strictly:
1. THINK about what you need to do
2. ACT by using a tool
3. OBSERVE the result
4. REPEAT until you can provide a final answer

Available tools:
${toolDescriptions}

${rules ? `Rules:\n${rules}\n` : ''}
You MUST respond in this EXACT format (no deviations):

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

  private parseReActResponse(content: string): { thought: string; action: string; actionInput: Record<string, unknown> } {
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
}
