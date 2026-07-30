// SOURCING: @dagrejs/dagre for program canvas initial layout (PG11).

import { Graph, layout as dagreLayout } from '@dagrejs/dagre';
import type { Edge, Node } from '@xyflow/react';

export type ProgramLayoutPositions = Readonly<Record<string, { readonly x: number; readonly y: number }>>;

export function layoutProgramGraph(
  nodes: readonly Node[],
  edges: readonly Edge[],
  positions: ProgramLayoutPositions = {},
): Node[] {
  if (nodes.length === 0) return [];
  const graph = new Graph()
    .setGraph({ rankdir: 'LR', nodesep: 36, ranksep: 72, marginx: 24, marginy: 24 })
    .setDefaultEdgeLabel(() => ({}));
  for (const node of nodes) {
    graph.setNode(node.id, { width: 180, height: 88 });
  }
  for (const edge of edges) {
    graph.setEdge(edge.source, edge.target);
  }
  dagreLayout(graph);
  return nodes.map((node) => {
    const saved = positions[node.id];
    if (saved) return { ...node, position: saved };
    const placed = graph.node(node.id);
    return {
      ...node,
      position: {
        x: (placed?.x ?? 0) - 90,
        y: (placed?.y ?? 0) - 44,
      },
    };
  });
}
