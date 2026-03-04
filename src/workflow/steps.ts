import type { WorkflowStep, WorkflowContext } from './types.js';

export function plan(options: { prompt?: string } = {}): WorkflowStep {
  return {
    name: 'plan',
    async execute(ctx: WorkflowContext): Promise<WorkflowContext> {
      const startTime = Date.now();
      const prompt = options.prompt ?? 
        `Analyze the following request and create a brief plan to answer it. Be concise.\n\nRequest: ${ctx.input}`;

      const result = await ctx.llm.generate(prompt, {
        temperature: 0.3,
        maxTokens: 512,
        systemPrompt: 'You are a planning assistant. Create concise, actionable plans.',
      });

      ctx.output = result.content;
      ctx.metadata.plan = result.content;
      ctx.history.push({
        stepName: 'plan',
        output: result.content,
        latencyMs: Date.now() - startTime,
        usage: {
          promptTokens: result.usage.promptTokens,
          completionTokens: result.usage.completionTokens,
          totalTokens: result.usage.totalTokens,
        },
      });

      return ctx;
    },
  };
}

export function retrieve(knowledgeName: string, options: { topK?: number; minScore?: number } = {}): WorkflowStep {
  return {
    name: 'retrieve',
    async execute(ctx: WorkflowContext): Promise<WorkflowContext> {
      const startTime = Date.now();

      if (!ctx.knowledge) {
        throw new Error('Knowledge module not available in workflow context');
      }

      const query = ctx.metadata.plan as string ?? ctx.input;
      const results = await ctx.knowledge.search(knowledgeName, query, {
        topK: options.topK ?? 5,
        minScore: options.minScore,
      });

      ctx.context = results.map(r => ({
        content: r.content ?? '',
        score: r.score,
        metadata: r.metadata,
      }));

      const contextText = ctx.context.map(c => c.content).join('\n---\n');
      ctx.output = contextText;
      ctx.metadata.retrievedCount = results.length;

      ctx.history.push({
        stepName: 'retrieve',
        output: `Retrieved ${results.length} documents`,
        latencyMs: Date.now() - startTime,
        metadata: { documentCount: results.length },
      });

      return ctx;
    },
  };
}

export function generate(options: { systemPrompt?: string; temperature?: number; maxTokens?: number } = {}): WorkflowStep {
  return {
    name: 'generate',
    async execute(ctx: WorkflowContext): Promise<WorkflowContext> {
      const startTime = Date.now();

      let prompt = ctx.input;
      if (ctx.context.length > 0) {
        const contextText = ctx.context.map(c => c.content).join('\n\n---\n\n');
        prompt = `Context information:\n---\n${contextText}\n---\n\nBased on the context above, please answer:\n${ctx.input}`;
      }

      const result = await ctx.llm.generate(prompt, {
        temperature: options.temperature ?? 0.7,
        maxTokens: options.maxTokens ?? 1024,
        systemPrompt: options.systemPrompt ?? 'You are a helpful assistant. Answer based on the provided context. Do not make up information.',
      });

      ctx.output = result.content;
      ctx.history.push({
        stepName: 'generate',
        output: result.content,
        latencyMs: Date.now() - startTime,
        usage: {
          promptTokens: result.usage.promptTokens,
          completionTokens: result.usage.completionTokens,
          totalTokens: result.usage.totalTokens,
        },
      });

      return ctx;
    },
  };
}

export function verify(options: { criteria?: string[] } = {}): WorkflowStep {
  return {
    name: 'verify',
    async execute(ctx: WorkflowContext): Promise<WorkflowContext> {
      const startTime = Date.now();
      const lastOutput = ctx.output;

      const criteriaText = options.criteria?.length
        ? options.criteria.map((c, i) => `${i + 1}. ${c}`).join('\n')
        : '1. The answer is relevant to the question\n2. The answer is based on provided context\n3. The answer does not contain hallucinated information';

      const contextText = ctx.context.length > 0
        ? `\nContext:\n${ctx.context.map(c => c.content).join('\n---\n')}`
        : '';

      const prompt = `You are a quality verification judge. Evaluate the following answer.

Question: ${ctx.input}
${contextText}
Answer: ${lastOutput}

Criteria:
${criteriaText}

Respond in this exact JSON format:
{"pass": true/false, "score": 0.0-1.0, "issues": ["issue1", "issue2"]}`;

      const result = await ctx.llm.generate(prompt, {
        temperature: 0,
        maxTokens: 256,
        systemPrompt: 'You are a strict quality judge. Respond only with valid JSON.',
      });

      let verification: { pass: boolean; score: number; issues: string[] };
      try {
        const jsonMatch = result.content.match(/\{[\s\S]*\}/);
        verification = JSON.parse(jsonMatch?.[0] ?? result.content);
      } catch {
        verification = { pass: true, score: 0.5, issues: ['Could not parse verification result'] };
      }

      ctx.metadata.verification = verification;
      ctx.history.push({
        stepName: 'verify',
        output: JSON.stringify(verification),
        latencyMs: Date.now() - startTime,
        usage: {
          promptTokens: result.usage.promptTokens,
          completionTokens: result.usage.completionTokens,
          totalTokens: result.usage.totalTokens,
        },
        metadata: verification,
      });

      return ctx;
    },
  };
}

export function improve(options: { maxIterations?: number } = {}): WorkflowStep {
  return {
    name: 'improve',
    async execute(ctx: WorkflowContext): Promise<WorkflowContext> {
      const startTime = Date.now();
      const verification = ctx.metadata.verification as { pass: boolean; score: number; issues: string[] } | undefined;

      if (!verification || verification.pass) {
        ctx.history.push({
          stepName: 'improve',
          output: 'No improvement needed',
          latencyMs: Date.now() - startTime,
        });
        return ctx;
      }

      const maxIter = options.maxIterations ?? 1;
      let currentOutput = ctx.output;

      for (let i = 0; i < maxIter; i++) {
        const issues = verification.issues?.join('\n- ') ?? 'Quality issues detected';
        const contextText = ctx.context.length > 0
          ? `\nContext:\n${ctx.context.map(c => c.content).join('\n---\n')}`
          : '';

        const prompt = `The following answer has quality issues that need to be fixed.

Question: ${ctx.input}
${contextText}
Current answer: ${currentOutput}

Issues to fix:
- ${issues}

Please provide an improved answer that addresses all the issues. Only output the improved answer, nothing else.`;

        const result = await ctx.llm.generate(prompt, {
          temperature: 0.3,
          maxTokens: 1024,
          systemPrompt: 'You are a helpful assistant. Improve the answer based on the feedback.',
        });

        currentOutput = result.content;
      }

      ctx.output = currentOutput;
      ctx.history.push({
        stepName: 'improve',
        output: currentOutput,
        latencyMs: Date.now() - startTime,
      });

      return ctx;
    },
  };
}

export function custom(name: string, fn: (ctx: WorkflowContext) => Promise<WorkflowContext>): WorkflowStep {
  return {
    name,
    execute: fn,
  };
}
