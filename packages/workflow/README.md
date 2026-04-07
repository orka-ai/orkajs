# @orka-js/workflow

Multi-step workflow orchestration for OrkaJS — chain plan, retrieve, generate, verify, and improve steps.

## Installation

```bash
npm install @orka-js/workflow @orka-js/core
```

## Quick Start

```typescript
import { Workflow, plan, retrieve, generate, verify } from '@orka-js/workflow'
import { Orka } from '@orka-js/core'

const orka = new Orka({ llm, vectorDB })

const workflow = new Workflow({
  orka,
  steps: [
    plan({ prompt: 'Break down the question into sub-tasks' }),
    retrieve({ topK: 5 }),
    generate({ systemPrompt: 'Answer based on the retrieved documents' }),
    verify({ threshold: 0.8 }),
  ],
})

const result = await workflow.run('What are the key features of OrkaJS?')
console.log(result.output)
```

## Streaming

```typescript
for await (const event of workflow.stream('Summarize the quarterly report')) {
  if (event.type === 'token') process.stdout.write(event.delta)
  if (event.type === 'step') console.log(`Step done: ${event.step}`)
}
```

## Custom Step

```typescript
import { custom } from '@orka-js/workflow'

const myStep = custom(async (ctx) => {
  const transformed = await myTransform(ctx.output)
  return { ...ctx, output: transformed }
})

const workflow = new Workflow({
  orka,
  steps: [retrieve({ topK: 3 }), generate(), myStep],
})
```

## Built-in Steps

| Step | Description |
|------|-------------|
| `plan(opts)` | Decompose the input into sub-tasks |
| `retrieve(opts)` | Fetch relevant documents from vector DB |
| `generate(opts)` | Generate a response using the LLM |
| `verify(opts)` | Check output quality, retry if below threshold |
| `improve(opts)` | Refine and improve the previous output |
| `custom(fn)` | Custom step function |

## Workflow Context

Each step receives and returns a `WorkflowContext`:

```typescript
interface WorkflowContext {
  input: string
  output: string
  memory: Message[]
  documents: Document[]
  metadata: Record<string, unknown>
}
```

## API

### `Workflow`

```typescript
new Workflow(config: WorkflowConfig)

workflow.run(input: string)     // Promise<WorkflowResult>
workflow.stream(input: string)  // AsyncIterable<WorkflowEvent>
```

`WorkflowResult`: `{ output, steps, duration, tokens }`

## Related Packages

- [`@orka-js/graph`](../graph) — Graph-based workflows with branching
- [`@orka-js/agent`](../agent) — Agent implementations
- [`@orka-js/core`](../core) — Core types
- [`orkajs`](../orkajs) — Full bundle
