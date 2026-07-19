// SOURCING: @dagrejs/dagre (ranked directed layout) and @xyflow/react (graph
// data contract). The proactivity graph is a deterministic dependency map,
// never a force simulation.

import dagre from '@dagrejs/dagre';
import type { Edge, Node } from '@xyflow/react';
import type { ProactivityGraph, ProactivityGraphNode } from './types';

const NODE_WIDTH = 224;
const NODE_HEIGHT = 92;

export interface ProactivityFlowNodeData extends Record<string, unknown> {
  readonly node: ProactivityGraphNode;
}

export type ProactivityFlowNode = Node<ProactivityFlowNodeData, 'proactivity'>;

export function layoutProactivityGraph(graph: ProactivityGraph): {
  readonly nodes: ProactivityFlowNode[];
  readonly edges: Edge[];
} {
  const layout = new dagre.graphlib.Graph();
  layout.setDefaultEdgeLabel(() => ({}));
  layout.setGraph({ rankdir: 'LR', ranksep: 72, nodesep: 28, marginx: 24, marginy: 24 });
  for (const node of graph.nodes) layout.setNode(node.id, { width: NODE_WIDTH, height: NODE_HEIGHT });
  for (const edge of graph.edges) layout.setEdge(edge.from, edge.to, { id: edge.id });
  dagre.layout(layout);
  return {
    nodes: graph.nodes.map((node) => {
      const position = layout.node(node.id) as { x: number; y: number };
      return {
        id: node.id,
        type: 'proactivity',
        position: { x: position.x - NODE_WIDTH / 2, y: position.y - NODE_HEIGHT / 2 },
        data: { node },
        draggable: false,
        selectable: true,
        style: { width: NODE_WIDTH, height: NODE_HEIGHT },
      };
    }),
    edges: graph.edges.map((edge) => ({
      id: edge.id,
      source: edge.from,
      target: edge.to,
      label: edge.kind.replaceAll('_', ' '),
      type: 'smoothstep',
      animated: false,
      focusable: true,
      style: { stroke: 'var(--ij-divider)' },
      labelStyle: { fill: 'var(--ij-ink-info)', fontFamily: 'var(--ij-font-mono)', fontSize: 11 },
    })),
  };
}
