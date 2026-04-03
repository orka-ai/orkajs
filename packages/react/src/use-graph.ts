import { useMemo } from 'react';
import type { Node, Edge } from '@xyflow/react';
import type { OrkaGraphProps, OrkaGraphExecution } from './types.js';

const NODE_STATUS_COLORS = {
  running: '#3b82f6',
  completed: '#10b981',
  failed: '#ef4444',
  pending: '#64748b',
};

const NODE_TYPE_SHAPES: Record<string, string> = {
  start: '#1d4ed8',
  end: '#059669',
  condition: '#d97706',
  default: '#334155',
};

function getNodeStatus(
  id: string,
  execution?: OrkaGraphExecution,
): 'running' | 'completed' | 'failed' | 'pending' {
  if (execution?.currentNode === id) return 'running';
  if (execution?.completedNodes?.includes(id)) return 'completed';
  if (execution?.failedNodes?.includes(id)) return 'failed';
  return 'pending';
}

/**
 * Converts OrkaJS workflow nodes/edges to React Flow format.
 * Applies a simple left-to-right auto-layout.
 */
export function useGraph(
  workflow: OrkaGraphProps['workflow'],
  execution?: OrkaGraphExecution,
  theme: 'light' | 'dark' = 'dark',
): { nodes: Node[]; edges: Edge[] } {
  return useMemo(() => {
    const rawNodes = workflow.getNodes();
    const rawEdges = workflow.getEdges();

    // Simple auto-layout: rank nodes by graph depth (BFS from sources)
    const indegree = new Map<string, number>();
    const adjList = new Map<string, string[]>();
    for (const n of rawNodes) {
      indegree.set(n.id, 0);
      adjList.set(n.id, []);
    }
    for (const e of rawEdges) {
      indegree.set(e.to, (indegree.get(e.to) ?? 0) + 1);
      adjList.get(e.from)?.push(e.to);
    }

    // Topological BFS for layer assignment
    const layers = new Map<string, number>();
    const queue: string[] = [];
    for (const [id, deg] of indegree.entries()) {
      if (deg === 0) queue.push(id);
    }
    let head = 0;
    while (head < queue.length) {
      const id = queue[head++];
      const layer = layers.get(id) ?? 0;
      for (const next of adjList.get(id) ?? []) {
        layers.set(next, Math.max(layers.get(next) ?? 0, layer + 1));
        indegree.set(next, (indegree.get(next) ?? 1) - 1);
        if ((indegree.get(next) ?? 0) <= 0) queue.push(next);
      }
    }

    // Position nodes by layer
    const layerCounts = new Map<number, number>();
    const nodePositions = new Map<string, { x: number; y: number }>();
    const H_GAP = 200;
    const V_GAP = 100;

    for (const n of rawNodes) {
      const layer = layers.get(n.id) ?? 0;
      const row = layerCounts.get(layer) ?? 0;
      nodePositions.set(n.id, { x: layer * H_GAP, y: row * V_GAP });
      layerCounts.set(layer, row + 1);
    }

    const isDark = theme === 'dark';
    const bg = isDark ? '#1e293b' : '#f8fafc';
    const textColor = isDark ? '#e2e8f0' : '#0f172a';
    const borderColor = isDark ? '#334155' : '#cbd5e1';

    const nodes: Node[] = rawNodes.map(n => {
      const status = getNodeStatus(n.id, execution);
      const statusColor = NODE_STATUS_COLORS[status];
      const typeColor = NODE_TYPE_SHAPES[n.type ?? 'default'] ?? NODE_TYPE_SHAPES.default;
      const pos = nodePositions.get(n.id) ?? { x: 0, y: 0 };

      return {
        id: n.id,
        position: pos,
        type: 'default',
        data: { label: n.id, metadata: n },
        style: {
          background: bg,
          border: `2px solid ${status !== 'pending' ? statusColor : (typeColor ?? borderColor)}`,
          borderRadius: n.type === 'condition' ? '4px' : '8px',
          color: textColor,
          fontSize: '13px',
          padding: '8px 12px',
          minWidth: '80px',
          textAlign: 'center',
          boxShadow: status === 'running' ? `0 0 12px ${statusColor}66` : undefined,
        },
      };
    });

    const edgeColor = isDark ? '#475569' : '#94a3b8';
    const edges: Edge[] = rawEdges.map((e, i) => ({
      id: `e-${e.from}-${e.to}-${i}`,
      source: e.from,
      target: e.to,
      label: e.label,
      style: { stroke: edgeColor },
      labelStyle: { fill: edgeColor, fontSize: '11px' },
    }));

    return { nodes, edges };
  }, [workflow, execution, theme]);
}
