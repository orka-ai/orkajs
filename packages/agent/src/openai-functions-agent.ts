import type { LLMAdapter } from '@orka-js/core';
import type { Memory } from '@orka-js/memory-store';
import type {
  OpenAIFunctionsAgentConfig,
  OpenAIFunction,
  AgentResult,
  AgentStepResult,
} from './types.js';
import { BaseAgent } from './base-agent.js';

export class OpenAIFunctionsAgent extends BaseAgent {
  private functions: OpenAIFunction[];

  constructor(config: OpenAIFunctionsAgentConfig, llm: LLMAdapter, memory?: Memory) {
    super(config, llm, memory, 'openai-functions');
    this.temperature = config.temperature ?? 0.1;
    this.functions = config.functions ?? this.buildFunctionsFromTools();
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

      const parsed = this.parseFunctionCall(result.content);

      if (!parsed.functionCall) {
        const finalAnswer = parsed.content;
        this.saveToMemory(input, finalAnswer);
        this.emit({ type: 'complete', agentType: this.agentType, output: finalAnswer });

        const agentResult = this.buildResult(input, finalAnswer, steps, startTime, { stepsUsed: steps.length });
        agentResult.totalTokens += result.usage.totalTokens;
        return agentResult;
      }

      const { name, arguments: args } = parsed.functionCall;
      const observation = await this.executeTool(name, args);

      steps.push({
        thought: `Calling function: ${name}`,
        action: name,
        actionInput: args,
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
      ? `Reached max steps. Last result: ${steps[steps.length - 1].observation}`
      : 'Unable to process request.';

    this.saveToMemory(input, fallback);
    return this.buildResult(input, fallback, steps, startTime, { maxStepsReached: true });
  }

  private buildFunctionsFromTools(): OpenAIFunction[] {
    return [...this.tools.values()].map(tool => ({
      name: tool.name,
      description: tool.description,
      parameters: {
        type: 'object' as const,
        properties: Object.fromEntries(
          (tool.parameters ?? []).map(p => [
            p.name,
            {
              type: p.type,
              description: p.description,
            },
          ])
        ),
        required: (tool.parameters ?? []).filter(p => p.required).map(p => p.name),
      },
    }));
  }

  private buildSystemPrompt(): string {
    const functionsJson = JSON.stringify(this.functions, null, 2);
    const rules = this.getRulesString();

    return `You are an AI assistant with access to functions. Your goal: ${this.goal}

Available functions:
${functionsJson}

${rules ? `Rules:\n${rules}\n` : ''}
To call a function, respond with a JSON block:
\`\`\`function_call
{"name": "function_name", "arguments": {"param1": "value1"}}
\`\`\`

If you do NOT need to call a function, respond normally with your answer.
When you have enough information from function results, provide your final answer as plain text (no function_call block).

${this.systemPrompt ?? ''}`;
  }

  private buildPrompt(input: string, steps: AgentStepResult[], memoryContext: string): string {
    let prompt = `${memoryContext}\nUser: ${input}\n`;

    for (const step of steps) {
      prompt += `\nFunction call: ${step.action}(${JSON.stringify(step.actionInput)})\n`;
      prompt += `Result: ${step.observation}\n`;
    }

    if (steps.length > 0) {
      prompt += '\nBased on the function results above, continue or provide your final answer:\n';
    }

    return prompt;
  }

  private parseFunctionCall(content: string): { content: string; functionCall?: { name: string; arguments: Record<string, unknown> } } {
    const functionCallMatch = content.match(/```function_call\s*\n?([\s\S]*?)\n?\s*```/);

    if (functionCallMatch) {
      try {
        const parsed = JSON.parse(functionCallMatch[1].trim());
        return {
          content: content.replace(functionCallMatch[0], '').trim(),
          functionCall: {
            name: parsed.name,
            arguments: parsed.arguments ?? {},
          },
        };
      } catch {
        // Fall through to JSON detection
      }
    }

    // Also try to detect inline JSON function calls
    const jsonMatch = content.match(/\{"name":\s*"([^"]+)",\s*"arguments":\s*(\{[\s\S]*?\})\}/);
    if (jsonMatch) {
      try {
        const args = JSON.parse(jsonMatch[2]);
        return {
          content: content.replace(jsonMatch[0], '').trim(),
          functionCall: { name: jsonMatch[1], arguments: args },
        };
      } catch {
        // Fall through
      }
    }

    return { content };
  }
}
