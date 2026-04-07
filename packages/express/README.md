# @orka-js/express

Express.js middleware for OrkaJS — serve agents as REST APIs with SSE streaming in minutes.

## Installation

```bash
npm install @orka-js/express @orka-js/core express
```

## Quick Start

```typescript
import express from 'express'
import { orkaMiddleware } from '@orka-js/express'
import { Orka } from '@orka-js/core'
import { OpenAIAdapter } from '@orka-js/openai'
import { ReActAgent } from '@orka-js/agent'

const app = express()
app.use(express.json())

const orka = new Orka({
  llm: new OpenAIAdapter({ apiKey: process.env.OPENAI_API_KEY! }),
})

const agent = new ReActAgent({ orka, tools: [] })

app.use(orkaMiddleware({
  orka,
  agents: [{ name: 'assistant', agent }],
  prefix: '/ai', // default
}))

app.listen(3000)
```

## Auto-generated Routes

| Route | Description |
|-------|-------------|
| `GET /ai` | List all registered agents |
| `GET /ai/:name` | Get agent info |
| `POST /ai/:name` | Run agent, returns JSON |
| `POST /ai/:name/stream` | Run agent with SSE streaming |

## Calling the API

```bash
# Standard request
curl -X POST http://localhost:3000/ai/assistant \
  -H "Content-Type: application/json" \
  -d '{"input": "What is the weather in Paris?"}'

# Streaming (Server-Sent Events)
curl -X POST http://localhost:3000/ai/assistant/stream \
  -H "Content-Type: application/json" \
  -d '{"input": "Tell me a story"}'
```

## Configuration

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `orka` | `Orka` | — | OrkaJS instance (required) |
| `agents` | `AgentConfig[]` | — | Agents to expose (required) |
| `prefix` | `string` | `'/ai'` | URL prefix for all routes |

## Types

```typescript
interface AgentRunRequest {
  input: string
  context?: Record<string, unknown>
}

interface AgentRunResponse {
  output: string
  tokens?: number
  duration?: number
}
```

## Related Packages

- [`@orka-js/core`](../core) — Core types
- [`@orka-js/agent`](../agent) — Agent implementations
- [`@orka-js/hono`](../hono) — Edge-compatible alternative
- [`@orka-js/nestjs`](../nestjs) — NestJS integration
- [`orkajs`](../orkajs) — Full bundle
