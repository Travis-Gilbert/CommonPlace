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

import { type Edge, type Node } from '@xyflow/react';
import type { PgEdgeKind, ProactivityGraph, ProjectedNode } from '@/lib/proactivity/model';
import { laneOf, mergeWatchIds } from './commits';
import { laneColor, type Commit } from '@/components/commit-graph';

/** The data a proactivity React Flow node carries: the projected node and
 *  whether it is the two-sided convergence (rendered as a true merge commit,
 *  two rails converging). */
export interface ProactivityNodeData extends Record<string, unknown> {
  readonly node: ProjectedNode;
  readonly isJoin: boolean;
}

export type ProactivityRFNode = Node<ProactivityNodeData, 'proactivity'>;
export type ProactivityRFEdge = Edge<{ readonly kind: PgEdgeKind }>;

/** A PG5 candidate: compiled, reviewed, not yet committed. It carries a commit
 *  and nothing else, because it has no projection behind it yet. */
export interface CandidateNodeData extends Record<string, unknown> {
  readonly commit: Commit;
  readonly kindLabel: string;
}

export type CandidateRFNode = Node<CandidateNodeData, 'candidate'>;

/** What the canvas renders: the committed program, plus whatever is staged
 *  ahead of it. */
export type CanvasNode = ProactivityRFNode | CandidateRFNode;

export interface GraphLayout {
  readonly width: number;
  readonly height: number;
  readonly nodes: ProactivityRFNode[];
  readonly edges: ProactivityRFEdge[];
}

// Node dimensions: every node shares a width; height grows with content. A
// node is a commit row (adopted from the jalco commit-graph), so the width is
// what a row needs to carry its slots without truncating the message into
// uselessness: refs, the message, then the machinery run (short id, author,
// time). A response is additionally a stack of agent-action steps, so it is as
// tall as its stack. dagre lays out against these exact dimensions and React
// Flow renders at them, so positions stay valid as a person stacks steps.
export const NODE_WIDTH = 420;
// A commit here is two lines: the decorations (kind, merge, refs, tag, spend)
// and then the message with its machinery run. The decoration line wraps on a
// response, which carries the most of them, so a response's header is taller.
const ROW_HEIGHT = 72;
const RESPONSE_HEADER = 100;
const STEP_HEIGHT = 26;
const RESPONSE_ADD = 30;
/** An execution commit is history, and carries no stack: one row, always. */
const EXECUTION_HEIGHT = 62;

/** A response node renders one derived row when it has no authored steps. */
export function responseStepCount(node: ProjectedNode): number {
  return node.kind === 'response' ? Math.max(1, node.steps?.length ?? 0) : 0;
}

function nodeHeight(node: ProjectedNode): number {
  if (node.kind === 'response') return RESPONSE_HEADER + responseStepCount(node) * STEP_HEIGHT + RESPONSE_ADD;
  if (node.kind === 'execution') return EXECUTION_HEIGHT;
  return ROW_HEIGHT;
}

// Edge weight by kind. Paint is NOT by kind any more: a rail carries the lane
// color of its target's author (doc named choice 2), because the rail's job is
// to say whose history this line of work belongs to. What survives from the
// kind is emphasis: the two streams that converge at a watch are the load
// bearing pair, so they draw at full weight and everything else recedes.
const STRONG_EDGES: ReadonlySet<PgEdgeKind> = new Set<PgEdgeKind>(['feeds', 'declares']);

// dagre ranks by topology: the two root families (sources on the fact side,
// assumptions on the stake side) have no inbound edges so they land on the first
// rank; responses have no outbound edges so they land on the last. Everything
// between is assigned by topology, so watches land where both streams converge.
// No explicit layer constraint is needed, which is why dagre carries the intent
// that elk expressed with layerConstraint FIRST/LAST.

// Which watches are the join is `mergeWatchIds` in commits.ts: the same
// question the commit language answers as "which commits are merge commits",
// asked once so the layout and the row renderer cannot disagree about it.

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

  const joins = mergeWatchIds(graph);

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

  const byNodeId = new Map(graph.nodes.map((node) => [node.id, node]));

  const edges: ProactivityRFEdge[] = graph.edges.map((edge) => {
    // The lane color of the TARGET's author: a rail arriving at a commit is
    // that commit's history arriving, so it wears that commit's speaker.
    const target = byNodeId.get(edge.to);
    const stroke = laneColor(target ? laneOf(target) : 'agent');
    return {
      id: edge.id,
      source: edge.from,
      target: edge.to,
      // The rail edge: the adopted commit-graph's own cubic, drawn through the
      // shared `railPath` builder. No arrowheads anywhere: lineage flows by
      // convention in a commit graph, and an arrowhead would be a second,
      // weaker claim about the same thing (doc named choice 2).
      type: 'rail',
      data: { kind: edge.kind },
      style: { stroke, strokeWidth: STRONG_EDGES.has(edge.kind) ? 2 : 1.5 },
      selectable: false,
      focusable: false,
      deletable: false,
    };
  });

  const laidGraph = g.graph();
  return { width: laidGraph.width ?? 0, height: laidGraph.height ?? 0, nodes, edges };
}
