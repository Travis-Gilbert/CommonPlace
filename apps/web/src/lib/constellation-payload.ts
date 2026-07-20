// SOURCING: none. Wire parsing and cap enforcement, no upstream component applies.
/**
 * Reads the constellation payload a scene package carries under
 * `provenance.constellation` (HANDOFF-SEARCH-CONSTELLATION D1, D2).
 *
 * Two rules drive this module:
 *
 * 1. It never throws. A malformed or absent payload degrades to the D5 error
 *    state with a named cause, because the renderer must stay honest rather
 *    than blank.
 * 2. Caps live at the payload boundary, never in the renderer. Anything past
 *    `MAX_CONSTELLATION_RESULT_NODES` or `MAX_CONSTELLATION_MEMORY_NODES` is
 *    dropped here, along with every edge that referenced a dropped node.
 */

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
} from '@commonplace/block-view-contracts/search-stack';
import type { ScenePackageV2 } from '@/lib/scene-package';

const RELATIONS: readonly GraphRelation[] = ['known', 'extends', 'contradicts', 'orphan'];
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

/**
 * Parses an unknown value into a capped `ConstellationPayload`.
 * Returns a reason string instead of throwing on any failure.
 */
export function parseConstellationPayload(value: unknown): ConstellationParse {
  if (!isRecord(value)) return fail('constellation payload is not an object');

  const rawNodes = value.nodes;
  const rawEdges = value.edges;
  const rawMemory = value.memoryNodes;
  if (!Array.isArray(rawNodes)) return fail('constellation payload has no nodes array');
  if (!Array.isArray(rawEdges)) return fail('constellation payload has no edges array');
  if (!Array.isArray(rawMemory)) return fail('constellation payload has no memoryNodes array');

  const meta = parseMeta(value.meta);
  if (!meta) return fail('constellation payload has no readable query meta');

  const nodes: ConstellationNode[] = [];
  for (const candidate of rawNodes) {
    const node = parseNode(candidate);
    if (!node) return fail('constellation payload has a malformed result node');
    nodes.push(node);
  }

  const memoryNodes: ConstellationMemoryNode[] = [];
  for (const candidate of rawMemory) {
    const node = parseMemoryNode(candidate);
    if (!node) return fail('constellation payload has a malformed memory node');
    memoryNodes.push(node);
  }

  const edges: ConstellationEdge[] = [];
  for (const candidate of rawEdges) {
    const edge = parseEdge(candidate);
    if (!edge) return fail('constellation payload has a malformed edge');
    edges.push(edge);
  }

  return { ok: true, payload: capConstellationPayload({ nodes, edges, memoryNodes, meta }) };
}

/**
 * Applies the surface caps. Result nodes keep the lowest `admittedRank` values,
 * memory nodes keep source order, and edges survive only when both endpoints do.
 */
export function capConstellationPayload(payload: ConstellationPayload): ConstellationPayload {
  const nodes = [...payload.nodes]
    .sort((a, b) => a.admittedRank - b.admittedRank)
    .slice(0, MAX_CONSTELLATION_RESULT_NODES);
  const memoryNodes = payload.memoryNodes.slice(0, MAX_CONSTELLATION_MEMORY_NODES);

  const kept = new Set<string>([...nodes.map((n) => n.id), ...memoryNodes.map((n) => n.id)]);
  const edges = payload.edges.filter((edge) => kept.has(edge.source) && kept.has(edge.target));

  return { nodes, edges, memoryNodes, meta: payload.meta };
}

/**
 * Reads the D5 state a scene package carries. Accepts either a full
 * `ConstellationState` or a bare payload (treated as `success`).
 */
export function readConstellationState(scenePackage: ScenePackageV2): ConstellationState {
  const carried = scenePackage.provenance?.constellation;
  if (carried === undefined || carried === null) {
    return { kind: 'error', cause: 'This scene package carries no constellation payload.' };
  }
  return parseConstellationState(carried);
}

/** Parses an unknown value into a D5 state, degrading to `error` with a cause. */
export function parseConstellationState(value: unknown): ConstellationState {
  if (!isRecord(value)) {
    return { kind: 'error', cause: 'The constellation payload is not an object.' };
  }

  const kind = typeof value.kind === 'string' ? value.kind : undefined;

  if (kind === undefined) {
    const parsed = parseConstellationPayload(value);
    return parsed.ok
      ? { kind: 'success', payload: parsed.payload }
      : { kind: 'error', cause: capitalize(parsed.reason) };
  }

  switch (kind) {
    case 'loading':
      return {
        kind: 'loading',
        narration: typeof value.narration === 'string' ? value.narration : undefined,
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
          ? value.degradedNotes.filter((note): note is string => typeof note === 'string')
          : [],
      };
    }
    case 'success': {
      const parsed = parseConstellationPayload(value.payload);
      if (!parsed.ok) return { kind: 'error', cause: capitalize(parsed.reason) };
      return { kind: 'success', payload: parsed.payload };
    }
    default:
      return { kind: 'error', cause: `Unknown constellation state: ${kind}` };
  }
}

/** The payload a state carries, or undefined for the states that carry none. */
export function constellationPayloadOf(state: ConstellationState): ConstellationPayload | undefined {
  return state.kind === 'success' || state.kind === 'partial' ? state.payload : undefined;
}

/**
 * Degraded notes to surface in the annotation column: the partial state's own
 * notes plus every provider the meta reports as degraded.
 */
export function constellationDegradedNotes(state: ConstellationState): string[] {
  const notes = state.kind === 'partial' ? [...state.degradedNotes] : [];
  const payload = constellationPayloadOf(state);
  for (const provider of payload?.meta.degradedProviders ?? []) {
    const line = `${provider} degraded during this retrieval.`;
    if (!notes.some((note) => note.toLowerCase().startsWith(provider.toLowerCase()))) {
      notes.push(line);
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
  if (!id || !url || !title || !relation) return undefined;
  const admittedRank = typeof value.admittedRank === 'number' ? value.admittedRank : undefined;
  if (admittedRank === undefined || !Number.isFinite(admittedRank)) return undefined;
  return {
    id,
    url,
    title,
    favicon: readText(value.favicon),
    description: readText(value.description),
    admittedRank,
    relation,
  };
}

function parseMemoryNode(value: unknown): ConstellationMemoryNode | undefined {
  if (!isRecord(value)) return undefined;
  const id = readText(value.id);
  const atomRef = readText(value.atomRef);
  const title = readText(value.title);
  const connectionExplanation = readText(value.connectionExplanation);
  if (!id || !atomRef || !title || !connectionExplanation) return undefined;
  return { id, atomRef, title, connectionExplanation };
}

function parseEdge(value: unknown): ConstellationEdge | undefined {
  if (!isRecord(value)) return undefined;
  const source = readText(value.source);
  const target = readText(value.target);
  const reason = parseReason(value.reason);
  if (!source || !target || !reason) return undefined;
  return { source, target, reason };
}

function parseReason(value: unknown): ConstellationEdgeReason | undefined {
  if (!isRecord(value)) return undefined;
  const type = EDGE_REASON_TYPES.find((candidate) => candidate === value.type);
  const text = readText(value.text);
  if (!type || !text) return undefined;
  const evidenceRefs = Array.isArray(value.evidenceRefs)
    ? value.evidenceRefs.filter((ref): ref is string => typeof ref === 'string' && ref.trim().length > 0)
    : [];
  if (evidenceRefs.length === 0) return undefined;
  return { type, text, evidenceRefs };
}

function parseMeta(value: unknown): ConstellationQueryMeta | undefined {
  if (!isRecord(value)) return undefined;
  const query = typeof value.query === 'string' ? value.query : undefined;
  const subgraphRef = readText(value.subgraphRef);
  if (query === undefined || !subgraphRef) return undefined;
  return {
    query,
    subgraphRef,
    tokensAdmitted: readCount(value.tokensAdmitted),
    tokensDeferred: readCount(value.tokensDeferred),
    degradedProviders: Array.isArray(value.degradedProviders)
      ? value.degradedProviders.filter((p): p is string => typeof p === 'string' && p.trim().length > 0)
      : [],
  };
}

function readText(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim().length > 0 ? value : undefined;
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
