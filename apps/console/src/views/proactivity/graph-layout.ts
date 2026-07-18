// SOURCING: elkjs (Eclipse Layout Kernel, layered algorithm). Verify-first V11:
// the layout is topological-depth layered per the Atlas of Knowledge
// prerequisite DAG, not a force layout, because force hides depth and depth is
// the one thing this graph must show. elk is layout-only: it returns
// coordinates, and the canvas renders every pixel through register tokens, so
// there is no bespoke canvas styling outside the register (named choice 9).
// elk is imported dynamically here, so the sentence and card altitudes load
// with no graph bundle (PG3 acceptance).

import type { PgEdgeKind, PgNodeKind, ProactivityGraph, ProjectedNode } from '@/lib/proactivity/model';

export interface LaidOutNode {
  readonly id: string;
  readonly kind: PgNodeKind;
  readonly node: ProjectedNode;
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  /** A watch that is the two-sided convergence: fed by a source and declared by
   *  a stake. The canvas marks it so the join reads as a join, not a pipe. */
  readonly isJoin: boolean;
}

export interface LaidOutEdge {
  readonly id: string;
  readonly kind: PgEdgeKind;
  readonly points: readonly { readonly x: number; readonly y: number }[];
}

export interface GraphLayout {
  readonly width: number;
  readonly height: number;
  readonly nodes: readonly LaidOutNode[];
  readonly edges: readonly LaidOutEdge[];
}

const DIMENSIONS: Record<PgNodeKind, { width: number; height: number }> = {
  assumption: { width: 168, height: 40 },
  source: { width: 132, height: 44 },
  stake: { width: 188, height: 52 },
  watch: { width: 208, height: 56 },
  judgment: { width: 156, height: 48 },
  response: { width: 208, height: 60 },
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
 * Lay out the graph with elk's layered algorithm. Dynamically imports elkjs so
 * the graph bundle is only fetched at the graph altitude.
 */
export async function layoutGraph(graph: ProactivityGraph): Promise<GraphLayout> {
  const { default: ELK } = await import('elkjs/lib/elk.bundled.js');
  const elk = new ELK();

  const joins = joinWatchIds(graph);

  const children = graph.nodes.map((node) => {
    const dims = DIMENSIONS[node.kind];
    const constraint = layerConstraint(node.kind);
    return {
      id: node.id,
      width: dims.width,
      height: dims.height,
      ...(constraint ? { layoutOptions: { 'elk.layered.layering.layerConstraint': constraint } } : {}),
    };
  });

  const elkEdges = graph.edges.map((edge) => ({ id: edge.id, sources: [edge.from], targets: [edge.to] }));

  const laid = await elk.layout({
    id: 'proactivity',
    layoutOptions: {
      'elk.algorithm': 'layered',
      'elk.direction': 'RIGHT',
      'elk.edgeRouting': 'ORTHOGONAL',
      'elk.spacing.nodeNode': '20',
      'elk.layered.spacing.nodeNodeBetweenLayers': '84',
      'elk.layered.considerModelOrder.strategy': 'NODES_AND_EDGES',
      'elk.layered.nodePlacement.strategy': 'NETWORK_SIMPLEX',
    },
    children,
    edges: elkEdges,
  });

  const byId = new Map(graph.nodes.map((node) => [node.id, node]));
  const edgeKindById = new Map(graph.edges.map((edge) => [edge.id, edge.kind]));

  const nodes: LaidOutNode[] = (laid.children ?? []).map((child) => {
    const node = byId.get(child.id);
    if (!node) throw new Error(`layout returned unknown node: ${child.id}`);
    return {
      id: child.id,
      kind: node.kind,
      node,
      x: child.x ?? 0,
      y: child.y ?? 0,
      width: child.width ?? 0,
      height: child.height ?? 0,
      isJoin: node.kind === 'watch' && joins.has(node.id),
    };
  });

  const edges: LaidOutEdge[] = (laid.edges ?? []).map((edge) => {
    const section = edge.sections?.[0];
    const points = section
      ? [section.startPoint, ...(section.bendPoints ?? []), section.endPoint]
      : [];
    return {
      id: edge.id,
      kind: edgeKindById.get(edge.id) ?? 'feeds',
      points,
    };
  });

  return {
    width: laid.width ?? 0,
    height: laid.height ?? 0,
    nodes,
    edges,
  };
}
