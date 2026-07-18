// SOURCING: @commonplace/block-view (ObjectRef contract). The wire adapter
// between the typed projection and the block-view object seam, mirroring
// hunks/hunk-contract.ts. graphToObjectRefs serializes the projection to the
// ObjectRefs the host serves; graphFromObjects reconstructs the typed graph the
// view renders. When the real kernel wire lands behind the same seam, this
// adapter is the one place its shape normalizes; the view above it is unchanged.

import type { JsonValue, ObjectRef } from '@commonplace/block-view/types';
import type { PgEdge, PgEdgeKind, PgNodeKind, ProactivityGraph, ProjectedNode } from './model';

/** The six object types the surface queries. */
export const PG_TYPES: readonly string[] = [
  'pg.stake',
  'pg.source',
  'pg.watch',
  'pg.judgment',
  'pg.response',
  'pg.assumption',
];

/** Relation label carried on the FROM node for each edge kind. */
const RELATION_OF: Record<PgEdgeKind, string> = {
  rests_on: 'RESTS_ON',
  feeds: 'FEEDS',
  declares: 'DECLARES',
  gates: 'GATES',
  acts: 'ACTS',
};

const EDGE_OF: Record<string, PgEdgeKind> = {
  RESTS_ON: 'rests_on',
  FEEDS: 'feeds',
  DECLARES: 'declares',
  GATES: 'gates',
  ACTS: 'acts',
};

export function pgKind(type: string): PgNodeKind | null {
  if (!type.startsWith('pg.')) return null;
  const kind = type.slice(3);
  return kind === 'stake' || kind === 'source' || kind === 'watch' || kind === 'judgment' || kind === 'response' || kind === 'assumption'
    ? kind
    : null;
}

function nodeToProps(node: ProjectedNode, tenant: string): Record<string, JsonValue> {
  // The projection's fields are all JSON values (cap is number | null, never
  // Infinity); a structured clone detaches from the store and guarantees the
  // wire shape is serializable.
  const props = structuredClone(node) as unknown as Record<string, JsonValue>;
  props.tenant = tenant;
  return props;
}

export function graphToObjectRefs(graph: ProactivityGraph): ObjectRef[] {
  const outgoing = new Map<string, Record<string, string[]>>();
  for (const edge of graph.edges) {
    const relation = RELATION_OF[edge.kind];
    const map = outgoing.get(edge.from) ?? {};
    (map[relation] ??= []).push(edge.to);
    outgoing.set(edge.from, map);
  }
  return graph.nodes.map((node) => ({
    id: node.id,
    type: `pg.${node.kind}`,
    properties: nodeToProps(node, graph.tenant),
    relations: outgoing.get(node.id) ?? {},
  }));
}

/**
 * Reconstruct one typed projected node from its ObjectRef. Returns null for a
 * non-pg object or a kind mismatch (the forward-compat guard). The wire is our
 * own lossless projection, so properties reconstruct the node; this is the seam
 * where a future kernel wire shape would be normalized instead.
 */
export function nodeFromObject(object: ObjectRef): ProjectedNode | null {
  const kind = pgKind(object.type);
  if (!kind) return null;
  const props = object.properties;
  if (props.kind !== kind || typeof props.id !== 'string') return null;
  return props as unknown as ProjectedNode;
}

export interface RebuiltGraph {
  readonly tenant: string | null;
  readonly nodes: readonly ProjectedNode[];
  readonly edges: readonly PgEdge[];
}

/** Reconstruct the typed graph from the queried ObjectRefs. */
export function graphFromObjects(objects: readonly ObjectRef[]): RebuiltGraph {
  const nodes: ProjectedNode[] = [];
  const edges: PgEdge[] = [];
  let tenant: string | null = null;
  for (const object of objects) {
    const node = nodeFromObject(object);
    if (!node) continue;
    nodes.push(node);
    if (tenant === null && typeof object.properties.tenant === 'string') {
      tenant = object.properties.tenant;
    }
    const relations = object.relations ?? {};
    for (const [relation, targets] of Object.entries(relations)) {
      const edgeKind = EDGE_OF[relation];
      if (!edgeKind) continue;
      for (const to of targets) {
        edges.push({ id: `e-${edgeKind}-${object.id}-${to}`, from: object.id, to, kind: edgeKind });
      }
    }
  }
  return { tenant, nodes, edges };
}
