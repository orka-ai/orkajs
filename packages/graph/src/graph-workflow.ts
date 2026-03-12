import type { LLMAdapter, VectorDBAdapter } from '@orka-js/core';
import type { Knowledge } from '@orka-js/core';
import type { 
  GraphConfig, 
  GraphContext, 
  GraphNode, 
  GraphResult, 
  GraphNodeResult 
} from './types.js';

export class GraphWorkflow {
  private config: GraphConfig;
  private nodes: Map<string, GraphNode>;
  private adjacency: Map<string, Array<{ to: string; label?: string }>>;
  private llm: LLMAdapter;
  private vectorDB?: VectorDBAdapter;
  private knowledge?: Knowledge;

  constructor(
    config: GraphConfig,
    llm: LLMAdapter,
    vectorDB?: VectorDBAdapter,
    knowledge?: Knowledge,
  ) {
    this.config = config;
    this.llm = llm;
    this.vectorDB = vectorDB;
    this.knowledge = knowledge;

    this.nodes = new Map(config.nodes.map(n => [n.id, n]));
    this.adjacency = new Map();

    for (const edge of config.edges) {
      if (!this.adjacency.has(edge.from)) {
        this.adjacency.set(edge.from, []);
      }
      this.adjacency.get(edge.from)!.push({ to: edge.to, label: edge.label });
    }

    this.validate();
  }

  async run(input: string | { input: string; metadata?: Record<string, unknown> }): Promise<GraphResult> {
    const startTime = Date.now();
    const inputStr = typeof input === 'string' ? input : input.input;
    const inputMetadata = typeof input === 'string' ? {} : (input.metadata ?? {});

    let ctx: GraphContext = {
      input: inputStr,
      output: '',
      nodeOutputs: {},
      context: [],
      metadata: { ...inputMetadata },
      llm: this.llm,
      vectorDB: this.vectorDB,
      knowledge: this.knowledge,
    };

    const nodeResults: GraphNodeResult[] = [];
    const path: string[] = [];
    const maxIterations = this.config.maxIterations ?? 50;
    let iterations = 0;

    const startNode = this.findStartNode();
    let currentNodeId: string | undefined = startNode;

    while (currentNodeId !== undefined && iterations < maxIterations) {
      iterations++;
      const node = this.nodes.get(currentNodeId);
      if (!node) throw new Error(`Node "${currentNodeId}" not found`);

      path.push(currentNodeId);

      if (node.type === 'end') {
        break;
      }

      const nodeStart = Date.now();

      try {
        if (node.type === 'parallel' && node.parallelNodes) {
          ctx = await this.executeParallel(node.parallelNodes, ctx);
          nodeResults.push({
            nodeId: currentNodeId,
            type: 'parallel',
            output: `Executed ${node.parallelNodes.length} nodes in parallel`,
            latencyMs: Date.now() - nodeStart,
          });
        } else if (node.type === 'action' && node.execute) {
          ctx = await node.execute(ctx);
          ctx.nodeOutputs[currentNodeId] = ctx.output;
          nodeResults.push({
            nodeId: currentNodeId,
            type: 'action',
            output: ctx.output,
            latencyMs: Date.now() - nodeStart,
          });
        } else if (node.type === 'condition' && node.condition) {
          const branch = node.condition(ctx);
          nodeResults.push({
            nodeId: currentNodeId,
            type: 'condition',
            output: `Branch: ${branch}`,
            latencyMs: Date.now() - nodeStart,
            metadata: { branch },
          });

          const condEdges: Array<{ to: string; label?: string }> = this.adjacency.get(currentNodeId) ?? [];
          const matchedEdge: { to: string; label?: string } | undefined = condEdges.find((e: { to: string; label?: string }) => e.label === branch);
          if (matchedEdge) {
            currentNodeId = matchedEdge.to;
            if (this.config.onNodeComplete) {
              this.config.onNodeComplete(node.id, ctx);
            }
            continue;
          }
        } else if (node.type === 'start') {
          nodeResults.push({
            nodeId: currentNodeId,
            type: 'start',
            output: inputStr,
            latencyMs: Date.now() - nodeStart,
          });
        }

        if (this.config.onNodeComplete) {
          this.config.onNodeComplete(node.id, ctx);
        }
      } catch (error) {
        if (this.config.onError) {
          this.config.onError(error as Error, currentNodeId);
        }
        throw new Error(`Graph node "${currentNodeId}" failed: ${(error as Error).message}`);
      }

      const nextEdges: Array<{ to: string; label?: string }> = this.adjacency.get(currentNodeId) ?? [];
      if (nextEdges.length === 0) {
        break;
      }
      currentNodeId = nextEdges[0].to;
    }

    if (iterations >= maxIterations) {
      throw new Error(`Graph workflow "${this.config.name}" exceeded max iterations (${maxIterations})`);
    }

    return {
      name: this.config.name,
      input: inputStr,
      output: ctx.output,
      nodeResults,
      path,
      totalLatencyMs: Date.now() - startTime,
      metadata: ctx.metadata,
    };
  }

  private async executeParallel(nodeIds: string[], ctx: GraphContext): Promise<GraphContext> {
    const results = await Promise.all(
      nodeIds.map(async (nodeId) => {
        const node = this.nodes.get(nodeId);
        if (!node || !node.execute) {
          throw new Error(`Parallel node "${nodeId}" not found or has no execute function`);
        }
        const clonedCtx: GraphContext = {
          ...ctx,
          nodeOutputs: { ...ctx.nodeOutputs },
          metadata: { ...ctx.metadata },
        };
        const result = await node.execute(clonedCtx);
        return { nodeId, output: result.output, ctx: result };
      })
    );

    for (const result of results) {
      ctx.nodeOutputs[result.nodeId] = result.output;
    }
    ctx.output = results.map(r => r.output).join('\n\n');

    return ctx;
  }

  private findStartNode(): string {
    const startNode = this.config.nodes.find(n => n.type === 'start');
    if (startNode) return startNode.id;

    const targetNodes = new Set(this.config.edges.map(e => e.to));
    const sourceOnly = this.config.nodes.find(n => !targetNodes.has(n.id));
    if (sourceOnly) return sourceOnly.id;

    return this.config.nodes[0].id;
  }

  private validate(): void {
    for (const edge of this.config.edges) {
      if (!this.nodes.has(edge.from)) {
        throw new Error(`Edge references unknown node "${edge.from}"`);
      }
      if (!this.nodes.has(edge.to)) {
        throw new Error(`Edge references unknown node "${edge.to}"`);
      }
    }
  }

  getNodes(): GraphNode[] {
    return [...this.nodes.values()];
  }

  getEdges(): Array<{ from: string; to: string; label?: string }> {
    const edges: Array<{ from: string; to: string; label?: string }> = [];
    for (const [from, targets] of this.adjacency.entries()) {
      for (const target of targets) {
        edges.push({ from, to: target.to, label: target.label });
      }
    }
    return edges;
  }

  toMermaid(): string {
    let mermaid = 'graph TD\n';
    for (const node of this.nodes.values()) {
      const shape = node.type === 'condition' ? `{${node.id}}` :
                    node.type === 'start' ? `((${node.id}))` :
                    node.type === 'end' ? `((${node.id}))` :
                    `[${node.id}]`;
      mermaid += `  ${node.id}${shape}\n`;
    }
    for (const edge of this.config.edges) {
      const label = edge.label ? `|${edge.label}|` : '';
      mermaid += `  ${edge.from} -->${label} ${edge.to}\n`;
    }
    return mermaid;
  }
}
