import 'reflect-metadata';
import { Inject } from '@nestjs/common';
import { ORKA_AGENT_TOKEN, ORKA_AGENT_CLIENT_TOKEN, ORKA_AGENT_METADATA, ORKA_REACT_METADATA } from './tokens.js';
import type { OrkaAgentMetadata, AgentReactOptions } from './types.js';
import type { BaseAgent } from '@orka-js/agent';

// ─── @OrkaAgent ───────────────────────────────────────────────────────────────

/**
 * Class decorator that marks a class as an OrkaJS agent and stores metadata.
 * Can be applied to any class — typically used alongside @Injectable().
 *
 * The metadata is used for documentation and discovery purposes.
 * To register agents with the DI container, use OrkaModule.forRoot({ agents: [...] }).
 *
 * @example
 * ```typescript
 * @OrkaAgent({ name: 'sales', description: 'Sales assistant agent' })
 * @Injectable()
 * class SalesAgentService {
 *   private agent = new StreamingToolAgent({ goal: '...', tools: [] }, llm);
 *   run(input: string) { return this.agent.run(input); }
 * }
 * ```
 */
export function OrkaAgent(config: OrkaAgentMetadata = {}): ClassDecorator {
  return (target: object) => {
    Reflect.defineMetadata(ORKA_AGENT_METADATA, config, target);
  };
}

// ─── @InjectAgent ─────────────────────────────────────────────────────────────

/**
 * Parameter/property decorator that injects a named OrkaJS agent from the DI container.
 * Equivalent to @Inject(ORKA_AGENT_TOKEN(name)).
 *
 * The agent must be registered via OrkaModule.forRoot({ agents: { [name]: agent } }).
 *
 * @example
 * ```typescript
 * @Injectable()
 * class OrderService {
 *   constructor(@InjectAgent('sales') private agent: BaseAgent) {}
 *
 *   async process(order: Order) {
 *     return this.agent.run(JSON.stringify(order));
 *   }
 * }
 * ```
 */
export function InjectAgent(name: string): ParameterDecorator & PropertyDecorator {
  return Inject(ORKA_AGENT_TOKEN(name)) as ParameterDecorator & PropertyDecorator;
}

// ─── @InjectAgentClient ───────────────────────────────────────────────────────

/**
 * Parameter/property decorator that injects a named OrkaJS agent client proxy.
 * Equivalent to @Inject(ORKA_AGENT_CLIENT_TOKEN(name)).
 *
 * The client must be registered via OrkaClientModule.forRoot({ clients: [...] }).
 *
 * @example
 * ```typescript
 * @Injectable()
 * class OrderService {
 *   constructor(@InjectAgentClient('remote') private client: AgentClient) {}
 *
 *   async process(order: Order) {
 *     return this.client.run('sales', JSON.stringify(order));
 *   }
 * }
 * ```
 */
export function InjectAgentClient(name: string): ParameterDecorator & PropertyDecorator {
  return Inject(ORKA_AGENT_CLIENT_TOKEN(name)) as ParameterDecorator & PropertyDecorator;
}

// ─── @AgentReact ──────────────────────────────────────────────────────────────

/**
 * Method decorator that replaces the decorated method body with a call to
 * `this[agentProperty].run(JSON.stringify(payload))`.
 *
 * Works seamlessly with NestJS @OnEvent() from @nestjs/event-emitter.
 * The original method body is ignored — it serves only as a TypeScript type site.
 *
 * @example
 * ```typescript
 * @Injectable()
 * class OrderEventHandler {
 *   constructor(@InjectAgent('fulfillment') private agent: BaseAgent) {}
 *
 *   @OnEvent('order.created')
 *   @AgentReact()
 *   async onOrderCreated(payload: OrderCreatedEvent) {}
 *
 *   @OnEvent('customer.churned')
 *   @AgentReact({ agent: 'agent', async: true })
 *   onChurn(payload: ChurnEvent): void {}
 * }
 * ```
 *
 * @param options - Agent property name (string shorthand) or full options object
 */
export function AgentReact(options: AgentReactOptions | string = {}): MethodDecorator {
  const opts: AgentReactOptions = typeof options === 'string' ? { agent: options } : options;
  const agentProp = opts.agent ?? 'agent';
  const fireAndForget = opts.async ?? false;

  return (
    target: object,
    propertyKey: string | symbol,
    descriptor: PropertyDescriptor,
  ): PropertyDescriptor => {
    Reflect.defineMetadata(ORKA_REACT_METADATA, opts, target, propertyKey);

    if (fireAndForget) {
      descriptor.value = function (this: Record<string, BaseAgent>, payload: unknown): void {
        const agent = this[agentProp];
        if (!agent?.run) {
          throw new Error(
            `[OrkaJS] @AgentReact: property "${agentProp}" is not a valid BaseAgent on ${this.constructor.name}`,
          );
        }
        void agent.run(JSON.stringify(payload));
      };
    } else {
      descriptor.value = async function (
        this: Record<string, BaseAgent>,
        payload: unknown,
      ): Promise<unknown> {
        const agent = this[agentProp];
        if (!agent?.run) {
          throw new Error(
            `[OrkaJS] @AgentReact: property "${agentProp}" is not a valid BaseAgent on ${this.constructor.name}`,
          );
        }
        return agent.run(JSON.stringify(payload));
      };
    }

    return descriptor;
  };
}
