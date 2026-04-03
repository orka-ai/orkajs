/**
 * @orka-js/test
 *
 * Testing utilities for OrkaJS agents.
 * Provides mock LLM adapters, AgentTestBed, and Vitest/Jest matchers
 * for writing deterministic, reliable agent tests.
 *
 * @example
 * ```typescript
 * import { mockLLM, AgentTestBed } from '@orka-js/test'
 * import { StreamingToolAgent } from '@orka-js/agent'
 *
 * const llm = mockLLM([
 *   { when: /weather/, output: 'It is sunny in Paris' },
 *   { when: /book/, toolCall: { name: 'bookDemo', args: { slot: 'tomorrow' } } },
 * ])
 *
 * const agent = new StreamingToolAgent({ goal: 'Help users', tools: [] }, llm)
 * const bed = new AgentTestBed({ agent, llm })
 *
 * const result = await bed.run('What is the weather?')
 * result.toHaveOutput(/sunny/)
 * ```
 */

export { MockLLMAdapter, mockLLM } from './mock-llm.js';
export { AgentTestBed } from './test-bed.js';
export { extendExpect } from './matchers.js';
export type { MockResponse, MockCall, AgentTestResult, AgentSnapshot } from './types.js';
export type { AgentAssertions } from './test-bed.js';