export interface OrkaGraphExecution {
  /** Currently executing node ID */
  currentNode?: string;
  /** IDs of completed nodes */
  completedNodes?: string[];
  /** IDs of nodes that failed */
  failedNodes?: string[];
}

export interface OrkaGraphProps {
  /**
   * The workflow to visualize.
   * Accepts GraphWorkflow or StateGraph instances from @orka-js/graph.
   */
  workflow: {
    getNodes(): Array<{ id: string; type?: string; [key: string]: unknown }>;
    getEdges(): Array<{ from: string; to: string; label?: string }>;
  };
  /** Live execution state for highlighting */
  execution?: OrkaGraphExecution;
  /** Called when user clicks a node */
  onNodeClick?: (nodeId: string, metadata?: unknown) => void;
  theme?: 'light' | 'dark';
  width?: number | string;
  height?: number | string;
  /** Custom CSS class name */
  className?: string;
}
