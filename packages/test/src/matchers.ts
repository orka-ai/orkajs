import type { AgentTestResult } from './types.js';
import type { MockLLMAdapter } from './mock-llm.js';

/**
 * Extend Vitest/Jest expect with OrkaJS agent matchers.
 * 
 * @example
 * ```typescript
 * import { expect } from 'vitest'
 * import { extendExpect } from '@orka-js/test'
 * extendExpect(expect)
 * 
 * const result = await bed.run('hello')
 * expect(result).toHaveCalledTool('search')
 * expect(result).toHaveOutput(/hello/)
 * ```
 */
export function extendExpect(expect: {
  extend(matchers: Record<string, unknown>): void;
}): void {
  expect.extend({
    toHaveCalledTool(received: AgentTestResult, toolName: string) {
      const called = received.toolCalls?.some(tc => tc.name === toolName);
      return {
        pass: called,
        message: () => called
          ? 'Expected agent NOT to have called tool ' + JSON.stringify(toolName)
          : 'Expected agent to have called tool ' + JSON.stringify(toolName) + '. Called tools: [' + (received.toolCalls?.map(t => t.name).join(', ') || 'none') + ']',
      };
    },

    toHaveOutput(received: AgentTestResult, pattern: string | RegExp) {
      const matches = typeof pattern === 'string'
        ? received.output?.includes(pattern)
        : pattern.test(received.output ?? '');
      return {
        pass: matches,
        message: () => matches
          ? 'Expected output NOT to match ' + String(pattern)
          : 'Expected output to match ' + String(pattern) + '. Got: ' + JSON.stringify(received.output?.slice(0, 200)),
      };
    },

    toHaveBeenCalledWithPrompt(received: MockLLMAdapter, pattern: string | RegExp) {
      const called = received.wasCalledWith(pattern);
      return {
        pass: called,
        message: () => called
          ? 'Expected MockLLM NOT to have been called with ' + String(pattern)
          : 'Expected MockLLM to have been called with ' + String(pattern),
      };
    },

    toHaveCallCount(received: MockLLMAdapter, count: number) {
      const actual = received.getCallCount();
      return {
        pass: actual === count,
        message: () => 'Expected MockLLM call count to be ' + count + ', got ' + actual,
      };
    },
  });
}