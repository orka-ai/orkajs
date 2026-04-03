import type { LLMStreamEvent } from '@orka-js/core';
import type { BaseAgent, AgentResult } from '@orka-js/agent';
import type { AgentTestResult } from './types.js';
import { MockLLMAdapter } from './mock-llm.js';

export interface AgentTestBedConfig {
  agent: BaseAgent;
  llm?: MockLLMAdapter;
}

export class AgentTestBed {
  private agent: BaseAgent;
  private llm: MockLLMAdapter;

  constructor(config: AgentTestBedConfig) {
    this.agent = config.agent;
    this.llm = config.llm ?? new MockLLMAdapter();
  }

  async run(input: string): Promise<AgentTestResult & AgentAssertions> {
    this.llm.reset();
    const events: LLMStreamEvent[] = [];
    const toolCalls: AgentTestResult['toolCalls'] = [];

    // Check if agent has runStream (StreamingToolAgent)
    const streamAgent = this.agent as BaseAgent & { runStream?: (input: string) => AsyncIterable<LLMStreamEvent> };

    let output = '';
    let usage = { promptTokens: 0, completionTokens: 0, totalTokens: 0 };
    let steps = 0;

    if (typeof streamAgent.runStream === 'function') {
      for await (const event of streamAgent.runStream(input)) {
        events.push(event);
        if (event.type === 'tool_call') {
          let args: Record<string, unknown> = {};
          try { args = JSON.parse(event.arguments); } catch { args = {}; }
          toolCalls.push({ name: event.name, args, callId: event.toolCallId });
          steps++;
        }
        if (event.type === 'done') {
          output = event.content;
          if (event.usage) usage = event.usage;
        }
      }
    } else {
      const result: AgentResult = await this.agent.run(input);
      output = result.output;
      steps = result.steps.length;
      usage = { promptTokens: 0, completionTokens: 0, totalTokens: result.totalTokens };
      for (const step of result.steps) {
        toolCalls.push({ name: step.action, args: step.actionInput, callId: '' });
      }
    }

    const result: AgentTestResult = { output, toolCalls, steps, usage, events };
    return Object.assign(result, makeAssertions(result));
  }

  getLLMMock(): MockLLMAdapter {
    return this.llm;
  }

  reset(): void {
    this.llm.reset();
  }
}

function makeAssertions(result: AgentTestResult): AgentAssertions {
  return {
    toHaveCalledTool(name: string) {
      const called = result.toolCalls.some(tc => tc.name === name);
      if (!called) {
        const calledTools = result.toolCalls.map(tc => tc.name).join(', ') || 'none';
        throw new Error(
          'Expected agent to have called tool ' + JSON.stringify(name) + ', but it called: ' + calledTools
        );
      }
      return result as AgentTestResult & AgentAssertions;
    },
    toHaveOutput(pattern: string | RegExp) {
      const matches = typeof pattern === 'string'
        ? result.output.includes(pattern)
        : pattern.test(result.output);
      if (!matches) {
        throw new Error(
          'Expected output to match ' + String(pattern) + ', got: ' + JSON.stringify(result.output.slice(0, 200))
        );
      }
      return result as AgentTestResult & AgentAssertions;
    },
    not: {
      toHaveCalledTool(name: string) {
        const called = result.toolCalls.some(tc => tc.name === name);
        if (called) throw new Error('Expected agent NOT to have called tool ' + JSON.stringify(name) + ', but it did');
        return result as AgentTestResult & AgentAssertions;
      },
    },
  };
}

export interface AgentAssertions {
  toHaveCalledTool(name: string): AgentTestResult & AgentAssertions;
  toHaveOutput(pattern: string | RegExp): AgentTestResult & AgentAssertions;
  not: {
    toHaveCalledTool(name: string): AgentTestResult & AgentAssertions;
  };
}