import type { LLMAdapter, VectorDBAdapter } from '@orka-js/core';
import type { Knowledge } from '@orka-js/core';
import type { Memory } from '@orka-js/memory-store';
import type { 
  AgentConfig, 
  AgentContext, 
  AgentResult, 
  AgentStepResult, 
  Tool 
} from './types.js';

export class Agent {
  private config: AgentConfig;
  private llm: LLMAdapter;
  private vectorDB?: VectorDBAdapter;
  private knowledge?: Knowledge;
  private memory?: Memory;
  private tools: Map<string, Tool>;

  constructor(
    config: AgentConfig,
    llm: LLMAdapter,
    vectorDB?: VectorDBAdapter,
    knowledge?: Knowledge,
    memory?: Memory,
  ) {
    this.config = config;
    this.llm = llm;
    this.vectorDB = vectorDB;
    this.knowledge = knowledge;
    this.memory = memory;
    this.tools = new Map(config.tools.map(t => [t.name, t]));
  }

  async run(input: string): Promise<AgentResult> {
    const startTime = Date.now();
    const maxSteps = this.config.policy?.maxSteps ?? this.config.maxSteps ?? 5;

    const ctx: AgentContext = {
      goal: this.config.goal,
      input,
      steps: [],
      llm: this.llm,
      vectorDB: this.vectorDB,
      knowledge: this.knowledge,
      memory: this.memory,
      metadata: {},
    };

    let memoryContext = '';
    if (this.memory) {
      const history = this.memory.getHistory();
      if (history.length > 0) {
        memoryContext = '\nConversation history:\n' + 
          history.map(m => `${m.role}: ${m.content}`).join('\n') + '\n';
      }
    }

    for (let step = 0; step < maxSteps; step++) {
      const stepStart = Date.now();
      const prompt = this.buildPrompt(ctx, memoryContext);

      const result = await this.llm.generate(prompt, {
        temperature: this.config.temperature ?? 0.3,
        maxTokens: 1024,
        systemPrompt: this.buildSystemPrompt(),
      });

      const parsed = this.parseResponse(result.content);

      if (parsed.action === 'final_answer') {
        const finalOutput = parsed.actionInput.answer as string ?? parsed.thought;

        if (this.memory) {
          this.memory.addMessage({ role: 'user', content: input });
          this.memory.addMessage({ role: 'assistant', content: finalOutput });
        }

        return {
          input,
          output: finalOutput,
          steps: ctx.steps,
          totalLatencyMs: Date.now() - startTime,
          totalTokens: ctx.steps.reduce((s, st) => s + (st.usage?.totalTokens ?? 0), 0) + result.usage.totalTokens,
          toolsUsed: [...new Set(ctx.steps.map(s => s.action))],
          metadata: ctx.metadata,
        };
      }

      const tool = this.tools.get(parsed.action);
      let observation: string;

      if (!tool) {
        observation = `Error: Tool "${parsed.action}" not found. Available tools: ${[...this.tools.keys()].join(', ')}`;
      } else if (this.isToolBlocked(parsed.action)) {
        observation = `Error: Tool "${parsed.action}" is blocked by policy.`;
      } else {
        try {
          const toolResult = await tool.execute(parsed.actionInput);
          observation = toolResult.error ?? toolResult.output;
        } catch (error) {
          observation = `Error executing tool "${parsed.action}": ${(error as Error).message}`;
        }
      }

      const stepResult: AgentStepResult = {
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
      };

      ctx.steps.push(stepResult);
    }

    const fallbackOutput = ctx.steps.length > 0
      ? `I was unable to fully complete the task within ${maxSteps} steps. Here is what I found:\n${ctx.steps.map(s => s.observation).filter(Boolean).join('\n')}`
      : 'I was unable to process this request.';

    if (this.memory) {
      this.memory.addMessage({ role: 'user', content: input });
      this.memory.addMessage({ role: 'assistant', content: fallbackOutput });
    }

    return {
      input,
      output: fallbackOutput,
      steps: ctx.steps,
      totalLatencyMs: Date.now() - startTime,
      totalTokens: ctx.steps.reduce((s, st) => s + (st.usage?.totalTokens ?? 0), 0),
      toolsUsed: [...new Set(ctx.steps.map(s => s.action))],
      metadata: { ...ctx.metadata, maxStepsReached: true },
    };
  }

  private buildSystemPrompt(): string {
    const toolDescriptions = [...this.tools.values()]
      .map(t => {
        const params = t.parameters?.map(p => `  - ${p.name} (${p.type}${p.required ? ', required' : ''}): ${p.description}`).join('\n') ?? '';
        return `- ${t.name}: ${t.description}${params ? '\n  Parameters:\n' + params : ''}`;
      })
      .join('\n');

    const rules = this.config.policy?.rules?.map(r => `- ${r}`).join('\n') ?? '';

    return `You are an AI agent. Your goal: ${this.config.goal}

Available tools:
${toolDescriptions}

${rules ? `Rules:\n${rules}\n` : ''}
You must respond in this exact format:
Thought: <your reasoning>
Action: <tool_name OR "final_answer">
Action Input: <JSON object with parameters>

When you have the final answer, use:
Thought: <your reasoning>
Action: final_answer
Action Input: {"answer": "<your final answer>"}

${this.config.systemPrompt ?? ''}`;
  }

  private buildPrompt(ctx: AgentContext, memoryContext: string): string {
    let prompt = `${memoryContext}\nUser request: ${ctx.input}\n`;

    if (ctx.steps.length > 0) {
      prompt += '\nPrevious steps:\n';
      for (const step of ctx.steps) {
        prompt += `Thought: ${step.thought}\n`;
        prompt += `Action: ${step.action}\n`;
        prompt += `Action Input: ${JSON.stringify(step.actionInput)}\n`;
        prompt += `Observation: ${step.observation}\n\n`;
      }
      prompt += 'Continue with the next step:\n';
    }

    return prompt;
  }

  private parseResponse(content: string): { thought: string; action: string; actionInput: Record<string, unknown> } {
    const thoughtMatch = content.match(/Thought:\s*(.*?)(?=\nAction:)/s);
    const actionMatch = content.match(/Action:\s*(.*?)(?=\nAction Input:)/s);
    const actionInputMatch = content.match(/Action Input:\s*(.*)/s);

    const thought = thoughtMatch?.[1]?.trim() ?? content;
    const action = actionMatch?.[1]?.trim() ?? 'final_answer';

    let actionInput: Record<string, unknown> = {};
    if (actionInputMatch?.[1]) {
      try {
        const jsonMatch = actionInputMatch[1].match(/\{[\s\S]*\}/);
        actionInput = JSON.parse(jsonMatch?.[0] ?? '{}');
      } catch {
        actionInput = { raw: actionInputMatch[1].trim() };
      }
    }

    if (action === 'final_answer' && !actionInput.answer) {
      actionInput.answer = thought;
    }

    return { thought, action, actionInput };
  }

  private isToolBlocked(toolName: string): boolean {
    const policy = this.config.policy;
    if (!policy) return false;

    if (policy.blockedTools?.includes(toolName)) return true;
    if (policy.allowedTools && !policy.allowedTools.includes(toolName)) return true;

    return false;
  }
}
