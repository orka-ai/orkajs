# @orka-js/react

React components for visualizing OrkaJS agent execution graphs in real time.

## Installation

```bash
npm install @orka-js/react @orka-js/core react react-dom
```

## Quick Start

```tsx
import { OrkaGraph } from '@orka-js/react'

function App() {
  const [execution, setExecution] = useState(null)

  const runAgent = async () => {
    const result = await agent.run('Plan a trip to Paris')
    setExecution(result.execution)
  }

  return (
    <div>
      <button onClick={runAgent}>Run Agent</button>
      {execution && <OrkaGraph execution={execution} />}
    </div>
  )
}
```

## With `useGraph` Hook

```tsx
import { OrkaGraph, useGraph } from '@orka-js/react'

function AgentView() {
  const { execution, run, isRunning, reset } = useGraph({
    agent: myGraphAgent,
  })

  return (
    <div>
      <button onClick={() => run('Summarize this document')} disabled={isRunning}>
        {isRunning ? 'Running...' : 'Run'}
      </button>
      <button onClick={reset}>Reset</button>
      <OrkaGraph execution={execution} width={800} height={600} />
    </div>
  )
}
```

## Configuration

### `<OrkaGraph>` Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `execution` | `OrkaGraphExecution` | — | Execution data from agent run (required) |
| `width` | `number` | `600` | Canvas width in pixels |
| `height` | `number` | `400` | Canvas height in pixels |
| `theme` | `'light' \| 'dark'` | `'light'` | Color theme |
| `onNodeClick` | `(node) => void` | — | Callback when a node is clicked |

### `useGraph` Options

| Option | Type | Description |
|--------|------|-------------|
| `agent` | `GraphWorkflow` | The graph agent to run |
| `onStep` | `(step) => void` | Called on each step completion |
| `onError` | `(err) => void` | Called on error |

## Peer Dependencies

- `react >= 18`
- `react-dom >= 18`

## Related Packages

- [`@orka-js/graph`](../graph) — Graph workflow engine
- [`@orka-js/agent`](../agent) — Agent implementations
- [`@orka-js/core`](../core) — Core types
- [`orkajs`](../orkajs) — Full bundle
