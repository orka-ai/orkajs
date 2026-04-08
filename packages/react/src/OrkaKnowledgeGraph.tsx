import { useCallback } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  type NodeMouseHandler,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { useKnowledgeGraph } from './use-knowledge-graph.js';
import type { OrkaKnowledgeGraphProps } from './types.js';

/**
 * Visual Knowledge Graph component for OrkaJS.
 *
 * Renders the entities and relations extracted by KGMemory (from @orka-js/memory-store)
 * as an interactive React Flow diagram. Nodes are colored by entity type; edges show
 * the relation predicate as a label.
 *
 * Accepts either a live KGMemory instance (re-renders on each `refresh`) or
 * raw `entities` + `relations` arrays for static display.
 *
 * @example
 * ```tsx
 * import { OrkaKnowledgeGraph } from '@orka-js/react';
 *
 * // With a live KGMemory instance
 * function App() {
 *   return (
 *     <OrkaKnowledgeGraph
 *       memory={kgMemory}
 *       height={500}
 *       theme="dark"
 *       onNodeClick={(id, entity) => console.log(entity)}
 *     />
 *   );
 * }
 *
 * // With raw data
 * function App() {
 *   return (
 *     <OrkaKnowledgeGraph
 *       entities={[{ name: 'Alice', type: 'PERSON' }]}
 *       relations={[{ subject: 'Alice', predicate: 'works at', object: 'Acme Corp' }]}
 *       height={500}
 *     />
 *   );
 * }
 * ```
 */
export function OrkaKnowledgeGraph({
  memory,
  entities: entitiesProp,
  relations: relationsProp,
  onNodeClick,
  theme = 'dark',
  width = '100%',
  height = 500,
  className,
  refreshKey,
}: OrkaKnowledgeGraphProps) {
  const { nodes, edges } = useKnowledgeGraph(
    memory,
    entitiesProp,
    relationsProp,
    theme,
    refreshKey,
  );

  const handleNodeClick = useCallback<NodeMouseHandler>(
    (_event, node) => {
      onNodeClick?.(node.id, node.data?.entity as Record<string, unknown>);
    },
    [onNodeClick],
  );

  const bgColor = theme === 'dark' ? '#0f1117' : '#f8fafc';
  const dotColor = theme === 'dark' ? '#1e293b' : '#e2e8f0';

  if (nodes.length === 0) {
    return (
      <div
        className={className}
        style={{
          width,
          height,
          background: bgColor,
          borderRadius: '8px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: theme === 'dark' ? '#475569' : '#94a3b8',
          fontSize: '14px',
          fontFamily: 'sans-serif',
        }}
      >
        No knowledge graph data yet. Start a conversation to build it.
      </div>
    );
  }

  return (
    <div
      className={className}
      style={{ width, height, background: bgColor, borderRadius: '8px', overflow: 'hidden' }}
    >
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodeClick={handleNodeClick}
        fitView
        fitViewOptions={{ padding: 0.3 }}
        colorMode={theme}
        proOptions={{ hideAttribution: true }}
      >
        <Background color={dotColor} gap={20} />
        <Controls />
        <MiniMap
          nodeColor={(node) => (node.style?.borderColor as string) ?? '#475569'}
          style={{ background: theme === 'dark' ? '#0a0e1a' : '#f1f5f9' }}
        />
      </ReactFlow>
    </div>
  );
}
