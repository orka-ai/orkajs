/**
 * @orka-js/nestjs/cqrs
 *
 * CQRS integration for OrkaJS agents using @nestjs/cqrs.
 *
 * Requires @nestjs/cqrs as a peer dependency:
 *   npm install @nestjs/cqrs
 *
 * This file imports from @nestjs/cqrs at the top level. If @nestjs/cqrs is
 * not installed, importing this sub-path will throw a module resolution error.
 *
 * Safe usage — only import if @nestjs/cqrs is installed:
 *   import { OrkaQueryHandler, AgentQueryHandler } from '@orka-js/nestjs/cqrs'
 */

import { Injectable, applyDecorators } from '@nestjs/common';
import { QueryHandler, CommandHandler } from '@nestjs/cqrs';
import type { IQuery, ICommand } from '@nestjs/cqrs';
import type { Type } from '@nestjs/common';
import type { BaseAgent } from '@orka-js/agent';
import type { AgentResult } from '@orka-js/agent';

// ─── OrkaQueryHandler ─────────────────────────────────────────────────────────

/**
 * Abstract base class that bridges CQRS queries to OrkaJS agents.
 *
 * Extend this class and inject your agent via @InjectAgent(name).
 * The `execute()` method serializes the query to JSON and runs it through the agent.
 *
 * @example
 * ```typescript
 * import { OrkaQueryHandler, AgentQueryHandler } from '@orka-js/nestjs/cqrs'
 * import { InjectAgent } from '@orka-js/nestjs'
 *
 * class GetProductRecommendationsQuery {
 *   constructor(public readonly userId: string) {}
 * }
 *
 * @AgentQueryHandler(GetProductRecommendationsQuery)
 * class RecoQueryHandler extends OrkaQueryHandler<GetProductRecommendationsQuery> {
 *   constructor(@InjectAgent('reco') protected agent: BaseAgent) {
 *     super();
 *   }
 * }
 * ```
 */
export abstract class OrkaQueryHandler<Q extends IQuery = IQuery> {
  protected abstract agent: BaseAgent;

  async execute(query: Q): Promise<AgentResult> {
    return this.agent.run(JSON.stringify(query));
  }
}

// ─── OrkaCommandHandler ───────────────────────────────────────────────────────

/**
 * Abstract base class that bridges CQRS commands to OrkaJS agents.
 *
 * Extend this class and inject your agent via @InjectAgent(name).
 * The `execute()` method serializes the command to JSON and runs it through the agent.
 *
 * @example
 * ```typescript
 * import { OrkaCommandHandler, AgentCommandHandler } from '@orka-js/nestjs/cqrs'
 * import { InjectAgent } from '@orka-js/nestjs'
 *
 * class ProcessOrderCommand {
 *   constructor(public readonly orderId: string, public readonly items: string[]) {}
 * }
 *
 * @AgentCommandHandler(ProcessOrderCommand)
 * class ProcessOrderHandler extends OrkaCommandHandler<ProcessOrderCommand> {
 *   constructor(@InjectAgent('fulfillment') protected agent: BaseAgent) {
 *     super();
 *   }
 * }
 * ```
 */
export abstract class OrkaCommandHandler<C extends ICommand = ICommand> {
  protected abstract agent: BaseAgent;

  async execute(command: C): Promise<AgentResult> {
    return this.agent.run(JSON.stringify(command));
  }
}

// ─── Composite Decorators ─────────────────────────────────────────────────────

/**
 * Composite decorator combining @QueryHandler(Q) + @Injectable().
 * Apply to concrete OrkaQueryHandler subclasses.
 *
 * @example
 * ```typescript
 * @AgentQueryHandler(SearchProductsQuery)
 * class SearchProductsHandler extends OrkaQueryHandler<SearchProductsQuery> {
 *   constructor(@InjectAgent('search') protected agent: BaseAgent) { super(); }
 * }
 * ```
 */
export function AgentQueryHandler<Q>(QueryClass: Type<Q>): ClassDecorator {
  return applyDecorators(
    QueryHandler(QueryClass as Type<IQuery>),
    Injectable(),
  );
}

/**
 * Composite decorator combining @CommandHandler(C) + @Injectable().
 * Apply to concrete OrkaCommandHandler subclasses.
 *
 * @example
 * ```typescript
 * @AgentCommandHandler(ProcessOrderCommand)
 * class ProcessOrderHandler extends OrkaCommandHandler<ProcessOrderCommand> {
 *   constructor(@InjectAgent('fulfillment') protected agent: BaseAgent) { super(); }
 * }
 * ```
 */
export function AgentCommandHandler<C>(CommandClass: Type<C>): ClassDecorator {
  return applyDecorators(
    CommandHandler(CommandClass as Type<ICommand>),
    Injectable(),
  );
}
