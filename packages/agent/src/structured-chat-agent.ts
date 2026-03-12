import type { LLMAdapter } from '@orkajs/core';
import type { Memory } from '@orkajs/memory-store';
import type {
  StructuredChatAgentConfig,
  AgentResult,
  AgentStepResult,
} from './types.js';
import { BaseAgent } from './base-agent.js';

export class StructuredChatAgent extends BaseAgent {
  private outputSchema?: Record<string, unknown>;

  constructor(config: StructuredChatAgentConfig, llm: LLMAdapter, memory?: Memory) {
    super(config, llm, memory, 'structured-chat');
    this.outputSchema = config.outputSchema;
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

      const parsed = this.parseStructuredResponse(result.content);

      if (parsed.type === 'final') {
        const finalAnswer = parsed.content;
        this.saveToMemory(input, finalAnswer);
        this.emit({ type: 'complete', agentType: this.agentType, output: finalAnswer });

        const agentResult = this.buildResult(input, finalAnswer, steps, startTime, { stepsUsed: steps.length });
        agentResult.totalTokens += result.usage.totalTokens;
        return agentResult;
      }

      const observation = await this.executeTool(parsed.action, parsed.actionInput);

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
      ? `Reached max steps. Last observation: ${steps[steps.length - 1].observation}`
      : 'Unable to process request.';

    this.saveToMemory(input, fallback);
    return this.buildResult(input, fallback, steps, startTime, { maxStepsReached: true });
  }

  private buildSystemPrompt(): string {
    const toolSchemas = [...this.tools.values()].map(t => {
      const schema: Record<string, unknown> = {
        name: t.name,
        description: t.description,
      };
      if (t.parameters && t.parameters.length > 0) {
        schema.parameters = {
          type: 'object',
          properties: Object.fromEntries(
            t.parameters.map(p => [p.name, { type: p.type, description: p.description }])
          ),
          required: t.parameters.filter(p => p.required).map(p => p.name),
        };
      }
      return schema;
    });

    const outputSchemaStr = this.outputSchema
      ? `\nYour final answer MUST conform to this JSON schema:\n${JSON.stringify(this.outputSchema, null, 2)}\n`
      : '';

    const rules = this.getRulesString();

    return `You are a structured chat agent. Your goal: ${this.goal}

You have access to the following tools (as JSON schemas):
\`\`\`json
${JSON.stringify(toolSchemas, null, 2)}
\`\`\`

${rules ? `Rules:\n${rules}\n` : ''}${outputSchemaStr}
Respond with a JSON blob in one of two formats:

To use a tool:
\`\`\`json
{
  "thought": "your reasoning",
  "action": "tool_name",
  "action_input": { "param": "value" }
}
\`\`\`

To give your final answer:
\`\`\`json
{
  "thought": "your final reasoning",
  "action": "final_answer",
  "action_input": "your comprehensive answer"
}
\`\`\`

ALWAYS respond with a JSON blob. Never respond with plain text.

${this.systemPrompt ?? ''}`;
  }

  private buildPrompt(input: string, steps: AgentStepResult[], memoryContext: string): string {
    let prompt = `${memoryContext}\nHuman: ${input}\n`;

    for (const step of steps) {
      prompt += `\nAssistant action: ${step.action}(${JSON.stringify(step.actionInput)})\n`;
      prompt += `Observation: ${step.observation}\n`;
    }

    if (steps.length > 0) {
      prompt += '\nContinue with the next action or provide your final answer:\n';
    }

    return prompt;
  }

  private parseStructuredResponse(content: string): { type: 'action' | 'final'; thought: string; action: string; actionInput: Record<string, unknown>; content: string } {
    // Try to extract JSON from code blocks
    const jsonBlockMatch = content.match(/```(?:json)?\s*\n?([\s\S]*?)\n?\s*```/);
    const jsonStr = jsonBlockMatch ? jsonBlockMatch[1].trim() : content.trim();

    try {
      const jsonMatch = jsonStr.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        const thought = parsed.thought ?? '';
        const action = parsed.action ?? 'final_answer';
        const actionInput = typeof parsed.action_input === 'string'
          ? { answer: parsed.action_input }
          : (parsed.action_input ?? {});

        if (action === 'final_answer') {
          return {
            type: 'final',
            thought,
            action,
            actionInput,
            content: actionInput.answer ?? thought,
          };
        }

        return { type: 'action', thought, action, actionInput, content: '' };
      }
    } catch {
      // Fall through to plain text
    }

    return {
      type: 'final',
      thought: content,
      action: 'final_answer',
      actionInput: { answer: content },
      content,
    };
  }
}
