# @orka-js/hono

Hono middleware for OrkaJS agents — edge-compatible (Cloudflare Workers, Deno, Bun, Node.js).

## Installation

```bash
npm install @orka-js/hono @orka-js/core hono
```

## Quick Start

```typescript
import { Hono } from 'hono'
import { orkaHono } from '@orka-js/hono'
import { Orka } from '@orka-js/core'
import { OpenAIAdapter } from '@orka-js/openai'
import { ReActAgent } from '@orka-js/agent'

const orka = new Orka({
  llm: new OpenAIAdapter({ apiKey: process.env.OPENAI_API_KEY! }),
})

const agent = new ReActAgent({ orka, tools: [] })

const app = new Hono()
app.route('/ai', orkaHono({
  orka,
  agents: [{ name: 'assistant', agent }],
}))

export default app
```

## Cloudflare Workers

```typescript
// src/index.ts
import { Hono } from 'hono'
import { orkaHono } from '@orka-js/hono'

const app = new Hono<{ Bindings: Env }>()

app.route('/ai', orkaHono({
  orka: (c) => new Orka({ llm: new OpenAIAdapter({ apiKey: c.env.OPENAI_API_KEY }) }),
  agents: [{ name: 'assistant', agent: myAgent }],
}))

export default app
```

## Auto-generated Routes

| Route | Description |
|-------|-------------|
| `GET /ai` | List all registered agents |
| `GET /ai/:name` | Get agent info |
| `POST /ai/:name` | Run agent, returns JSON |
| `POST /ai/:name/stream` | Run agent with SSE streaming |

## Configuration

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `orka` | `Orka` | — | OrkaJS instance (required) |
| `agents` | `AgentConfig[]` | — | Agents to expose (required) |
| `prefix` | `string` | `'/ai'` | URL prefix for routes |

## Related Packages

- [`@orka-js/core`](../core) — Core types
- [`@orka-js/agent`](../agent) — Agent implementations
- [`@orka-js/express`](../express) — Express.js alternative
- [`@orka-js/nestjs`](../nestjs) — NestJS integration
- [`orkajs`](../orkajs) — Full bundle
