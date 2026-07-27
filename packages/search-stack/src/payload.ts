// SOURCING: extracted constellation payload validation and cap enforcement.

import {
  MAX_CONSTELLATION_MEMORY_NODES,
  MAX_CONSTELLATION_RESULT_NODES,
  type ConstellationEdge,
  type ConstellationEdgeReason,
  type ConstellationMemoryNode,
  type ConstellationNode,
  type ConstellationPayload,
  type ConstellationQueryMeta,
  type ConstellationState,
  type EdgeReasonType,
  type GraphRelation,
} from './contracts';

const RELATIONS: readonly GraphRelation[] = [
  'KNOWN',
  'EXTENDS',
  'CONTRADICTS',
  'ORPHAN',
];

const EDGE_REASON_TYPES: readonly EdgeReasonType[] = [
  'field_fact_intersect',
  'citation',
  'shared_source',
  'shared_author',
  'graph_edge',
  'memory_exact_tier',
];

export type ConstellationParse =
  | { readonly ok: true; readonly payload: ConstellationPayload }
  | { readonly ok: false; readonly reason: string };

export function parseConstellationPayload(value: unknown): ConstellationParse {
  if (!isRecord(value)) return fail('constellation payload is not an object');
  if (!Array.isArray(value.nodes)) {
    return fail('constellation payload has no nodes array');
  }
  if (!Array.isArray(value.edges)) {
    return fail('constellation payload has no edges array');
  }
  if (!Array.isArray(value.memoryNodes)) {
    return fail('constellation payload has no memoryNodes array');
  }
  const meta = parseMeta(value.meta);
  if (!meta) return fail('constellation payload has no readable query meta');

  const nodes: ConstellationNode[] = [];
  for (const candidate of value.nodes) {
    const node = parseNode(candidate);
    if (!node) return fail('constellation payload has a malformed result node');
    nodes.push(node);
  }
  const memoryNodes: ConstellationMemoryNode[] = [];
  for (const candidate of value.memoryNodes) {
    const node = parseMemoryNode(candidate);
    if (!node) return fail('constellation payload has a malformed memory node');
    memoryNodes.push(node);
  }
  const edges: ConstellationEdge[] = [];
  for (const candidate of value.edges) {
    const edge = parseEdge(candidate);
    if (!edge) return fail('constellation payload has a malformed edge');
    edges.push(edge);
  }
  return {
    ok: true,
    payload: capConstellationPayload({ nodes, edges, memoryNodes, meta }),
  };
}

export function capConstellationPayload(
  payload: ConstellationPayload,
): ConstellationPayload {
  const nodes = [...payload.nodes]
    .sort((left, right) => left.admittedRank - right.admittedRank)
    .slice(0, MAX_CONSTELLATION_RESULT_NODES);
  const memoryNodes = payload.memoryNodes.slice(
    0,
    MAX_CONSTELLATION_MEMORY_NODES,
  );
  const kept = new Set([
    ...nodes.map((node) => node.id),
    ...memoryNodes.map((node) => node.id),
  ]);
  const edges = payload.edges.filter(
    (edge) => kept.has(edge.source) && kept.has(edge.target),
  );
  return { nodes, edges, memoryNodes, meta: payload.meta };
}

export function parseConstellationState(value: unknown): ConstellationState {
  if (!isRecord(value)) {
    return { kind: 'error', cause: 'The constellation payload is not an object.' };
  }
  const kind = typeof value.kind === 'string' ? value.kind : undefined;
  if (kind == null) {
    const parsed = parseConstellationPayload(value);
    return parsed.ok
      ? { kind: 'success', payload: parsed.payload }
      : { kind: 'error', cause: capitalize(parsed.reason) };
  }

  switch (kind) {
    case 'loading':
      return {
        kind: 'loading',
        narration:
          typeof value.narration === 'string' ? value.narration : undefined,
      };
    case 'empty':
      return {
        kind: 'empty',
        reason:
          typeof value.reason === 'string' && value.reason.trim()
            ? value.reason
            : 'Nothing was admitted for this query.',
      };
    case 'error':
      return {
        kind: 'error',
        cause:
          typeof value.cause === 'string' && value.cause.trim()
            ? value.cause
            : 'The search stack failed without naming a cause.',
      };
    case 'partial': {
      const parsed = parseConstellationPayload(value.payload);
      if (!parsed.ok) return { kind: 'error', cause: capitalize(parsed.reason) };
      return {
        kind: 'partial',
        payload: parsed.payload,
        degradedNotes: Array.isArray(value.degradedNotes)
          ? value.degradedNotes.filter(
              (note): note is string => typeof note === 'string',
            )
          : [],
      };
    }
    case 'success': {
      const parsed = parseConstellationPayload(value.payload);
      return parsed.ok
        ? { kind: 'success', payload: parsed.payload }
        : { kind: 'error', cause: capitalize(parsed.reason) };
    }
    default:
      return { kind: 'error', cause: `Unknown constellation state: ${kind}` };
  }
}

export function constellationPayloadOf(
  state: ConstellationState,
): ConstellationPayload | undefined {
  return state.kind === 'success' || state.kind === 'partial'
    ? state.payload
    : undefined;
}

export function constellationDegradedNotes(
  state: ConstellationState,
): string[] {
  const notes = state.kind === 'partial' ? [...state.degradedNotes] : [];
  for (const provider of constellationPayloadOf(state)?.meta.degradedProviders ?? []) {
    if (!notes.some((note) =>
      note.toLowerCase().startsWith(provider.toLowerCase())
    )) {
      notes.push(`${provider} degraded during this retrieval.`);
    }
  }
  return notes;
}

function parseNode(value: unknown): ConstellationNode | undefined {
  if (!isRecord(value)) return undefined;
  const id = readText(value.id);
  const url = readText(value.url);
  const title = readText(value.title);
  const relation = RELATIONS.find((candidate) => candidate === value.relation);
  const admittedRank =
    typeof value.admittedRank === 'number' ? value.admittedRank : undefined;
  if (!id || !url || !title || !relation || !Number.isFinite(admittedRank)) {
    return undefined;
  }
  return {
    id,
    url,
    title,
    admittedRank: admittedRank as number,
    relation,
    ...(readText(value.favicon) ? { favicon: readText(value.favicon) } : {}),
    ...(readText(value.description)
      ? { description: readText(value.description) }
      : {}),
  };
}

function parseMemoryNode(
  value: unknown,
): ConstellationMemoryNode | undefined {
  if (!isRecord(value)) return undefined;
  const id = readText(value.id);
  const atomRef = readText(value.atomRef);
  const title = readText(value.title);
  const connectionExplanation = readText(value.connectionExplanation);
  return id && atomRef && title && connectionExplanation
    ? { id, atomRef, title, connectionExplanation }
    : undefined;
}

function parseEdge(value: unknown): ConstellationEdge | undefined {
  if (!isRecord(value)) return undefined;
  const source = readText(value.source);
  const target = readText(value.target);
  const reason = parseReason(value.reason);
  return source && target && reason ? { source, target, reason } : undefined;
}

function parseReason(
  value: unknown,
): ConstellationEdgeReason | undefined {
  if (!isRecord(value)) return undefined;
  const type = EDGE_REASON_TYPES.find((candidate) => candidate === value.type);
  const text = readText(value.text);
  const evidenceRefs = Array.isArray(value.evidenceRefs)
    ? value.evidenceRefs.filter(
        (ref): ref is string =>
          typeof ref === 'string' && ref.trim().length > 0,
      )
    : [];
  return type && text && evidenceRefs.length > 0
    ? { type, text, evidenceRefs }
    : undefined;
}

function parseMeta(value: unknown): ConstellationQueryMeta | undefined {
  if (!isRecord(value)) return undefined;
  const query = typeof value.query === 'string' ? value.query : undefined;
  const subgraphRef = readText(value.subgraphRef);
  if (query == null || !subgraphRef) return undefined;
  return {
    query,
    subgraphRef,
    tokensAdmitted: readCount(value.tokensAdmitted),
    tokensDeferred: readCount(value.tokensDeferred),
    degradedProviders: Array.isArray(value.degradedProviders)
      ? value.degradedProviders.filter(
          (provider): provider is string =>
            typeof provider === 'string' && provider.trim().length > 0,
        )
      : [],
  };
}

function readText(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value : undefined;
}

function readCount(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function fail(reason: string): ConstellationParse {
  return { ok: false, reason };
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}
