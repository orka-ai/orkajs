# @orka-js/a2a

Agent-to-Agent (A2A) communication protocol for OrkaJS — connect and orchestrate distributed agents over HTTP.

## Installation

```bash
npm install @orka-js/a2a @orka-js/core
```

## Server — Expose an Agent

```typescript
import { A2AServer } from '@orka-js/a2a'
import { ReActAgent } from '@orka-js/agent'

const agent = new ReActAgent({ orka, tools })

const server = new A2AServer({
  port: 4000,
  agents: [
    {
      name: 'research-agent',
      description: 'Searches the web and summarizes findings',
      skills: [{ name: 'search', description: 'Web search capability' }],
    },
  ],
})

server.registerAgent(agentCard, async (message) => {
  const result = await agent.run(message.content)
  return { content: result.output }
})

await server.start()
console.log('Agent server running on port 4000')
```

## Client — Connect to a Remote Agent

```typescript
import { A2AClient } from '@orka-js/a2a'

const client = new A2AClient({
  url: 'http://research-agent:4000',
  timeout: 30000,
})

// Discover available agents
const card = await client.getAgentCard()
console.log(card.name, card.skills)

// Send a message
const response = await client.send({
  content: 'Find recent news about AI regulations',
})
console.log(response.content)
```

## Multi-Agent Orchestration

```typescript
// Orchestrator connecting multiple specialized agents
const researcher = new A2AClient({ url: 'http://researcher:4001' })
const writer = new A2AClient({ url: 'http://writer:4002' })
const reviewer = new A2AClient({ url: 'http://reviewer:4003' })

const research = await researcher.send({ content: topic })
const draft = await writer.send({ content: `Write about: ${research.content}` })
const final = await reviewer.send({ content: `Review and improve: ${draft.content}` })
```

## Types

```typescript
interface AgentCard {
  name: string
  description: string
  skills: AgentSkill[]
  version?: string
}

interface A2AMessage {
  content: string
  taskId?: string
  metadata?: Record<string, unknown>
}

type A2ATaskState = 'pending' | 'running' | 'completed' | 'failed'
```

## Configuration

### `A2AServer`

| Option | Type | Description |
|--------|------|-------------|
| `port` | `number` | HTTP port (required) |
| `host` | `string` | Bind address (default: `'0.0.0.0'`) |
| `agents` | `AgentCard[]` | Agent cards to advertise |

### `A2AClient`

| Option | Type | Description |
|--------|------|-------------|
| `url` | `string` | Remote agent URL (required) |
| `timeout` | `number` | Request timeout in ms (default: `30000`) |

## Related Packages

- [`@orka-js/agent`](../agent) — Agent implementations
- [`@orka-js/durable`](../durable) — Durable/resumable agents
- [`@orka-js/core`](../core) — Core types
- [`orkajs`](../orkajs) — Full bundle
