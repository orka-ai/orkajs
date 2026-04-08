// ─── Knowledge Graph types ───────────────────────────────────────────────────

/**
 * Minimal interface for entity objects (compatible with @orka-js/memory-store Entity).
 */
export interface KGEntity {
  name: string;
  type: string;
  attributes?: Record<string, unknown>;
}

/**
 * Minimal interface for relation objects (compatible with @orka-js/memory-store Relation).
 */
export interface KGRelation {
  subject: string;
  predicate: string;
  object: string;
  metadata?: Record<string, unknown>;
}

/**
 * Minimal interface satisfied by KGMemory from @orka-js/memory-store.
 * Declared here so @orka-js/react does not depend on memory-store at runtime.
 */
export interface KGMemoryLike {
  getEntities(): KGEntity[];
  getRelations(): KGRelation[];
}

export interface OrkaKnowledgeGraphProps {
  /**
   * A live KGMemory instance from @orka-js/memory-store.
   * The graph re-renders whenever `refreshKey` changes.
   */
  memory?: KGMemoryLike;

  /** Raw entities — used when `memory` is not provided. */
  entities?: KGEntity[];

  /** Raw relations — used when `memory` is not provided. */
  relations?: KGRelation[];

  /** Increment to force a re-render when using a live `memory` instance. */
  refreshKey?: number | string;

  /** Called when the user clicks an entity node. */
  onNodeClick?: (entityName: string, entity: Record<string, unknown>) => void;

  theme?: 'light' | 'dark';
  width?: number | string;
  height?: number | string;
  className?: string;
}

// ─── Graph Workflow types ─────────────────────────────────────────────────────

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
