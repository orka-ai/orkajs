import { useMemo } from 'react';
import type { Node, Edge } from '@xyflow/react';
import type { KGMemoryLike, KGEntity, KGRelation } from './types.js';

/**
 * Colors per entity type — consistent across renders.
 * Extend this map to add custom entity type colors.
 */
const ENTITY_TYPE_COLORS: Record<string, string> = {
  PERSON:       '#3b82f6', // blue
  ORGANIZATION: '#8b5cf6', // violet
  LOCATION:     '#10b981', // emerald
  CONCEPT:      '#f59e0b', // amber
  PRODUCT:      '#ec4899', // pink
  EVENT:        '#06b6d4', // cyan
  OTHER:        '#64748b', // slate
};

function getEntityColor(type: string): string {
  return ENTITY_TYPE_COLORS[type?.toUpperCase()] ?? ENTITY_TYPE_COLORS.OTHER;
}

/**
 * Converts KGMemory entities + relations into React Flow nodes + edges.
 *
 * Layout: force-grid by entity type — entities of the same type are
 * grouped in columns, with a simple row-based offset.
 */
export function useKnowledgeGraph(
  memory: KGMemoryLike | undefined,
  entitiesProp: KGEntity[] | undefined,
  relationsProp: KGRelation[] | undefined,
  theme: 'light' | 'dark' = 'dark',
  refreshKey?: number | string,
): { nodes: Node[]; edges: Edge[] } {
  return useMemo(() => {
    // Resolve source: live KGMemory or raw props
    const entities: KGEntity[] = memory ? memory.getEntities() : (entitiesProp ?? []);
    const relations: KGRelation[] = memory ? memory.getRelations() : (relationsProp ?? []);

    if (entities.length === 0) return { nodes: [], edges: [] };

    const isDark = theme === 'dark';
    const bg = isDark ? '#1e293b' : '#f8fafc';
    const textColor = isDark ? '#e2e8f0' : '#0f172a';

    // Group entities by type for layout
    const typeGroups = new Map<string, KGEntity[]>();
    for (const entity of entities) {
      const t = (entity.type ?? 'OTHER').toUpperCase();
      if (!typeGroups.has(t)) typeGroups.set(t, []);
      typeGroups.get(t)!.push(entity);
    }

    const H_GAP = 220;
    const V_GAP = 90;
    const nodePositions = new Map<string, { x: number; y: number }>();

    let col = 0;
    for (const [, group] of typeGroups) {
      group.forEach((entity, row) => {
        nodePositions.set(entity.name.toLowerCase(), {
          x: col * H_GAP,
          y: row * V_GAP,
        });
      });
      col++;
    }

    const nodes: Node[] = entities.map((entity) => {
      const color = getEntityColor(entity.type);
      const pos = nodePositions.get(entity.name.toLowerCase()) ?? { x: 0, y: 0 };

      return {
        id: entity.name.toLowerCase(),
        position: pos,
        type: 'default',
        data: {
          label: entity.name,
          entity,
        },
        style: {
          background: bg,
          border: `2px solid ${color}`,
          borderRadius: '8px',
          color: textColor,
          fontSize: '12px',
          padding: '6px 10px',
          minWidth: '90px',
          textAlign: 'center' as const,
        },
      };
    });

    const edgeColor = isDark ? '#475569' : '#94a3b8';
    const edges: Edge[] = relations
      .filter((r) =>
        nodePositions.has(r.subject.toLowerCase()) &&
        nodePositions.has(r.object.toLowerCase()),
      )
      .map((relation, i) => ({
        id: `kg-${relation.subject}-${relation.predicate}-${relation.object}-${i}`,
        source: relation.subject.toLowerCase(),
        target: relation.object.toLowerCase(),
        label: relation.predicate,
        style: { stroke: edgeColor },
        labelStyle: { fill: edgeColor, fontSize: '11px' },
        type: 'default',
        animated: false,
      }));

    return { nodes, edges };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [memory, entitiesProp, relationsProp, theme, refreshKey]);
}
