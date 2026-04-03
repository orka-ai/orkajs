import { useCallback } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  type NodeMouseHandler,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { useGraph } from './use-graph.js';
import type { OrkaGraphProps } from './types.js';

/**
 * Visual graph component for OrkaJS workflows.
 *
 * Renders a GraphWorkflow or StateGraph as an interactive React Flow diagram.
 * Highlights currently running, completed, and failed nodes based on the
 * optional `execution` prop.
 *
 * @example
 * ```tsx
 * import { OrkaGraph } from '@orka-js/react';
 *
 * function App() {
 *   return (
 *     <OrkaGraph
 *       workflow={myGraphWorkflow}
 *       execution={{ currentNode: 'step2', completedNodes: ['step1'] }}
 *       height={500}
 *     />
 *   );
 * }
 * ```
 */
export function OrkaGraph({
  workflow,
  execution,
  onNodeClick,
  theme = 'dark',
  width = '100%',
  height = 500,
  className,
}: OrkaGraphProps) {
  const { nodes, edges } = useGraph(workflow, execution, theme);

  const handleNodeClick = useCallback<NodeMouseHandler>(
    (_event, node) => {
      onNodeClick?.(node.id, node.data?.metadata);
    },
    [onNodeClick],
  );

  const bgColor = theme === 'dark' ? '#0f1117' : '#f8fafc';
  const dotColor = theme === 'dark' ? '#1e293b' : '#e2e8f0';

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
