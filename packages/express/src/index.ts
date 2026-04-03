/**
 * @orka-js/express
 *
 * Express.js middleware for OrkaJS agents.
 * Expose any OrkaJS agent as HTTP endpoints with SSE streaming support.
 *
 * @example
 * ```typescript
 * import express from 'express'
 * import { orkaMiddleware } from '@orka-js/express'
 * import { StreamingToolAgent } from '@orka-js/agent'
 * import { OpenAIAdapter } from '@orka-js/openai'
 *
 * const llm = new OpenAIAdapter({ apiKey: process.env.OPENAI_API_KEY! })
 * const agent = new StreamingToolAgent({ goal: 'Assistant', tools: [] }, llm)
 *
 * const app = express()
 * app.use(express.json())
 * app.use('/ai', orkaMiddleware({ agents: { assistant: agent } }))
 *
 * // Routes:
 * // GET  /ai               → list agents
 * // GET  /ai/:name         → agent info
 * // POST /ai/:name         → run agent { input: string }
 * // POST /ai/:name/stream  → SSE stream { input: string }
 *
 * app.listen(3000)
 * ```
 */

export { orkaMiddleware } from './middleware.js';
export type { OrkaExpressConfig, AgentRunRequest, AgentRunResponse } from './types.js';
