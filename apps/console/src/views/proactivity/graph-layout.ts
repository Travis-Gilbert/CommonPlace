// SOURCING: elkjs (layered layout) feeding @xyflow/react (canvas). Verify-first
// V11: the layout is topological-depth layered per the Atlas of Knowledge
// prerequisite DAG, not a force layout, because force hides depth and depth is
// the one thing this graph must show. elk is layout-only: it returns
// coordinates, React Flow renders and routes. Sources and assumptions pin to
// the first layer, responses to the last, so watches land where both streams
// converge (the join, named choice 8). elk is imported dynamically here, so the
// sentence and card altitudes load with no graph bundle (PG3 acceptance).

import { MarkerType, type Edge, type Node } from '@xyflow/react';
import type { PgEdgeKind, PgNodeKind, ProactivityGraph, ProjectedNode } from '@/lib/proactivity/model';

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

// The two root families pin to the first layer (sources on the fact side,
// assumptions on the stake side); responses pin to the last. Everything between
// is assigned by topology, so watches land where both streams converge.
function layerConstraint(kind: PgNodeKind): string | undefined {
  if (kind === 'source' || kind === 'assumption') return 'FIRST';
  if (kind === 'response') return 'LAST';
  return undefined;
}

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
 * Lay out the graph with elk's layered algorithm and return React Flow nodes and
 * edges. Dynamically imports elkjs so the graph bundle is only fetched at the
 * graph altitude.
 */
export async function layoutGraph(graph: ProactivityGraph): Promise<GraphLayout> {
  const { default: ELK } = await import('elkjs/lib/elk.bundled.js');
  const elk = new ELK();

  const joins = joinWatchIds(graph);

  const children = graph.nodes.map((node) => {
    const constraint = layerConstraint(node.kind);
    return {
      id: node.id,
      width: NODE_WIDTH,
      height: nodeHeight(node),
      ...(constraint ? { layoutOptions: { 'elk.layered.layering.layerConstraint': constraint } } : {}),
    };
  });

  const elkEdges = graph.edges.map((edge) => ({ id: edge.id, sources: [edge.from], targets: [edge.to] }));

  const laid = await elk.layout({
    id: 'proactivity',
    layoutOptions: {
      'elk.algorithm': 'layered',
      'elk.direction': 'RIGHT',
      'elk.spacing.nodeNode': '28',
      'elk.layered.spacing.nodeNodeBetweenLayers': '96',
      'elk.layered.considerModelOrder.strategy': 'NODES_AND_EDGES',
      'elk.layered.nodePlacement.strategy': 'NETWORK_SIMPLEX',
    },
    children,
    edges: elkEdges,
  });

  const positionById = new Map((laid.children ?? []).map((child) => [child.id, { x: child.x ?? 0, y: child.y ?? 0 }]));

  const nodes: ProactivityRFNode[] = graph.nodes.map((node) => ({
    id: node.id,
    type: 'proactivity',
    position: positionById.get(node.id) ?? { x: 0, y: 0 },
    data: { node, isJoin: node.kind === 'watch' && joins.has(node.id) },
    width: NODE_WIDTH,
    height: nodeHeight(node),
    draggable: false,
    connectable: false,
    deletable: false,
  }));

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

  return { width: laid.width ?? 0, height: laid.height ?? 0, nodes, edges };
}
