# @orka-js/graph

Graph-based workflow engine for OrkaJS — conditional branching, parallel execution, and LangGraph-compatible state graphs.

## Installation

```bash
npm install @orka-js/graph @orka-js/core
```

## Quick Start

```typescript
import { GraphWorkflow, actionNode, conditionNode, edge, startNode, endNode } from '@orka-js/graph'
import { Orka } from '@orka-js/core'

const orka = new Orka({ llm })

const workflow = new GraphWorkflow({
  orka,
  nodes: [
    startNode(),
    actionNode('classify', async (ctx) => {
      const category = await classify(ctx.input)
      return { ...ctx, category }
    }),
    conditionNode('route', (ctx) => ctx.category === 'technical' ? 'tech' : 'general'),
    actionNode('tech', async (ctx) => ({ ...ctx, output: await techAgent.run(ctx.input) })),
    actionNode('general', async (ctx) => ({ ...ctx, output: await generalAgent.run(ctx.input) })),
    endNode(),
  ],
  edges: [
    edge('start', 'classify'),
    edge('classify', 'route'),
    edge('route', 'tech'),
    edge('route', 'general'),
    edge('tech', 'end'),
    edge('general', 'end'),
  ],
})

const result = await workflow.run('How do I set up a Redis cache?')
```

## Parallel Execution

```typescript
import { parallelNode } from '@orka-js/graph'

parallelNode('fetch-all', [
  actionNode('fetch-web', webSearchNode),
  actionNode('fetch-db', databaseNode),
  actionNode('fetch-cache', cacheNode),
])
```

## LangGraph-Compatible State Graph

```typescript
import { StateGraph, MemoryCheckpointStore } from '@orka-js/graph'

const graph = new StateGraph({
  channels: { messages: { value: (a, b) => a.concat(b) } },
  checkpointStore: new MemoryCheckpointStore(),
})

graph.addNode('agent', agentNode)
graph.addNode('tools', toolNode)
graph.addEdge('agent', 'tools')
graph.setEntryPoint('agent')

const result = await graph.invoke({ messages: [userMessage] })
```

## Checkpoint Stores

| Store | Description |
|-------|-------------|
| `MemoryCheckpointStore` | In-memory (dev/testing) |
| `PostgresCheckpointStore` | PostgreSQL-backed persistence |
| `RedisCheckpointStore` | Redis-backed persistence |

## Node Helpers

| Helper | Description |
|--------|-------------|
| `startNode()` | Entry point |
| `endNode()` | Exit point |
| `actionNode(name, fn)` | Execute an async function |
| `conditionNode(name, fn)` | Branch based on condition |
| `parallelNode(name, nodes)` | Run nodes in parallel |
| `llmNode(name, config)` | LLM call node |
| `retrieveNode(name, config)` | Vector retrieval node |

## Related Packages

- [`@orka-js/workflow`](../workflow) — Sequential multi-step workflows
- [`@orka-js/agent`](../agent) — Agent implementations
- [`@orka-js/core`](../core) — Core types
- [`orkajs`](../orkajs) — Full bundle
