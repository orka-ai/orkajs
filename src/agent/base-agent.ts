import type { LLMAdapter } from '../types/index.js';
import type { Memory } from '../memory/memory.js';
import type {
  AgentPolicy,
  AgentResult,
  AgentStepResult,
  Tool,
  ToolResult,
} from './types.js';

export interface BaseAgentConfig {
  name?: string;
  goal: string;
  tools: Tool[];
  policy?: AgentPolicy;
  systemPrompt?: string;
  maxSteps?: number;
  temperature?: number;
}

export type AgentEventType = 'step:start' | 'step:end' | 'tool:start' | 'tool:end' | 'tool:error' | 'complete' | 'error';

export interface AgentEvent {
  type: AgentEventType;
  agentType: string;
  step?: number;
  toolName?: string;
  input?: unknown;
  output?: unknown;
  error?: Error;
  latencyMs?: number;
}

export type AgentEventListener = (event: AgentEvent) => void;

export abstract class BaseAgent {
  protected llm: LLMAdapter;
  protected memory?: Memory;
  protected tools: Map<string, Tool>;
  protected policy?: AgentPolicy;
  protected goal: string;
  protected systemPrompt?: string;
  protected maxSteps: number;
  protected temperature: number;
  protected agentType: string;
  private listeners: Map<AgentEventType, AgentEventListener[]> = new Map();

  constructor(
    config: BaseAgentConfig,
    llm: LLMAdapter,
    memory?: Memory,
    agentType = 'base',
  ) {
    this.llm = llm;
    this.memory = memory;
    this.tools = new Map(config.tools.map(t => [t.name, t]));
    this.policy = config.policy;
    this.goal = config.goal;
    this.systemPrompt = config.systemPrompt;
    this.maxSteps = config.policy?.maxSteps ?? config.maxSteps ?? 10;
    this.temperature = config.temperature ?? 0.3;
    this.agentType = agentType;
  }

  abstract run(input: string): Promise<AgentResult>;

  on(event: AgentEventType, listener: AgentEventListener): this {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event)!.push(listener);
    return this;
  }

  off(event: AgentEventType, listener: AgentEventListener): this {
    const listeners = this.listeners.get(event);
    if (listeners) {
      const idx = listeners.indexOf(listener);
      if (idx !== -1) listeners.splice(idx, 1);
    }
    return this;
  }

  protected emit(event: AgentEvent): void {
    const listeners = this.listeners.get(event.type);
    if (listeners) {
      for (const listener of listeners) {
        try {
          listener(event);
        } catch {
          // Swallow listener errors to avoid breaking agent flow
        }
      }
    }
  }

  protected getMemoryContext(): string {
    if (!this.memory) return '';
    const history = this.memory.getHistory();
    if (history.length === 0) return '';
    return '\nConversation history:\n' +
      history.map(m => `${m.role}: ${m.content}`).join('\n') + '\n';
  }

  protected async executeTool(toolName: string, input: Record<string, unknown>): Promise<string> {
    const tool = this.tools.get(toolName);

    if (!tool) {
      return `Error: Tool "${toolName}" not found. Available: ${[...this.tools.keys()].join(', ')}`;
    }

    if (this.isToolBlocked(toolName)) {
      return `Error: Tool "${toolName}" is blocked by policy.`;
    }

    this.emit({ type: 'tool:start', agentType: this.agentType, toolName, input });
    const start = Date.now();

    try {
      const result: ToolResult = await tool.execute(input);
      const output = result.error ?? result.output;
      this.emit({ type: 'tool:end', agentType: this.agentType, toolName, output, latencyMs: Date.now() - start });
      return output;
    } catch (error) {
      this.emit({ type: 'tool:error', agentType: this.agentType, toolName, error: error as Error });
      return `Error executing tool "${toolName}": ${(error as Error).message}`;
    }
  }

  protected isToolBlocked(toolName: string): boolean {
    if (!this.policy) return false;
    if (this.policy.blockedTools?.includes(toolName)) return true;
    if (this.policy.allowedTools && !this.policy.allowedTools.includes(toolName)) return true;
    return false;
  }

  protected saveToMemory(input: string, output: string): void {
    if (this.memory) {
      this.memory.addMessage({ role: 'user', content: input });
      this.memory.addMessage({ role: 'assistant', content: output });
    }
  }

  protected buildResult(
    input: string,
    output: string,
    steps: AgentStepResult[],
    startTime: number,
    extraMetadata: Record<string, unknown> = {},
  ): AgentResult {
    return {
      input,
      output,
      steps,
      totalLatencyMs: Date.now() - startTime,
      totalTokens: steps.reduce((s, st) => s + (st.usage?.totalTokens ?? 0), 0),
      toolsUsed: [...new Set(steps.map(s => s.action))],
      metadata: { agentType: this.agentType, ...extraMetadata },
    };
  }

  protected getToolDescriptions(): string {
    return [...this.tools.values()]
      .map(t => {
        const params = t.parameters?.map(p =>
          `    ${p.name} (${p.type}${p.required ? ', required' : ''}): ${p.description}`
        ).join('\n') ?? '';
        return `  ${t.name}: ${t.description}${params ? '\n' + params : ''}`;
      })
      .join('\n');
  }

  protected getRulesString(): string {
    return this.policy?.rules?.map(r => `- ${r}`).join('\n') ?? '';
  }

  protected parseJsonFromText(text: string): Record<string, unknown> {
    try {
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      return JSON.parse(jsonMatch?.[0] ?? '{}');
    } catch {
      return { raw: text.trim() };
    }
  }
}
