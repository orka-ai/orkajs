# @orka-js/nestjs

## 2.0.0

### Major Changes

- 106e4ee: feat(nestjs): add `@orka-js/nestjs` — native NestJS integration for OrkaJS agents

  Introduces a complete NestJS module with 6 features:

  - **`OrkaModule`** — `forRoot()`, `forRootAsync()`, `forMicroservice()` with built-in HTTP controller (GET/POST routes + SSE streaming)
  - **`@OrkaAgent`** / **`@InjectAgent`** / **`@InjectAgentClient`** — class & parameter decorators for DI registration and injection
  - **`@AgentReact`** — method decorator for event-driven agents (works with `@OnEvent()` from `@nestjs/event-emitter`)
  - **`OrkaSemanticGuard`** — LLM-powered semantic HTTP guard (fail-closed)
  - **`AgentValidationPipe`** — NLP → DTO transformation pipe using `LLMAdapter.generateObject()`
  - **CQRS integration** (`@orka-js/nestjs/cqrs`) — `OrkaQueryHandler`, `OrkaCommandHandler`, `@AgentQueryHandler`, `@AgentCommandHandler`
  - **Microservice transport** (`@orka-js/nestjs/microservice`) — `OrkaMessageHandler`, `AgentClient`, `OrkaClientModule`

  Optional peer deps (`@nestjs/cqrs`, `@nestjs/microservices`) are isolated behind sub-path exports to avoid hard runtime dependencies.
