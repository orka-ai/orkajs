import { Module, DynamicModule, Provider, Type } from '@nestjs/common';
import type { ValueProvider } from '@nestjs/common';
import type { BaseAgent } from '@orka-js/agent';
import { ORKA_MODULE_CONFIG, ORKA_AGENTS_MAP, ORKA_AGENT_TOKEN } from './tokens.js';
import { createOrkaController, createAsyncOrkaController } from './controller.js';
import type { OrkaModuleConfig, OrkaModuleAsyncConfig, AgentRegistration } from './types.js';

// ─── Internal helpers ─────────────────────────────────────────────────────────

function normalizeAgents(agents: OrkaModuleConfig['agents']): Record<string, BaseAgent> {
  if (Array.isArray(agents)) {
    return Object.fromEntries(
      (agents as AgentRegistration[]).map(({ name, agent }) => [name, agent]),
    );
  }
  return agents as Record<string, BaseAgent>;
}

function buildAgentProviders(agentsMap: Record<string, BaseAgent>): ValueProvider[] {
  return Object.entries(agentsMap).map(([name, agent]) => ({
    provide: ORKA_AGENT_TOKEN(name),
    useValue: agent,
  }));
}

// ─── OrkaModule ───────────────────────────────────────────────────────────────

/**
 * OrkaModule — the central NestJS integration module for OrkaJS agents.
 *
 * Three registration variants:
 *
 * 1. `forRoot(config)` — synchronous, for known agents at startup
 * 2. `forRootAsync(options)` — asynchronous, for env/ConfigService-dependent config
 * 3. `forMicroservice(config)` — microservice handler (no HTTP controller)
 *
 * @example forRoot
 * ```typescript
 * @Module({
 *   imports: [
 *     OrkaModule.forRoot({
 *       agents: { assistant: new StreamingToolAgent({ goal: '...', tools: [] }, llm) },
 *       path: 'ai',   // routes: GET /ai, POST /ai/:agent, POST /ai/:agent/stream
 *     })
 *   ]
 * })
 * export class AppModule {}
 * ```
 *
 * @example forRootAsync (with ConfigService)
 * ```typescript
 * @Module({
 *   imports: [
 *     ConfigModule.forRoot(),
 *     OrkaModule.forRootAsync({
 *       imports: [ConfigModule],
 *       path: 'ai',
 *       useFactory: (config: ConfigService) => ({
 *         agents: {
 *           assistant: new Agent(
 *             { goal: 'Assistant', tools: [] },
 *             new AnthropicAdapter({ apiKey: config.get('ANTHROPIC_API_KEY') })
 *           ),
 *         },
 *       }),
 *       inject: [ConfigService],
 *     })
 *   ]
 * })
 * export class AppModule {}
 * ```
 */
@Module({})
export class OrkaModule {
  /**
   * Synchronous registration — agents are provided as direct instances.
   * Registers each agent as a named provider: `ORKA_AGENT_TOKEN(name)`.
   * Optionally mounts the built-in HTTP controller at `config.path` (default: 'orka').
   */
  static forRoot(config: OrkaModuleConfig): DynamicModule {
    const agentsMap = normalizeAgents(config.agents);
    const agentProviders = buildAgentProviders(agentsMap);

    const providers: Provider[] = [
      { provide: ORKA_MODULE_CONFIG, useValue: config },
      { provide: ORKA_AGENTS_MAP, useValue: agentsMap },
      ...agentProviders,
    ];

    const controllers: Type<unknown>[] = [];
    if (config.path !== false) {
      const normalizedPath = (config.path ?? 'orka').replace(/^\//, '');
      controllers.push(createOrkaController(normalizedPath, agentsMap));
    }

    return {
      module: OrkaModule,
      global: config.global ?? false,
      providers,
      controllers,
      exports: [
        ORKA_AGENTS_MAP,
        ...agentProviders.map((p) => p.provide as string),
      ],
    };
  }

  /**
   * Asynchronous registration — agents are resolved from a factory function.
   * Useful when agent config depends on async services like ConfigService.
   *
   * The controller `path` must be provided statically because NestJS resolves
   * controller metadata at bootstrap, before async factories resolve.
   * The agents map is resolved asynchronously via DI and injected into the controller.
   */
  static forRootAsync(options: OrkaModuleAsyncConfig): DynamicModule {
    const configProvider: Provider = {
      provide: ORKA_MODULE_CONFIG,
      useFactory: options.useFactory,
      inject: (options.inject ?? []) as (string | symbol | Type<unknown>)[],
    };

    const agentsMapProvider: Provider = {
      provide: ORKA_AGENTS_MAP,
      useFactory: (config: OrkaModuleConfig) => normalizeAgents(config.agents),
      inject: [ORKA_MODULE_CONFIG],
    };

    const providers: Provider[] = [configProvider, agentsMapProvider];

    const controllers: Type<unknown>[] = [];
    if (options.path !== false) {
      const normalizedPath = (options.path ?? 'orka').replace(/^\//, '');
      controllers.push(createAsyncOrkaController(normalizedPath));
    }

    return {
      module: OrkaModule,
      global: options.global ?? false,
      imports: options.imports ?? [],
      providers,
      controllers,
      exports: [ORKA_AGENTS_MAP],
    };
  }

  /**
   * Microservice registration — registers OrkaMessageHandler to respond to
   * NestJS message patterns. Does not mount an HTTP controller.
   *
   * Returns a Promise<DynamicModule> to allow dynamic import of the microservice
   * module (avoiding a hard dependency on @nestjs/microservices when not used).
   *
   * @example
   * ```typescript
   * // main.ts (microservice app)
   * const app = await NestFactory.createMicroservice(
   *   await AppModule.create(),
   *   { transport: Transport.REDIS, options: { host: 'localhost', port: 6379 } }
   * );
   * await app.listen();
   *
   * // app.module.ts
   * export class AppModule {
   *   static async create() {
   *     return {
   *       module: AppModule,
   *       imports: [await OrkaModule.forMicroservice({ agents: { sales: salesAgent } })]
   *     };
   *   }
   * }
   * ```
   */
  static async forMicroservice(config: OrkaModuleConfig): Promise<DynamicModule> {
    let OrkaMessageHandler: Type<unknown>;
    try {
      const mod = await import('./microservice.js');
      OrkaMessageHandler = mod.OrkaMessageHandler;
    } catch {
      throw new Error(
        '[OrkaJS] @nestjs/microservices is required for OrkaModule.forMicroservice(). ' +
          'Install it with: npm install @nestjs/microservices',
      );
    }

    const agentsMap = normalizeAgents(config.agents);
    const agentProviders = buildAgentProviders(agentsMap);

    const providers: Provider[] = [
      { provide: ORKA_MODULE_CONFIG, useValue: config },
      { provide: ORKA_AGENTS_MAP, useValue: agentsMap },
      ...agentProviders,
      OrkaMessageHandler,
    ];

    return {
      module: OrkaModule,
      global: config.global ?? false,
      providers,
      controllers: [OrkaMessageHandler],
      exports: [
        ORKA_AGENTS_MAP,
        ...agentProviders.map((p) => p.provide as string),
      ],
    };
  }
}
