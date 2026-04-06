/**
 * @orka-js/nestjs/microservice
 *
 * Microservice integration — expose and consume OrkaJS agents via NestJS transport layers.
 *
 * Requires @nestjs/microservices as a peer dependency:
 *   npm install @nestjs/microservices
 *
 * This file imports from @nestjs/microservices at the top level. If it is not
 * installed, importing this sub-path will throw a module resolution error.
 *
 * Safe usage — only import if @nestjs/microservices is installed:
 *   import { OrkaMessageHandler, AgentClient, OrkaClientModule } from '@orka-js/nestjs/microservice'
 *
 * Architecture:
 *   - Server side: OrkaModule.forMicroservice({ agents }) + NestJS microservice app
 *   - Client side: OrkaClientModule.forRoot({ clients }) + @InjectAgentClient(name)
 *
 * Message patterns:
 *   - 'orka.agent.run' — synchronous run, returns AgentResult
 */

import { Controller, Injectable, Inject, Module } from '@nestjs/common';
import { MessagePattern, ClientProxy, ClientsModule, Transport } from '@nestjs/microservices';
import type { DynamicModule } from '@nestjs/common';
import type { BaseAgent, AgentResult } from '@orka-js/agent';
import { ORKA_AGENTS_MAP, ORKA_AGENT_CLIENT_TOKEN } from './tokens.js';
import type { MicroserviceAgentRunPayload, OrkaClientModuleConfig, OrkaClientRegistration } from './types.js';

// Re-export Transport for convenience
export { Transport };

// ─── OrkaMessageHandler ───────────────────────────────────────────────────────

/**
 * NestJS microservice message handler that routes messages to OrkaJS agents.
 *
 * Registered automatically by OrkaModule.forMicroservice().
 * Handles the `orka.agent.run` message pattern.
 *
 * @example Server app setup:
 * ```typescript
 * // main.ts
 * const app = await NestFactory.createMicroservice<MicroserviceOptions>(AppModule, {
 *   transport: Transport.REDIS,
 *   options: { host: 'localhost', port: 6379 },
 * });
 * await app.listen();
 *
 * // app.module.ts
 * @Module({
 *   imports: [OrkaModule.forMicroservice({ agents: { sales: salesAgent } })]
 * })
 * class AppModule {}
 * ```
 */
@Controller()
@Injectable()
export class OrkaMessageHandler {
  constructor(
    @Inject(ORKA_AGENTS_MAP) private readonly agents: Record<string, BaseAgent>,
  ) {}

  /**
   * Handles synchronous agent run requests.
   * Pattern: 'orka.agent.run'
   * Payload: { agentName: string, input: string, metadata?: Record<string, unknown> }
   */
  @MessagePattern('orka.agent.run')
  async handleAgentRun(
    payload: MicroserviceAgentRunPayload,
  ): Promise<AgentResult | { error: string }> {
    const { agentName, input } = payload;
    const agent = this.agents[agentName];

    if (!agent) {
      return {
        error: `Agent "${agentName}" not found. Available: ${Object.keys(this.agents).join(', ')}`,
      };
    }

    try {
      return await agent.run(input);
    } catch (err) {
      return { error: (err as Error).message };
    }
  }
}

// ─── AgentClient ──────────────────────────────────────────────────────────────

/**
 * Type-safe wrapper around NestJS ClientProxy for calling remote OrkaJS agents.
 * Inject via @InjectAgentClient(name) after registering OrkaClientModule.
 *
 * @example
 * ```typescript
 * @Injectable()
 * class OrderService {
 *   constructor(@InjectAgentClient('remote') private client: AgentClient) {}
 *
 *   async processOrder(order: Order): Promise<AgentResult> {
 *     return this.client.run('sales', JSON.stringify(order));
 *   }
 *
 *   notifyFulfillment(order: Order): void {
 *     this.client.emit('fulfillment', JSON.stringify(order)); // fire-and-forget
 *   }
 * }
 * ```
 */
@Injectable()
export class AgentClient {
  constructor(private readonly proxy: ClientProxy) {}

  /**
   * Send a synchronous message to a remote agent and await the result.
   */
  async run(
    agentName: string,
    input: string,
    metadata?: Record<string, unknown>,
  ): Promise<AgentResult> {
    const payload: MicroserviceAgentRunPayload = { agentName, input, metadata };
    const result = await this.proxy
      .send<AgentResult>('orka.agent.run', payload)
      .toPromise();
    return result as AgentResult;
  }

  /**
   * Emit a fire-and-forget message to a remote agent.
   * No response is awaited — useful for background processing.
   */
  emit(agentName: string, input: string, metadata?: Record<string, unknown>): void {
    const payload: MicroserviceAgentRunPayload = { agentName, input, metadata };
    this.proxy.emit('orka.agent.run', payload);
  }
}

// ─── OrkaClientModule ─────────────────────────────────────────────────────────

/**
 * NestJS module for consuming remote OrkaJS agents via microservice transport.
 * Register in the consuming app's module and inject via @InjectAgentClient(name).
 *
 * @example
 * ```typescript
 * @Module({
 *   imports: [
 *     OrkaClientModule.forRoot({
 *       clients: [
 *         {
 *           name: 'remote',
 *           options: {
 *             transport: Transport.REDIS,
 *             options: { host: 'localhost', port: 6379 },
 *           },
 *         },
 *       ],
 *     }),
 *   ],
 * })
 * class ConsumerModule {}
 * ```
 */
@Module({})
export class OrkaClientModule {
  static forRoot(config: OrkaClientModuleConfig): DynamicModule {
    const internalProxyTokens = config.clients.map(
      (c: OrkaClientRegistration) => `_ORKA_PROXY_${c.name}`,
    );

    const clientsModuleImport = ClientsModule.register(
      config.clients.map((c: OrkaClientRegistration) => ({
        name: `_ORKA_PROXY_${c.name}`,
        ...(c.options as Record<string, unknown>),
      })),
    );

    const agentClientProviders = config.clients.map((c: OrkaClientRegistration) => ({
      provide: ORKA_AGENT_CLIENT_TOKEN(c.name),
      useFactory: (proxy: ClientProxy) => new AgentClient(proxy),
      inject: [`_ORKA_PROXY_${c.name}`],
    }));

    return {
      module: OrkaClientModule,
      imports: [clientsModuleImport],
      providers: agentClientProviders,
      exports: [
        ...agentClientProviders.map((p) => p.provide),
        ...internalProxyTokens,
      ],
    };
  }
}
