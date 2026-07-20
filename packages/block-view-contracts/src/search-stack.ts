// SOURCING: none. Pure wire types, no upstream component applies.
/**
 * Wire contract for the CommonPlace search stack.
 *
 * Mirrors the Rust shapes in `rustyred-thg-find` (SPEC-COMMONPLACE-SEARCH-STACK-1.0
 * B3, B4, B5) and the constellation payload in HANDOFF-SEARCH-CONSTELLATION D1,
 * as they are served by `apps/commonplace-api` (B7) and by the `find` / `scatter`
 * MCP tools (B8). One executor, two doors, one shape.
 *
 * Field names are the GraphQL/JSON casing, which is camelCase on the wire even
 * though the Rust side is snake_case.
 */

export const COMMONPLACE_SEARCH_STACK_CONTRACT_VERSION = 'commonplace-search-stack/v1';

/** Which match lane produced a hit. */
export type FindLane = 'exact' | 'lexical' | 'semantic' | 'structural';

/** Scope kinds, in widening order. */
export type FindScopeKind = 'page' | 'session' | 'corpus' | 'web';

/** Widening order the scope stepper walks. Index is the rank. */
export const FIND_SCOPE_ORDER: readonly FindScopeKind[] = ['page', 'session', 'corpus', 'web'];

export type FindScope =
  | { readonly kind: 'page'; readonly nodeId: string }
  | { readonly kind: 'session'; readonly nodeIds: readonly string[] }
  | { readonly kind: 'corpus' }
  | { readonly kind: 'web' };

/**
 * How a result stands against what the person already knows. This is an
 * annotation, never a filter: `orphan` is an honest answer and the result is
 * still in the response.
 */
export type GraphRelation = 'known' | 'extends' | 'contradicts' | 'orphan';

/** A reference to a graph edge carried as evidence. */
export interface EdgeRef {
  readonly id: string;
  readonly fromId: string;
  readonly toId: string;
  readonly type: string;
  readonly confidence?: number;
}

/** Byte range inside the document's indexed text property. */
export interface ByteRange {
  readonly start: number;
  readonly end: number;
}

/** One located match. */
export interface FindHit {
  readonly doc: string;
  readonly byteRange: ByteRange;
  readonly lane: FindLane;
  readonly scope: FindScope;
  readonly snippet?: string;
  readonly title?: string;
  readonly source?: string;
}

/** A ranked, annotated result. */
export interface FindResult {
  readonly hit: FindHit;
  readonly score: number;
  readonly relation: GraphRelation;
  readonly edges: readonly EdgeRef[];
}

export interface FindRequest {
  readonly query: string;
  /** Widening order is preserved by the executor regardless of array order. */
  readonly scopes: readonly FindScope[];
  readonly lanes: readonly FindLane[];
  readonly k: number;
  /** MMR convergence dial. 1.0 converges, 0.0 maximizes spread. */
  readonly lambda: number;
}

/** Per-lane accounting, so a surface can say which lane went quiet and why. */
export interface LaneReceipt {
  readonly lane: FindLane;
  readonly seeded: number;
  readonly admitted: number;
  /** Present when the lane could not run. Degraded, not fatal. */
  readonly degradedReason?: string;
}

export interface FindResponse {
  readonly query: string;
  readonly results: readonly FindResult[];
  readonly lanes: readonly LaneReceipt[];
  readonly scopesSearched: readonly FindScopeKind[];
  readonly lambda: number;
  /** Stable id for the retrieval, used for provenance and cache keys. */
  readonly retrievalRef: string;
}

// ---------------------------------------------------------------------------
// Scatter (layer one)
// ---------------------------------------------------------------------------

export type AspectId = string;

/** Hard cap. Legibility beats recall on the scatter surface. */
export const MAX_ASPECTS = 8;

export interface AspectEdge {
  readonly target: AspectId;
  readonly weight: number;
}

export interface AspectNode {
  readonly id: AspectId;
  readonly label: string;
  readonly seedHits: readonly FindHit[];
  readonly relation: GraphRelation;
  readonly edges: readonly AspectEdge[];
  /** Which labeler produced `label`. Never a placeholder. */
  readonly labeledBy: 'deterministic' | 'mistral';
}

export interface SceneRef {
  readonly sceneId: string;
  readonly url: string;
}

export interface ScatterResponse {
  readonly query: string;
  readonly aspects: readonly AspectNode[];
  readonly lambda: number;
  readonly scene: SceneRef;
  /** Present on an `expand` response: which aspect was re-scattered. */
  readonly expandedFrom?: AspectId;
  readonly retrievalRef: string;
}

// ---------------------------------------------------------------------------
// Constellation (HANDOFF-SEARCH-CONSTELLATION D1)
// ---------------------------------------------------------------------------

/**
 * Why an edge exists. Every edge carries real evidence; there is no
 * similarity-only reason type by construction.
 */
export type EdgeReasonType =
  | 'field_fact_intersect'
  | 'citation'
  | 'shared_source'
  | 'shared_author'
  | 'graph_edge'
  | 'memory_exact_tier';

export interface ConstellationEdgeReason {
  readonly type: EdgeReasonType;
  /** Human-readable, rendered verbatim in the annotation column. */
  readonly text: string;
  readonly evidenceRefs: readonly string[];
}

export interface ConstellationNode {
  readonly id: string;
  readonly url: string;
  readonly title: string;
  readonly favicon?: string;
  readonly description?: string;
  /** Rank assigned by the membrane's admission ordering. */
  readonly admittedRank: number;
  readonly relation: GraphRelation;
}

export interface ConstellationEdge {
  readonly source: string;
  readonly target: string;
  readonly reason: ConstellationEdgeReason;
}

/** A node from the person's own graph. Renders gold, opens a memory atom. */
export interface ConstellationMemoryNode {
  readonly id: string;
  readonly atomRef: string;
  readonly title: string;
  /** Worded connection, e.g. "you captured three notes on this entity in June". */
  readonly connectionExplanation: string;
}

export interface ConstellationQueryMeta {
  readonly query: string;
  /** Provenance handle from `web_search_graph`. */
  readonly subgraphRef: string;
  readonly tokensAdmitted: number;
  readonly tokensDeferred: number;
  /** Providers that degraded, surfaced in the annotation column. */
  readonly degradedProviders: readonly string[];
}

/** Caps are enforced in the payload, never in the renderer. */
export const MAX_CONSTELLATION_RESULT_NODES = 8;
export const MAX_CONSTELLATION_MEMORY_NODES = 2;

export interface ConstellationPayload {
  readonly nodes: readonly ConstellationNode[];
  readonly edges: readonly ConstellationEdge[];
  readonly memoryNodes: readonly ConstellationMemoryNode[];
  readonly meta: ConstellationQueryMeta;
}

// ---------------------------------------------------------------------------
// Surface states (SPEC-UX-PHYSICS D4, restated by HANDOFF D5)
// ---------------------------------------------------------------------------

export type ConstellationState =
  | { readonly kind: 'loading'; readonly narration?: string }
  | { readonly kind: 'empty'; readonly reason: string }
  | { readonly kind: 'partial'; readonly payload: ConstellationPayload; readonly degradedNotes: readonly string[] }
  | { readonly kind: 'error'; readonly cause: string }
  | { readonly kind: 'success'; readonly payload: ConstellationPayload };

// ---------------------------------------------------------------------------
// saveUrl (SPEC B7 mutation, F4 surface)
// ---------------------------------------------------------------------------

export interface SaveUrlReceipt {
  readonly itemId: string;
  readonly collectionId: string;
  /** The real collection name from the ingest result. Never a placeholder. */
  readonly collectionName: string;
  readonly title: string;
  readonly url: string;
}
