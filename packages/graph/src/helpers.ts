import type { GraphNode, GraphContext } from './types.js';

export function actionNode(
  id: string, 
  fn: (ctx: GraphContext) => Promise<GraphContext>
): GraphNode {
  return { id, type: 'action', execute: fn };
}

export function conditionNode(
  id: string, 
  fn: (ctx: GraphContext) => string
): GraphNode {
  return { id, type: 'condition', condition: fn };
}

export function parallelNode(id: string, nodeIds: string[]): GraphNode {
  return { id, type: 'parallel', parallelNodes: nodeIds };
}

export function startNode(id = 'start'): GraphNode {
  return { id, type: 'start' };
}

export function endNode(id = 'end'): GraphNode {
  return { id, type: 'end' };
}

export function llmNode(id: string, options: {
  systemPrompt?: string;
  temperature?: number;
  maxTokens?: number;
  promptTemplate?: string;
} = {}): GraphNode {
  return {
    id,
    type: 'action',
    async execute(ctx: GraphContext): Promise<GraphContext> {
      let prompt = ctx.output || ctx.input;
      if (options.promptTemplate) {
        prompt = options.promptTemplate
          .replace('{{input}}', ctx.input)
          .replace('{{output}}', ctx.output)
          .replace('{{context}}', ctx.context.map(c => c.content).join('\n---\n'));
      }

      const result = await ctx.llm.generate(prompt, {
        systemPrompt: options.systemPrompt,
        temperature: options.temperature ?? 0.7,
        maxTokens: options.maxTokens ?? 1024,
      });

      ctx.output = result.content;
      return ctx;
    },
  };
}

export function retrieveNode(id: string, knowledgeName: string, options: {
  topK?: number;
  minScore?: number;
} = {}): GraphNode {
  return {
    id,
    type: 'action',
    async execute(ctx: GraphContext): Promise<GraphContext> {
      if (!ctx.knowledge) {
        throw new Error('Knowledge module not available');
      }

      const query = ctx.output || ctx.input;
      const results = await ctx.knowledge.search(knowledgeName, query, {
        topK: options.topK ?? 5,
        minScore: options.minScore,
      });

      ctx.context = results.map(r => ({
        content: r.content ?? '',
        score: r.score,
        metadata: r.metadata,
      }));

      ctx.output = ctx.context.map(c => c.content).join('\n---\n');
      return ctx;
    },
  };
}

export function edge(from: string, to: string, label?: string) {
  return { from, to, label };
}
