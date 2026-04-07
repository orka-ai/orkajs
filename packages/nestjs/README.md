# @orka-js/nestjs

Native NestJS integration for OrkaJS — DI, decorators, guards, CQRS, and microservices support.

## Installation

```bash
npm install @orka-js/nestjs @orka-js/core
```

## Quick Start

```typescript
// app.module.ts
import { OrkaModule } from '@orka-js/nestjs'
import { OpenAIAdapter } from '@orka-js/openai'

@Module({
  imports: [
    OrkaModule.forRoot({
      llm: new OpenAIAdapter({ apiKey: process.env.OPENAI_API_KEY! }),
    }),
  ],
})
export class AppModule {}
```

## Registering Agents

```typescript
import { Injectable } from '@nestjs/common'
import { OrkaAgent, InjectAgent } from '@orka-js/nestjs'
import { ReActAgent } from '@orka-js/agent'

@OrkaAgent('support', {
  systemPrompt: 'You are a helpful support agent.',
  tools: [myTool],
})
@Injectable()
export class SupportAgentService {
  constructor(@InjectAgent('support') private readonly agent: ReActAgent) {}

  async answer(question: string) {
    return this.agent.run(question)
  }
}
```

## Auto-generated REST Controller

```typescript
import { createOrkaController } from '@orka-js/nestjs'

// Generates GET /agents/support, POST /agents/support, POST /agents/support/stream
@Controller('agents')
export class AgentController extends createOrkaController('support') {}
```

## Semantic Guard

```typescript
import { OrkaSemanticGuard } from '@orka-js/nestjs'
import { UseGuards } from '@nestjs/common'

@UseGuards(OrkaSemanticGuard({ policy: 'Only allow questions about our products' }))
@Post('ask')
async ask(@Body() dto: AskDto) { /* ... */ }
```

## Async Configuration

```typescript
OrkaModule.forRootAsync({
  imports: [ConfigModule],
  useFactory: (config: ConfigService) => ({
    llm: new OpenAIAdapter({ apiKey: config.get('OPENAI_API_KEY') }),
  }),
  inject: [ConfigService],
})
```

## CQRS Support

```typescript
import { OrkaQueryHandler, AgentQueryHandler } from '@orka-js/nestjs'

@AgentQueryHandler(SearchQuery, 'search-agent')
export class SearchQueryHandler extends OrkaQueryHandler<SearchQuery> {
  async execute(query: SearchQuery) {
    return this.agent.run(query.term)
  }
}
```

## Key Exports

| Export | Description |
|--------|-------------|
| `OrkaModule` | NestJS dynamic module |
| `@OrkaAgent(name, config)` | Register an agent |
| `@InjectAgent(name)` | Inject an agent |
| `@InjectAgentClient(name)` | Inject a remote agent client |
| `OrkaSemanticGuard` | LLM-powered HTTP guard |
| `AgentValidationPipe` | NLP → DTO transformation |
| `createOrkaController(name)` | Auto-generate REST controller |
| `OrkaQueryHandler` / `OrkaCommandHandler` | CQRS handlers |
| `AgentClient`, `OrkaClientModule` | Microservice client |

## Related Packages

- [`@orka-js/core`](../core) — Core types
- [`@orka-js/agent`](../agent) — Agent implementations
- [`@orka-js/express`](../express) — Express middleware
- [`orkajs`](../orkajs) — Full bundle
