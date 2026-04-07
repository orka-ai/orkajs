# @orka-js/server

Zero-config HTTP server for OrkaJS agents — get a REST API running in one function call.

## Installation

```bash
npm install @orka-js/server @orka-js/core
```

## Quick Start

```typescript
import { createOrkaServer } from '@orka-js/server'
import { Orka } from '@orka-js/core'
import { OpenAIAdapter } from '@orka-js/openai'
import { ReActAgent } from '@orka-js/agent'

const orka = new Orka({
  llm: new OpenAIAdapter({ apiKey: process.env.OPENAI_API_KEY! }),
})

const server = await createOrkaServer({
  orka,
  agents: [
    { name: 'assistant', agent: new ReActAgent({ orka, tools: [] }) },
  ],
  port: 3000,
})

console.log(`Server running on port ${server.port}`)
// Routes: GET /ai, GET /ai/:name, POST /ai/:name, POST /ai/:name/stream
```

## Start / Stop

```typescript
const server = createOrkaServer(config) // does not auto-start

await server.start()  // start listening
await server.stop()   // graceful shutdown
```

## Configuration

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `orka` | `Orka` | — | OrkaJS instance (required) |
| `agents` | `AgentConfig[]` | — | Agents to expose (required) |
| `port` | `number` | `3000` | HTTP port |
| `host` | `string` | `'0.0.0.0'` | Bind address |

## API

### `createOrkaServer(config): OrkaServerInstance`

```typescript
interface OrkaServerInstance {
  port: number
  start(): Promise<void>
  stop(): Promise<void>
}
```

## Related Packages

- [`@orka-js/express`](../express) — Express middleware (more control)
- [`@orka-js/hono`](../hono) — Edge-compatible alternative
- [`@orka-js/nestjs`](../nestjs) — NestJS integration
- [`@orka-js/core`](../core) — Core types
- [`orkajs`](../orkajs) — Full bundle
