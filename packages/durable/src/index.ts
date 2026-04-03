/**
 * @orka-js/durable
 *
 * Durable, resumable, and scheduled agents for OrkaJS.
 * Wraps any BaseAgent to add checkpoint persistence, pause/resume,
 * retry logic, and cron-based scheduling.
 *
 * @example
 * ```typescript
 * import { DurableAgent, MemoryDurableStore } from '@orka-js/durable'
 * import { StreamingToolAgent } from '@orka-js/agent'
 * import { OpenAIAdapter } from '@orka-js/openai'
 *
 * const llm = new OpenAIAdapter({ apiKey: process.env.OPENAI_API_KEY! })
 * const agent = new StreamingToolAgent({ goal: 'Research assistant', tools: [] }, llm)
 * const store = new MemoryDurableStore()
 * const durable = new DurableAgent(agent, store, { maxRetries: 2 })
 *
 * // Run a job (resumes automatically if interrupted)
 * const job = await durable.run('job-001', 'Research quantum computing')
 * console.log(job.status, job.result)
 *
 * // Pause and resume later
 * await durable.pause('job-001')
 * const resumed = await durable.resume('job-001')
 * ```
 */

export { DurableAgent } from './durable-agent.js';
export { MemoryDurableStore } from './stores/memory-store.js';
export { RedisDurableStore } from './stores/redis-store.js';
export type {
  DurableJob,
  DurableJobStatus,
  DurableStore,
  DurableAgentConfig,
  DurableStreamEvent,
} from './types.js';
