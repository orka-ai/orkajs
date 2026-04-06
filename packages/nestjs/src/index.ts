/**
 * @orka-js/nestjs
 *
 * NestJS integration for OrkaJS agents.
 *
 * Provides:
 * - `OrkaModule` — DynamicModule with forRoot / forRootAsync / forMicroservice
 * - `@OrkaAgent` — class decorator to mark agent classes with metadata
 * - `@InjectAgent(name)` — parameter decorator for DI injection
 * - `@InjectAgentClient(name)` — parameter decorator for microservice client injection
 * - `@AgentReact` — method decorator for event-driven agent reactions
 * - `OrkaSemanticGuard` — LLM-powered semantic HTTP guard
 * - `AgentValidationPipe` — NLP → DTO transformation pipe
 * - `createOrkaController` — factory for custom controller variants
 *
 * CQRS features (requires @nestjs/cqrs):
 *   import { OrkaQueryHandler, OrkaCommandHandler, AgentQueryHandler, AgentCommandHandler }
 *     from '@orka-js/nestjs/cqrs'
 *
 * Microservice features (requires @nestjs/microservices):
 *   import { OrkaMessageHandler, AgentClient, OrkaClientModule }
 *     from '@orka-js/nestjs/microservice'
 *
 * @example
 * ```typescript
 * import { Module } from '@nestjs/common'
 * import { OrkaModule } from '@orka-js/nestjs'
 * import { Agent } from '@orka-js/agent'
 * import { AnthropicAdapter } from '@orka-js/anthropic'
 *
 * const llm = new AnthropicAdapter({ apiKey: process.env.ANTHROPIC_API_KEY! })
 * const agent = new Agent({ goal: 'Assistant', tools: [] }, llm)
 *
 * @Module({
 *   imports: [
 *     OrkaModule.forRoot({
 *       agents: { assistant: agent },
 *       path: 'ai',
 *     })
 *   ]
 * })
 * export class AppModule {}
 * ```
 */

// Core module
export { OrkaModule } from './module.js';

// Decorators
export { OrkaAgent, InjectAgent, InjectAgentClient, AgentReact } from './decorators.js';

// Guard
export { OrkaSemanticGuard } from './guards.js';

// Pipe
export { AgentValidationPipe } from './pipes.js';

// Controller factories (advanced usage)
export { createOrkaController, createAsyncOrkaController } from './controller.js';

// DI Tokens (for custom providers)
export {
  ORKA_AGENT_TOKEN,
  ORKA_AGENT_CLIENT_TOKEN,
  ORKA_AGENTS_MAP,
  ORKA_MODULE_CONFIG,
  ORKA_AGENT_METADATA,
  ORKA_REACT_METADATA,
} from './tokens.js';

// Types
export type {
  OrkaModuleConfig,
  OrkaModuleAsyncConfig,
  OrkaAgentMetadata,
  AgentReactOptions,
  AgentRegistration,
  AgentRunRequest,
  AgentRunResponse,
  MicroserviceAgentRunPayload,
  OrkaClientModuleConfig,
  OrkaClientRegistration,
} from './types.js';
