// SOURCING: @dagrejs/dagre (layered layout) feeding @xyflow/react (canvas), the
// substrate SPEC-PROACTIVITY-GRAPH-WIRING requires. Verify-first V11: the layout
// is topological-depth layered per the Atlas of Knowledge prerequisite DAG, not
// a force layout, because force hides depth and depth is the one thing this
// graph must show. dagre is layout-only: it returns coordinates, React Flow
// renders and routes. Sources and assumptions are DAG roots so they land on the
// first rank; responses are sinks so they land on the last; watches fall where
// both streams converge (the join, named choice 8). dagre is imported
// dynamically here, so the sentence and card altitudes load no graph bundle
// (PG3 acceptance).

import { MarkerType, type Edge, type Node } from '@xyflow/react';
import type { PgEdgeKind, ProactivityGraph, ProjectedNode } from '@/lib/proactivity/model';

/** The data a proactivity React Flow node carries: the projected node and
 *  whether it is the two-sided convergence (rendered as a marked join). */
export interface ProactivityNodeData extends Record<string, unknown> {
  readonly node: ProjectedNode;
  readonly isJoin: boolean;
}

export type ProactivityRFNode = Node<ProactivityNodeData, 'proactivity'>;
export type ProactivityRFEdge = Edge<{ readonly kind: PgEdgeKind }>;

export interface GraphLayout {
  readonly width: number;
  readonly height: number;
  readonly nodes: ProactivityRFNode[];
  readonly edges: ProactivityRFEdge[];
}

// Node dimensions: every node shares a width; height grows with content. A
// response is a stack of agent-action steps (the git-graph building block), so
// it is as tall as its stack; every other kind is a single commit-entry row.
// elk lays out against these exact dimensions and React Flow renders the nodes
// at them, so positions stay valid as a person stacks steps higher.
export const NODE_WIDTH = 248;
const ROW_HEIGHT = 68;
const RESPONSE_HEADER = 50;
const STEP_HEIGHT = 26;
const RESPONSE_ADD = 30;

/** A response node renders one derived row when it has no authored steps. */
export function responseStepCount(node: ProjectedNode): number {
  return node.kind === 'response' ? Math.max(1, node.steps?.length ?? 0) : 0;
}

function nodeHeight(node: ProjectedNode): number {
  if (node.kind === 'response') return RESPONSE_HEADER + responseStepCount(node) * STEP_HEIGHT + RESPONSE_ADD;
  return ROW_HEIGHT;
}

// Edge paint by kind: the two converging streams are tinted so the join at a
// watch reads as a join, not a pipe (named choice 8). Register tokens only.
const EDGE_STROKE: Record<PgEdgeKind, string> = {
  feeds: 'var(--ij-memory)',
  declares: 'var(--ij-graph)',
  rests_on: 'var(--ij-ink-info)',
  gates: 'var(--ij-room)',
  acts: 'var(--ij-ink-info)',
};

// dagre ranks by topology: the two root families (sources on the fact side,
// assumptions on the stake side) have no inbound edges so they land on the first
// rank; responses have no outbound edges so they land on the last. Everything
// between is assigned by topology, so watches land where both streams converge.
// No explicit layer constraint is needed, which is why dagre carries the intent
// that elk expressed with layerConstraint FIRST/LAST.

/** Which watches are the join: an inbound feed (source) and an inbound declare
 *  (stake) both arrive (named choice 8). */
function joinWatchIds(graph: ProactivityGraph): Set<string> {
  const fed = new Set<string>();
  const declared = new Set<string>();
  for (const edge of graph.edges) {
    if (edge.kind === 'feeds') fed.add(edge.to);
    if (edge.kind === 'declares') declared.add(edge.to);
  }
  return new Set([...fed].filter((id) => declared.has(id)));
}

/**
 * Lay out the graph with dagre's layered ranking and return React Flow nodes and
 * edges. Dynamically imports dagre so the graph bundle is only fetched at the
 * graph altitude.
 */
export async function layoutGraph(graph: ProactivityGraph): Promise<GraphLayout> {
  const { default: Dagre } = await import('@dagrejs/dagre');
  const g = new Dagre.graphlib.Graph();
  // rankdir LR: the fact side ranks on the left, responses on the right. ranksep
  // and nodesep carry elk's between-layer (96) and within-layer (28) spacing.
  g.setGraph({ rankdir: 'LR', nodesep: 28, ranksep: 96, ranker: 'network-simplex' });
  g.setDefaultEdgeLabel(() => ({}));

  const joins = joinWatchIds(graph);

  for (const node of graph.nodes) {
    g.setNode(node.id, { width: NODE_WIDTH, height: nodeHeight(node) });
  }
  for (const edge of graph.edges) {
    g.setEdge(edge.from, edge.to);
  }

  Dagre.layout(g);

  const nodes: ProactivityRFNode[] = graph.nodes.map((node) => {
    const height = nodeHeight(node);
    const laid = g.node(node.id);
    // dagre reports node centers; React Flow positions by the top-left corner.
    const position =
      laid && typeof laid.x === 'number' && typeof laid.y === 'number'
        ? { x: laid.x - NODE_WIDTH / 2, y: laid.y - height / 2 }
        : { x: 0, y: 0 };
    return {
      id: node.id,
      type: 'proactivity',
      position,
      data: { node, isJoin: node.kind === 'watch' && joins.has(node.id) },
      width: NODE_WIDTH,
      height,
      draggable: false,
      connectable: false,
      deletable: false,
    };
  });

  const edges: ProactivityRFEdge[] = graph.edges.map((edge) => {
    const stroke = EDGE_STROKE[edge.kind];
    const strong = edge.kind === 'feeds' || edge.kind === 'declares';
    return {
      id: edge.id,
      source: edge.from,
      target: edge.to,
      type: 'smoothstep',
      data: { kind: edge.kind },
      style: { stroke, strokeWidth: strong ? 2 : 1.5 },
      markerEnd: { type: MarkerType.ArrowClosed, color: stroke, width: 16, height: 16 },
      selectable: false,
      focusable: false,
      deletable: false,
    };
  });

  const laidGraph = g.graph();
  return { width: laidGraph.width ?? 0, height: laidGraph.height ?? 0, nodes, edges };
}
