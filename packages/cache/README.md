# @orka-js/cache

Caching layer for OrkaJS — reduce LLM costs and latency with in-memory or Redis-backed caching.

## Installation

```bash
npm install @orka-js/cache
```

## Quick Start

```typescript
import { CachedLLM, MemoryCache } from '@orka-js/cache'
import { OpenAIAdapter } from '@orka-js/openai'
import { Orka } from '@orka-js/core'

const llm = new OpenAIAdapter({ apiKey: process.env.OPENAI_API_KEY! })
const cache = new MemoryCache({ ttl: 3600 }) // 1 hour TTL
const cachedLLM = new CachedLLM(llm, cache)

const orka = new Orka({ llm: cachedLLM })

// First call hits the LLM
const r1 = await orka.chat([{ role: 'user', content: 'What is 2+2?' }])
// Second identical call returns cached result instantly
const r2 = await orka.chat([{ role: 'user', content: 'What is 2+2?' }])
```

## Redis Cache

```typescript
import { CachedLLM, RedisCache } from '@orka-js/cache'

const cache = new RedisCache({
  url: process.env.REDIS_URL!,
  ttl: 7200, // 2 hours
})
const cachedLLM = new CachedLLM(llm, cache)
```

## Embedding Cache

```typescript
import { CachedEmbeddings, MemoryCache } from '@orka-js/cache'

const cache = new MemoryCache({ ttl: 86400 }) // 24 hours
const cachedEmbed = new CachedEmbeddings(llm, cache)

// Repeated embed calls for the same text use the cache
const vector = await cachedEmbed.embed('Hello world')
```

## Cache Stats

```typescript
const stats = await cache.stats()
console.log(stats)
// { hits: 42, misses: 8, size: 50, hitRate: 0.84 }
```

## Configuration

### `MemoryCache`

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `ttl` | `number` | `3600` | Time-to-live in seconds |
| `maxSize` | `number` | `1000` | Maximum number of cached entries |

### `RedisCache`

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `url` | `string` | — | Redis connection URL (required) |
| `ttl` | `number` | `3600` | Time-to-live in seconds |

## API

### `MemoryCache` / `RedisCache`

Both implement `CacheStore`:

```typescript
cache.get(key)         // Promise<string | null>
cache.set(key, value)  // Promise<void>
cache.delete(key)      // Promise<void>
cache.clear()          // Promise<void>
cache.stats()          // Promise<CacheStats>
```

### `CachedLLM`

Wraps any `LLMAdapter`, transparently caches `chat()` responses.

### `CachedEmbeddings`

Wraps any `LLMAdapter`, transparently caches `embed()` responses.

## Related Packages

- [`@orka-js/core`](../core) — Core types
- [`@orka-js/resilience`](../resilience) — Retry and fallback patterns
- [`orkajs`](../orkajs) — Full bundle
