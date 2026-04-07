# @orka-js/durable

Durable, resumable, and scheduled agents for OrkaJS — checkpoint persistence, retry, and cron scheduling.

## Installation

```bash
npm install @orka-js/durable @orka-js/core
```

## Quick Start

```typescript
import { DurableAgent, MemoryDurableStore } from '@orka-js/durable'
import { ReActAgent } from '@orka-js/agent'

const store = new MemoryDurableStore()
const agent = new ReActAgent({ orka, tools })
const durable = new DurableAgent(agent, store)

// Start a job — returns a jobId
const { jobId } = await durable.run('Analyze the quarterly report')
console.log('Job:', jobId)

// Check job status
const job = await durable.getJob(jobId)
console.log(job.status) // 'completed', 'running', 'paused', 'failed'
console.log(job.output)
```

## Pause and Resume

```typescript
// Pause a running job
await durable.pause(jobId)

// Resume it later (picks up from last checkpoint)
await durable.resume(jobId)
```

## Redis Store (Production)

```typescript
import { DurableAgent, RedisDurableStore } from '@orka-js/durable'

const store = new RedisDurableStore({
  url: process.env.REDIS_URL!,
})

const durable = new DurableAgent(agent, store, {
  retryOnFailure: true,
  maxRetries: 3,
})
```

## Cron Scheduling

```typescript
const durable = new DurableAgent(agent, store, {
  schedule: '0 9 * * *', // every day at 9am
})

// Start the scheduled job
await durable.startSchedule('Generate daily report')
```

## List All Jobs

```typescript
const jobs = await durable.listJobs()
jobs.forEach(job => {
  console.log(`${job.id}: ${job.status} — ${job.createdAt}`)
})
```

## Configuration

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `retryOnFailure` | `boolean` | `false` | Auto-retry failed jobs |
| `maxRetries` | `number` | `3` | Maximum retry attempts |
| `schedule` | `string` | — | Cron expression for scheduling |

## Job Status

| Status | Description |
|--------|-------------|
| `pending` | Queued, not started |
| `running` | Currently executing |
| `paused` | Manually paused |
| `completed` | Finished successfully |
| `failed` | Encountered an error |

## Related Packages

- [`@orka-js/agent`](../agent) — Agent implementations
- [`@orka-js/core`](../core) — Core types
- [`orkajs`](../orkajs) — Full bundle
