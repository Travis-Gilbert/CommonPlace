// SOURCING: @dagrejs/dagre layered layout feeding @xyflow/react canvas coordinates.

import type { Edge, Node } from '@xyflow/react';
import { Graph, layout } from '@dagrejs/dagre';
import type { Enforcement, ObservedField } from '@commonplace/data-model-contracts';
import type { ModelSelection } from '../modelQuery';
import type { ObjectTint } from './tints';

export const OBJECT_NODE_WIDTH = 256;
export const OBJECT_NODE_HEIGHT = 160;
export const GHOST_NODE_HEIGHT = 120;

export interface ObjectTypeRelationRow {
  readonly id: string;
  readonly key: string;
  readonly label: string;
  readonly targetLabel: string;
  readonly targetTint: ObjectTint;
}

export interface ObjectTypeScalarField {
  readonly id: string;
  readonly key: string;
  readonly label: string;
  readonly fieldTypeLabel: string;
  readonly required: boolean;
  readonly fieldType: import('@commonplace/data-model-contracts').FieldType;
}

export interface ObjectTypeCardData extends Record<string, unknown> {
  readonly id: string;
  readonly label: string;
  readonly recordCount?: number;
  readonly enforcement: Enforcement;
  readonly system: boolean;
  readonly tint: ObjectTint;
  readonly icon?: string;
  readonly relations: readonly ObjectTypeRelationRow[];
  readonly scalarFields: readonly ObjectTypeScalarField[];
  readonly divergenceCount: number;
  readonly divergenceSignalIds: readonly string[];
  readonly expandedFields: boolean;
  readonly isSelected: boolean;
  readonly onSelect: (selection: ModelSelection) => void;
  readonly onOpenDivergences: () => void;
  readonly onToggleFields: () => void;
}

export interface GhostCardData extends Record<string, unknown> {
  readonly observedKey: string;
  readonly label: string;
  readonly coverage: number;
  readonly occurrences: number;
  readonly fields: readonly ObservedField[];
  readonly pinned: boolean;
  readonly pendingPin: boolean;
  readonly onSelect: (selection: ModelSelection) => void;
  readonly onPin: () => void;
}

export interface ModelRelationEdgeData extends Record<string, unknown> {
  readonly label: string;
  readonly cardinalityLabel?: string;
  readonly coverage?: number;
  readonly occurrences?: number;
}

export type ObjectTypeFlowNode = Node<ObjectTypeCardData, 'objectType'>;
export type GhostFlowNode = Node<GhostCardData, 'ghost'>;

export type ModelFlowNode = ObjectTypeFlowNode | GhostFlowNode;

export type ModelFlowEdge = Edge<ModelRelationEdgeData, 'relation'>;

export type LayoutDirection = 'LR' | 'TB';

export interface LayoutPositions {
  readonly [nodeId: string]: { readonly x: number; readonly y: number };
}

function nodeDimensions(node: ModelFlowNode): { width: number; height: number } {
  if (node.type === 'ghost') {
    return { width: OBJECT_NODE_WIDTH, height: GHOST_NODE_HEIGHT };
  }
  const expanded = node.data.expandedFields;
  const relationRows = node.data.relations.length;
  const fieldRows = expanded ? node.data.scalarFields.length : 0;
  const height = 72 + relationRows * 24 + fieldRows * 22 + (expanded ? 24 : 20);
  return {
    width: OBJECT_NODE_WIDTH,
    height: Math.max(OBJECT_NODE_HEIGHT, Math.min(height, 320)),
  };
}

/** Layer declared and ghost nodes with dagre, merging saved drag positions. */
export function layoutModelGraph(
  nodes: readonly ModelFlowNode[],
  edges: readonly ModelFlowEdge[],
  positions: LayoutPositions = {},
  direction: LayoutDirection = 'LR',
): ModelFlowNode[] {
  if (nodes.length === 0) return [];

  const graph = new Graph()
    .setGraph({
      rankdir: direction,
      nodesep: 28,
      edgesep: 12,
      ranksep: direction === 'LR' ? 72 : 56,
      marginx: 24,
      marginy: 24,
    })
    .setDefaultEdgeLabel(() => ({}));

  nodes.forEach((node) => {
    const size = nodeDimensions(node);
    graph.setNode(node.id, size);
  });
  edges.forEach((edge) => graph.setEdge(edge.source, edge.target));
  layout(graph);

  return nodes.map((node) => {
    const saved = positions[node.id];
    if (saved) {
      return { ...node, position: saved };
    }
    const size = nodeDimensions(node);
    const placed = graph.node(node.id);
    return {
      ...node,
      position: {
        x: (placed?.x ?? size.width / 2) - size.width / 2,
        y: (placed?.y ?? size.height / 2) - size.height / 2,
      },
    };
  });
}
