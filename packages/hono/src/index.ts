/**
 * @orka-js/hono
 *
 * Hono middleware for OrkaJS agents.
 * Edge-compatible — works on Cloudflare Workers, Deno, Bun, and Node.js.
 *
 * @example
 * ```typescript
 * import { Hono } from 'hono'
 * import { orkaHono } from '@orka-js/hono'
 * import { StreamingToolAgent } from '@orka-js/agent'
 * import { OpenAIAdapter } from '@orka-js/openai'
 *
 * const llm = new OpenAIAdapter({ apiKey: process.env.OPENAI_API_KEY! })
 * const agent = new StreamingToolAgent({ goal: 'Assistant', tools: [] }, llm)
 *
 * const app = new Hono()
 * app.route('/ai', orkaHono({ agents: { assistant: agent } }))
 *
 * // Routes:
 * // GET  /ai               → list agents
 * // GET  /ai/:name         → agent info
 * // POST /ai/:name         → run agent { input: string }
 * // POST /ai/:name/stream  → SSE stream { input: string }
 *
 * export default app
 * ```
 */

export { orkaHono } from './app.js';
export type { OrkaHonoConfig } from './types.js';
