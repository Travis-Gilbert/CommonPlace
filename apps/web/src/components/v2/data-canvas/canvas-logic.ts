// Pure logic for the data-model canvas: converts TypeDef[] into
// XYFlow nodes + edges with dagre auto-layout. Applies dagre only
// to nodes not already present in `existingPositions`.

import { graphlib, layout } from '@dagrejs/dagre';
import type { Edge, Node } from '@xyflow/react';
import type { TypeDef } from '@/lib/block-view/types';
import type { TypeNodeData } from './TypeNode';
import type { RelationEdgeData } from './RelationEdge';

const NODE_W = 240;
const NODE_H = 60; // base, +36 per field
const FIELD_H = 36;

function nodeHeight(fieldCount: number): number {
  return NODE_H + fieldCount * FIELD_H + 32; // 32 for add-btn row
}

export interface CanvasResult {
  nodes: Node<TypeNodeData>[];
  edges: Edge<RelationEdgeData>[];
}

export type PositionMap = Readonly<Record<string, { x: number; y: number }>>;

/**
 * Derive XYFlow nodes and edges from TypeDef array.
 * Existing positions (from user drag) are preserved for already-placed nodes.
 * New nodes get dagre-auto-laid positions relative to the subgraph.
 */
export function deriveCanvas(
  types: readonly TypeDef[],
  existingPositions: PositionMap = {},
): CanvasResult {
  const positionedIds = new Set(Object.keys(existingPositions));

  // Split: nodes with preserved positions vs new nodes to lay out
  const presetNodes: Node<TypeNodeData>[] = [];
  const virginNodes: Node<TypeNodeData>[] = [];

  for (const t of types) {
    const pos = existingPositions[t.name];
    const node: Node<TypeNodeData> = {
      id: t.name,
      type: 'typeNode',
      position: pos ? { ...pos } : { x: 0, y: 0 },
      data: {
        label: t.name,
        typeId: t.name,
        fields: t.properties,
      },
      style: { width: NODE_W },
    };

    if (pos) {
      presetNodes.push(node);
    } else {
      virginNodes.push(node);
    }
  }

  // Build edges from relation definitions
  const edges: Edge<RelationEdgeData>[] = [];
  for (const t of types) {
    for (const r of t.relations) {
      const targetType = r.target;
      if (types.some((tt) => tt.name === targetType)) {
        edges.push({
          id: `${t.name}-${r.edge}-${targetType}`,
          source: t.name,
          target: targetType,
          type: 'relation',
          data: {
            label: r.edge,
            targetType,
            dir: r.dir,
          },
          animated: false,
        });
      }
    }
  }

  // Auto-layout only the virgin nodes with dagre. Preset nodes act as
  // anchors (layoutGraph ignores them for position assignment).
  if (virginNodes.length > 0) {
    layoutGraph(virginNodes, presetNodes, edges);
  }

  return { nodes: [...presetNodes, ...virginNodes], edges };
}

function layoutGraph(
  regularNodes: Node[],
  presetNodes: Node[],
  edges: Edge[],
): void {
  const g = new graphlib.Graph();
  g.setGraph({ rankdir: 'LR', nodesep: 60, edgesep: 30, ranksep: 100 });
  g.setDefaultEdgeLabel(() => ({}));

  const allIds = new Set<string>();

  for (const n of regularNodes) {
    const h = nodeHeight(
      ((n.data as unknown) as TypeNodeData).fields?.length ?? 0,
    );
    g.setNode(n.id, { width: NODE_W, height: h });
    allIds.add(n.id);
  }

  // Preset anchor nodes: include in graph topology but dagre will assign
  // positions — we'll override back to their preset positions after layout.
  const presetIds = new Set<string>();
  for (const n of presetNodes) {
    const h = nodeHeight(
      ((n.data as unknown) as TypeNodeData).fields?.length ?? 0,
    );
    g.setNode(n.id, { width: NODE_W, height: h });
    allIds.add(n.id);
    presetIds.add(n.id);
  }

  for (const e of edges) {
    // Include edge if both ends are in our topology
    if (allIds.has(e.source) && allIds.has(e.target)) {
      g.setEdge(e.source, e.target);
    }
  }

  layout(g);

  // Apply dagre positions only to non-preset nodes
  for (const n of regularNodes) {
    const pos = g.node(n.id);
    if (pos) {
      const d = n.data as unknown as TypeNodeData;
      n.position = {
        x: pos.x - NODE_W / 2,
        y: pos.y - nodeHeight(d.fields?.length ?? 0) / 2,
      };
    }
  }
  // Do NOT overwrite preset node positions — they keep their stored position
}

// ── Helper: flatten TypeDefs to field-level mapping ──

export interface FieldRef {
  typeId: string;
  field: string;
  propType: string;
}

/** Map each field across all types to its owning type + prop type. */
export function buildFieldIndex(types: readonly TypeDef[]): FieldRef[] {
  const refs: FieldRef[] = [];
  for (const t of types) {
    for (const p of t.properties) {
      refs.push({ typeId: t.name, field: p.name, propType: p.type });
    }
  }
  return refs;
}
