import { describe, it, expect, vi, beforeEach } from 'vitest';
import 'reflect-metadata';
import type { BaseAgent, AgentResult } from '@orka-js/agent';
import type { LLMAdapter, LLMResult } from '@orka-js/core';

// ─── Mock factories ───────────────────────────────────────────────────────────

function createMockAgent(output = 'test output'): BaseAgent {
  return {
    goal: 'test',
    run: vi.fn().mockImplementation(async (input: string): Promise<AgentResult> => ({
      input,
      output,
      steps: [],
      totalLatencyMs: 10,
      totalTokens: 50,
      toolsUsed: [],
      metadata: {},
    })),
    on: function () { return this as BaseAgent; },
    off: function () { return this as BaseAgent; },
  } as unknown as BaseAgent;
}

function createMockLLM(responseContent = 'ALLOW'): LLMAdapter {
  return {
    name: 'mock',
    generate: vi.fn().mockResolvedValue({
      content: responseContent,
      usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
      model: 'mock',
      finishReason: 'stop',
    } satisfies LLMResult),
    generateObject: vi.fn().mockResolvedValue({}),
    embed: vi.fn().mockResolvedValue([[]]),
  };
}

// ─── tokens.ts ────────────────────────────────────────────────────────────────

describe('ORKA_AGENT_TOKEN', () => {
  it('generates deterministic string tokens', async () => {
    const { ORKA_AGENT_TOKEN } = await import('../tokens.js');
    expect(ORKA_AGENT_TOKEN('assistant')).toBe('ORKA_AGENT:assistant');
    expect(ORKA_AGENT_TOKEN('sales')).toBe('ORKA_AGENT:sales');
  });

  it('generates distinct tokens for different names', async () => {
    const { ORKA_AGENT_TOKEN } = await import('../tokens.js');
    expect(ORKA_AGENT_TOKEN('a')).not.toBe(ORKA_AGENT_TOKEN('b'));
  });

  it('generates stable tokens across calls', async () => {
    const { ORKA_AGENT_TOKEN } = await import('../tokens.js');
    expect(ORKA_AGENT_TOKEN('foo')).toBe(ORKA_AGENT_TOKEN('foo'));
  });
});

describe('ORKA_AGENT_CLIENT_TOKEN', () => {
  it('generates distinct namespace from ORKA_AGENT_TOKEN', async () => {
    const { ORKA_AGENT_TOKEN, ORKA_AGENT_CLIENT_TOKEN } = await import('../tokens.js');
    expect(ORKA_AGENT_CLIENT_TOKEN('x')).not.toBe(ORKA_AGENT_TOKEN('x'));
    expect(ORKA_AGENT_CLIENT_TOKEN('remote')).toBe('ORKA_AGENT_CLIENT:remote');
  });
});

// ─── @OrkaAgent ───────────────────────────────────────────────────────────────

describe('@OrkaAgent', () => {
  it('stores metadata on the class via Reflect', async () => {
    const { OrkaAgent } = await import('../decorators.js');
    const { ORKA_AGENT_METADATA } = await import('../tokens.js');

    class TestAgentClass {}
    OrkaAgent({ name: 'test-agent', description: 'A test agent' })(TestAgentClass);

    const meta = Reflect.getMetadata(ORKA_AGENT_METADATA, TestAgentClass);
    expect(meta).toEqual({ name: 'test-agent', description: 'A test agent' });
  });

  it('works with no arguments (defaults to empty object)', async () => {
    const { OrkaAgent } = await import('../decorators.js');
    const { ORKA_AGENT_METADATA } = await import('../tokens.js');

    class EmptyAgent {}
    OrkaAgent()(EmptyAgent);

    const meta = Reflect.getMetadata(ORKA_AGENT_METADATA, EmptyAgent);
    expect(meta).toEqual({});
  });

  it('does not affect class prototype or behavior', async () => {
    const { OrkaAgent } = await import('../decorators.js');

    @OrkaAgent({ name: 'noop' })
    class NoopClass {
      greet() { return 'hello'; }
    }

    expect(new NoopClass().greet()).toBe('hello');
  });
});

// ─── @AgentReact ──────────────────────────────────────────────────────────────

describe('@AgentReact', () => {
  it('replaces method body with agent.run call (default "agent" property)', async () => {
    const { AgentReact } = await import('../decorators.js');
    const mockAgent = createMockAgent('hello from agent');

    class EventHandler {
      agent = mockAgent;

      @AgentReact()
      async onEvent(_payload: unknown) {
        return 'original body — should be ignored';
      }
    }

    const handler = new EventHandler();
    const result = await handler.onEvent({ type: 'test', id: 42 });
    expect((result as AgentResult).output).toBe('hello from agent');
    expect((result as AgentResult).input).toBe(JSON.stringify({ type: 'test', id: 42 }));
    expect(mockAgent.run).toHaveBeenCalledOnce();
  });

  it('accepts string shorthand: @AgentReact("myAgent")', async () => {
    const { AgentReact } = await import('../decorators.js');
    const mockAgent = createMockAgent('custom prop');

    class Handler {
      myAgent = mockAgent;
      otherAgent = createMockAgent('wrong');

      @AgentReact('myAgent')
      async onEvent(_payload: unknown) {}
    }

    const handler = new Handler();
    const result = await handler.onEvent('ping');
    expect((result as AgentResult).output).toBe('custom prop');
    expect(mockAgent.run).toHaveBeenCalledWith(JSON.stringify('ping'));
  });

  it('fire-and-forget mode (async: true) returns void synchronously', async () => {
    const { AgentReact } = await import('../decorators.js');
    const runMock = vi.fn().mockResolvedValue({
      output: 'ok', input: '', steps: [], totalLatencyMs: 0, totalTokens: 0, toolsUsed: [], metadata: {},
    });

    class Handler {
      agent = { ...createMockAgent(), run: runMock };

      @AgentReact({ async: true })
      onEvent(_payload: unknown): void { /* fire-and-forget */ }
    }

    const handler = new Handler();
    const returnValue = handler.onEvent({ order: 123 });

    expect(returnValue).toBeUndefined();
    await new Promise(r => setTimeout(r, 20));
    expect(runMock).toHaveBeenCalledWith(JSON.stringify({ order: 123 }));
  });

  it('throws [OrkaJS] error if agent property is missing', async () => {
    const { AgentReact } = await import('../decorators.js');

    class Handler {
      @AgentReact()
      async onEvent(_payload: unknown) {}
    }

    const handler = new Handler();
    await expect(handler.onEvent('test')).rejects.toThrow('[OrkaJS]');
  });

  it('throws [OrkaJS] error if agent property is not a valid agent', async () => {
    const { AgentReact } = await import('../decorators.js');

    class Handler {
      agent = 'not-an-agent';

      @AgentReact()
      async onEvent(_payload: unknown) {}
    }

    const handler = new Handler();
    await expect(handler.onEvent('test')).rejects.toThrow('[OrkaJS]');
  });

  it('stores ORKA_REACT_METADATA on the method', async () => {
    const { AgentReact } = await import('../decorators.js');
    const { ORKA_REACT_METADATA } = await import('../tokens.js');

    class Handler {
      async onEvent(_payload: unknown) { return _payload; }
    }
    const descriptor = Object.getOwnPropertyDescriptor(Handler.prototype, 'onEvent')!;
    AgentReact({ agent: 'myAgent', async: false })(Handler.prototype, 'onEvent', descriptor);

    const meta = Reflect.getMetadata(ORKA_REACT_METADATA, Handler.prototype, 'onEvent');
    expect(meta).toEqual({ agent: 'myAgent', async: false });
  });
});

// ─── OrkaSemanticGuard ────────────────────────────────────────────────────────

describe('OrkaSemanticGuard', () => {
  const makeContext = (override: Partial<{ method: string; url: string; body: unknown; headers: Record<string, string> }> = {}) => ({
    switchToHttp: () => ({
      getRequest: () => ({
        method: 'GET',
        url: '/test',
        body: null,
        headers: {},
        ...override,
      }),
    }),
  });

  it('returns true when LLM responds with ALLOW', async () => {
    const { OrkaSemanticGuard } = await import('../guards.js');
    const llm = createMockLLM('ALLOW');
    const guard = new OrkaSemanticGuard(llm, 'Allow all authenticated users');

    const result = await guard.canActivate(makeContext() as never);
    expect(result).toBe(true);
    expect(llm.generate).toHaveBeenCalledOnce();
  });

  it('returns false when LLM responds with DENY', async () => {
    const { OrkaSemanticGuard } = await import('../guards.js');
    const llm = createMockLLM('DENY');
    const guard = new OrkaSemanticGuard(llm, 'Deny all requests');

    const result = await guard.canActivate(
      makeContext({ method: 'POST', url: '/admin', body: { password: 'hack' } }) as never,
    );
    expect(result).toBe(false);
  });

  it('fails closed (returns false) when LLM throws', async () => {
    const { OrkaSemanticGuard } = await import('../guards.js');
    const llm = createMockLLM();
    (llm.generate as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('LLM unavailable'));

    const guard = new OrkaSemanticGuard(llm, 'Some policy');
    const result = await guard.canActivate(makeContext() as never);
    expect(result).toBe(false);
  });

  it('includes request details in the LLM prompt', async () => {
    const { OrkaSemanticGuard } = await import('../guards.js');
    const llm = createMockLLM('ALLOW');
    const guard = new OrkaSemanticGuard(llm, 'Only GET requests allowed');

    await guard.canActivate(
      makeContext({ method: 'DELETE', url: '/users/123', headers: { authorization: 'Bearer token' } }) as never,
    );

    const promptArg = (llm.generate as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    expect(promptArg).toContain('DELETE');
    expect(promptArg).toContain('/users/123');
    expect(promptArg).toContain('Bearer token');
    expect(promptArg).toContain('Only GET requests allowed');
  });

  it('is case-insensitive for ALLOW detection', async () => {
    const { OrkaSemanticGuard } = await import('../guards.js');
    const llm = createMockLLM('allow (confirmed)');
    const guard = new OrkaSemanticGuard(llm, 'policy');

    const result = await guard.canActivate(makeContext() as never);
    expect(result).toBe(true);
  });
});

// ─── AgentValidationPipe ──────────────────────────────────────────────────────

describe('AgentValidationPipe', () => {
  const mockSchema = {
    parse: (data: unknown) => data as { query: string },
    safeParse: (data: unknown): { success: true; data: { query: string } } | { success: false; error: unknown } => {
      if (data !== null && typeof data === 'object' && 'query' in (data as object)) {
        return { success: true, data: data as { query: string } };
      }
      return { success: false, error: 'Missing query field' };
    },
  };

  const dummyMetadata = { type: 'body' as const, metatype: undefined, data: undefined };

  it('extracts structured data from { input: "..." } via LLM', async () => {
    const { AgentValidationPipe } = await import('../pipes.js');
    const llm = createMockLLM();
    (llm.generateObject as ReturnType<typeof vi.fn>).mockResolvedValue({ query: 'parsed query' });

    const pipe = new AgentValidationPipe(mockSchema, llm, { description: 'search query' });
    const result = await pipe.transform({ input: 'find something' }, dummyMetadata);

    expect(result).toEqual({ query: 'parsed query' });
    expect(llm.generateObject).toHaveBeenCalledOnce();
  });

  it('validates structured object directly without calling LLM', async () => {
    const { AgentValidationPipe } = await import('../pipes.js');
    const llm = createMockLLM();
    const pipe = new AgentValidationPipe(mockSchema, llm);

    const result = await pipe.transform({ query: 'direct query' }, dummyMetadata);

    expect(result).toEqual({ query: 'direct query' });
    expect(llm.generateObject).not.toHaveBeenCalled();
  });

  it('falls back to LLM if direct schema validation fails', async () => {
    const { AgentValidationPipe } = await import('../pipes.js');
    const llm = createMockLLM();
    (llm.generateObject as ReturnType<typeof vi.fn>).mockResolvedValue({ query: 'extracted' });

    const pipe = new AgentValidationPipe(mockSchema, llm);
    // Object missing 'query' field — schema fails, LLM fallback
    const result = await pipe.transform({ color: 'red', price: 50 }, dummyMetadata);

    expect(result).toEqual({ query: 'extracted' });
    expect(llm.generateObject).toHaveBeenCalledOnce();
  });

  it('accepts plain string input via LLM', async () => {
    const { AgentValidationPipe } = await import('../pipes.js');
    const llm = createMockLLM();
    (llm.generateObject as ReturnType<typeof vi.fn>).mockResolvedValue({ query: 'from string' });

    const pipe = new AgentValidationPipe(mockSchema, llm);
    const result = await pipe.transform('search for shoes', dummyMetadata);

    expect(result).toEqual({ query: 'from string' });
  });

  it('throws BadRequestException when LLM throws', async () => {
    const { AgentValidationPipe } = await import('../pipes.js');
    const llm = createMockLLM();
    (llm.generateObject as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('LLM error'));

    const pipe = new AgentValidationPipe(mockSchema, llm);
    await expect(
      pipe.transform({ input: 'bad input' }, dummyMetadata),
    ).rejects.toThrow('Failed to parse input');
  });

  it('throws BadRequestException for null/undefined input', async () => {
    const { AgentValidationPipe } = await import('../pipes.js');
    const llm = createMockLLM();
    const pipe = new AgentValidationPipe(mockSchema, llm);

    await expect(pipe.transform(null, dummyMetadata)).rejects.toThrow();
    await expect(pipe.transform(42, dummyMetadata)).rejects.toThrow();
  });
});

// ─── index.ts exports ─────────────────────────────────────────────────────────

describe('index exports', () => {
  it('exports all expected public symbols', async () => {
    const mod = await import('../index.js');

    // Classes
    expect(mod.OrkaModule).toBeDefined();
    expect(mod.OrkaSemanticGuard).toBeDefined();
    expect(mod.AgentValidationPipe).toBeDefined();

    // Decorator functions
    expect(mod.OrkaAgent).toBeDefined();
    expect(mod.InjectAgent).toBeDefined();
    expect(mod.InjectAgentClient).toBeDefined();
    expect(mod.AgentReact).toBeDefined();

    // Controller factories
    expect(mod.createOrkaController).toBeDefined();
    expect(mod.createAsyncOrkaController).toBeDefined();

    // Token factories
    expect(mod.ORKA_AGENT_TOKEN).toBeDefined();
    expect(mod.ORKA_AGENT_CLIENT_TOKEN).toBeDefined();

    // Token symbols
    expect(mod.ORKA_AGENTS_MAP).toBeDefined();
    expect(mod.ORKA_MODULE_CONFIG).toBeDefined();
    expect(mod.ORKA_AGENT_METADATA).toBeDefined();
    expect(mod.ORKA_REACT_METADATA).toBeDefined();
  });

  it('CQRS and microservice features are NOT exported from main index', async () => {
    const mod = await import('../index.js') as Record<string, unknown>;
    expect(mod['OrkaQueryHandler']).toBeUndefined();
    expect(mod['OrkaCommandHandler']).toBeUndefined();
    expect(mod['OrkaMessageHandler']).toBeUndefined();
    expect(mod['AgentClient']).toBeUndefined();
    expect(mod['OrkaClientModule']).toBeUndefined();
  });
});

// ─── OrkaModule.forRoot provider structure ────────────────────────────────────

describe('OrkaModule.forRoot', () => {
  it('returns a DynamicModule with correct module reference', async () => {
    const { OrkaModule } = await import('../module.js');
    const agent = createMockAgent();

    const dynamicModule = OrkaModule.forRoot({ agents: { assistant: agent } });

    expect(dynamicModule.module).toBe(OrkaModule);
    expect(Array.isArray(dynamicModule.providers)).toBe(true);
  });

  it('registers each agent as a named provider', async () => {
    const { OrkaModule } = await import('../module.js');
    const { ORKA_AGENT_TOKEN } = await import('../tokens.js');

    const salesAgent = createMockAgent('sales');
    const supportAgent = createMockAgent('support');

    const dynamicModule = OrkaModule.forRoot({
      agents: { sales: salesAgent, support: supportAgent },
      path: false,
    });

    const provides = (dynamicModule.providers as { provide: unknown }[]).map((p) => p.provide);
    expect(provides).toContain(ORKA_AGENT_TOKEN('sales'));
    expect(provides).toContain(ORKA_AGENT_TOKEN('support'));
  });

  it('accepts array form for agents', async () => {
    const { OrkaModule } = await import('../module.js');
    const { ORKA_AGENT_TOKEN, ORKA_AGENTS_MAP } = await import('../tokens.js');

    const agent = createMockAgent();
    const dynamicModule = OrkaModule.forRoot({
      agents: [{ name: 'my-agent', agent }],
      path: false,
    });

    const provides = (dynamicModule.providers as { provide: unknown }[]).map((p) => p.provide);
    expect(provides).toContain(ORKA_AGENT_TOKEN('my-agent'));
    expect(provides).toContain(ORKA_AGENTS_MAP);
  });

  it('mounts a controller when path is set', async () => {
    const { OrkaModule } = await import('../module.js');
    const agent = createMockAgent();

    const withController = OrkaModule.forRoot({
      agents: { assistant: agent },
      path: 'ai',
    });

    const withoutController = OrkaModule.forRoot({
      agents: { assistant: agent },
      path: false,
    });

    expect((withController.controllers ?? []).length).toBeGreaterThan(0);
    expect((withoutController.controllers ?? []).length).toBe(0);
  });

  it('exports ORKA_AGENTS_MAP and agent tokens', async () => {
    const { OrkaModule } = await import('../module.js');
    const { ORKA_AGENT_TOKEN, ORKA_AGENTS_MAP } = await import('../tokens.js');

    const agent = createMockAgent();
    const dynamicModule = OrkaModule.forRoot({
      agents: { bot: agent },
      path: false,
    });

    const exports = dynamicModule.exports as unknown[];
    expect(exports).toContain(ORKA_AGENTS_MAP);
    expect(exports).toContain(ORKA_AGENT_TOKEN('bot'));
  });
});
