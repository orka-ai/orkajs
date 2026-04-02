import type { LLMAdapter } from '@orka-js/core';
import type { StreamingLLMAdapter, LLMStreamEvent, ToolResultEvent } from '@orka-js/core';
import { createStreamEvent, isStreamingAdapter } from '@orka-js/core';
import type { Memory } from '@orka-js/memory-store';
import { BaseAgent, type BaseAgentConfig } from './base-agent.js';
import type { AgentResult, AgentStepResult, Tool } from './types.js';

export interface StreamingToolAgentConfig extends BaseAgentConfig {
  verbose?: boolean;
}

/**
 * An agent that streams LLM responses while processing tool calls in real time.
 *
 * Unlike ReActAgent (which waits for the full response), StreamingToolAgent
 * yields `token` events as they arrive, executes tool calls when detected
 * (in parallel), injects results back into the conversation, and continues
 * streaming until the model has a final answer.
 *
 * Memory is loaded at the start of each `runStream()` call and saved after
 * completion, so the agent maintains conversational context across requests.
 *
 * Requires an LLM adapter that implements `StreamingLLMAdapter`
 * (`supportsStreaming === true` + `stream()` method).
 *
 * @example
 * ```typescript
 * import { StreamingToolAgent } from '@orka-js/agent';
 * import { OpenAIAdapter } from '@orka-js/openai';
 *
 * const llm = new OpenAIAdapter({ apiKey: process.env.OPENAI_API_KEY! });
 *
 * const agent = new StreamingToolAgent({
 *   goal: 'Answer questions using available tools',
 *   tools: [weatherTool],
 * }, llm);
 *
 * for await (const event of agent.runStream('Weather in Paris?')) {
 *   if (event.type === 'token') process.stdout.write(event.token);
 *   if (event.type === 'tool_result') console.log('[Tool]', event.result);
 *   if (event.type === 'done') console.log('\nDone:', event.content);
 * }
 * ```
 *
 * @since 1.5.0
 */
export class StreamingToolAgent extends BaseAgent {
  private streamingLlm: (LLMAdapter & StreamingLLMAdapter) | null;
  private verbose: boolean;

  constructor(
    config: StreamingToolAgentConfig,
    llm: LLMAdapter,
    memory?: Memory,
  ) {
    super(config, llm, memory, 'streaming-tool');
    this.verbose = config.verbose ?? false;
    this.streamingLlm = isStreamingAdapter(llm) ? (llm as LLMAdapter & StreamingLLMAdapter) : null;
  }

  /**
   * Standard run — drains the stream and returns an AgentResult.
   */
  async run(input: string): Promise<AgentResult> {
    const startTime = Date.now();
    const steps: AgentStepResult[] = [];
    let finalContent = '';

    for await (const event of this.runStream(input)) {
      if (event.type === 'done') {
        finalContent = event.content;
      } else if (event.type === 'tool_result') {
        steps.push({
          thought: '',
          action: String(event.toolCallId),
          actionInput: {},
          observation: String(event.result),
          latencyMs: 0,
        });
      } else if (event.type === 'error') {
        throw event.error;
      }
    }

    this.saveToMemory(input, finalContent);
    return this.buildResult(input, finalContent, steps, startTime);
  }

  /**
   * Streaming run — yields events including tokens, tool results and done.
   * Loops until the LLM stops requesting tool calls or maxSteps is reached.
   */
  async *runStream(input: string): AsyncIterable<LLMStreamEvent> {
    if (!this.streamingLlm) {
      yield createStreamEvent<LLMStreamEvent & { type: 'error' }>('error', {
        error: new Error('StreamingToolAgent requires a StreamingLLMAdapter (adapter must have stream() and supportsStreaming = true)'),
        message: 'Adapter does not support streaming',
      } as never);
      return;
    }

    const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [];
    const systemPrompt = this.buildSystemPrompt();
    if (systemPrompt) messages.push({ role: 'system', content: systemPrompt });

    // Load conversation history from memory so the agent has context across requests
    if (this.memory) {
      for (const msg of this.memory.getHistory()) {
        if (msg.role === 'user' || msg.role === 'assistant') {
          messages.push({ role: msg.role, content: msg.content });
        }
      }
    }

    messages.push({ role: 'user', content: input });

    const tools = this.buildStreamTools();

    this.emit({ type: 'step:start', agentType: this.agentType, input });

    let lastFinalContent = '';

    for (let step = 0; step < this.maxSteps; step++) {
      const bufferedToolCalls: Array<{ id: string; name: string; arguments: string }> = [];
      let finalContent = '';
      let finishReason = 'stop';

      for await (const event of this.streamingLlm.stream('', { messages, tools, toolChoice: tools.length ? 'auto' : undefined })) {
        switch (event.type) {
          case 'token':
            finalContent += event.token;
            yield event;
            break;
          case 'content':
          case 'thinking':
          case 'usage':
            yield event;
            break;
          case 'tool_call':
            bufferedToolCalls.push({ id: event.toolCallId, name: event.name, arguments: event.arguments });
            yield event; // forward to caller so tool_start/tracking logic in consumers works
            if (this.verbose) {
              console.log(`[StreamingToolAgent] Tool call: ${event.name}(${event.arguments})`);
            }
            break;
          case 'done':
            finalContent = event.content || finalContent;
            finishReason = event.finishReason;
            lastFinalContent = finalContent;
            break;
          case 'error':
            yield event;
            return;
        }
      }

      if (bufferedToolCalls.length === 0) {
        // No tool calls — save to memory and emit final done
        this.saveToMemory(input, finalContent);
        yield createStreamEvent<LLMStreamEvent & { type: 'done' }>('done', {
          content: finalContent,
          finishReason: finishReason as 'stop' | 'length' | 'tool_calls' | 'error',
        } as never);
        this.emit({ type: 'complete', agentType: this.agentType, output: finalContent });
        return;
      }

      // Execute buffered tool calls in parallel
      const results = await Promise.all(
        bufferedToolCalls.map(async (tc) => {
          let args: Record<string, unknown> = {};
          try { args = JSON.parse(tc.arguments || '{}'); } catch { args = { raw: tc.arguments }; }
          const observation = await this.executeTool(tc.name, args);
          return { name: tc.name, callId: tc.id, observation };
        })
      );

      // Yield tool_result events
      for (const r of results) {
        yield createStreamEvent<ToolResultEvent>('tool_result', {
          toolCallId: r.callId,
          result: r.observation,
        });
      }

      // Append assistant turn + tool results to message history
      const toolSummary = bufferedToolCalls.map(tc =>
        `[Tool: ${tc.name} args: ${tc.arguments}]`
      ).join('\n');
      messages.push({ role: 'assistant', content: (finalContent ? finalContent + '\n' : '') + toolSummary });
      messages.push({
        role: 'user',
        content: 'Tool results:\n' + results.map(r => `${r.name}: ${r.observation}`).join('\n') + '\nContinue based on the results.',
      });
    }

    // Max steps reached — save what we have to memory
    this.saveToMemory(input, lastFinalContent);
    yield createStreamEvent<LLMStreamEvent & { type: 'done' }>('done', {
      content: lastFinalContent || `Reached max steps (${this.maxSteps})`,
      finishReason: 'stop',
    } as never);
  }

  private buildSystemPrompt(): string {
    const parts: string[] = [`You are an AI assistant. Your goal: ${this.goal}`];
    const rules = this.getRulesString();
    if (rules) parts.push(`Rules:\n${rules}`);
    if (this.systemPrompt) parts.push(this.systemPrompt);
    return parts.join('\n\n');
  }

  private buildStreamTools() {
    return [...this.tools.values()].map((tool: Tool) => ({
      name: tool.name,
      description: tool.description,
      parameters: tool.parameters ? {
        type: 'object' as const,
        properties: Object.fromEntries(
          tool.parameters.map(p => [p.name, { type: p.type, description: p.description }])
        ),
        required: tool.parameters.filter(p => p.required).map(p => p.name),
      } : { type: 'object' as const, properties: {} },
    }));
  }
}
