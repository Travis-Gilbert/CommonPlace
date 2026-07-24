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

/** Which match lane produced a hit. GraphQL enum values are uppercase on the wire. */
export type FindLane = 'EXACT' | 'LEXICAL' | 'SEMANTIC' | 'STRUCTURAL';

/** Scope kinds, in widening order. GraphQL enum values are uppercase on the wire. */
export type FindScopeKind = 'PAGE' | 'SESSION' | 'CORPUS' | 'WEB';

/** Widening order the scope stepper walks. Index is the rank. */
export const FIND_SCOPE_ORDER: readonly FindScopeKind[] = ['PAGE', 'SESSION', 'CORPUS', 'WEB'];

export type FindScope =
  | { readonly kind: 'PAGE'; readonly nodeId: string }
  | { readonly kind: 'SESSION'; readonly nodeIds: readonly string[] }
  | { readonly kind: 'CORPUS' }
  | { readonly kind: 'WEB' };

/**
 * How a result stands against what the person already knows. This is an
 * annotation, never a filter: `ORPHAN` is an honest answer and the result is
 * still in the response.
 */
export type GraphRelation = 'KNOWN' | 'EXTENDS' | 'CONTRADICTS' | 'ORPHAN';

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
  /** Executor receipt values. Rust currently reports lowercase scope names here. */
  readonly scopesSearched: readonly string[];
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
}

export interface SceneRef {
  readonly sceneId: string;
  /** Serialized ScenePackageV2 from the Rust GraphQL Json wrapper. */
  readonly package: unknown;
}

export interface ScatterResponse {
  readonly query: string;
  readonly aspects: readonly AspectNode[];
  readonly lambda: number;
  /** Which labeler named these aspects. Never a placeholder. */
  readonly labeler: string;
  readonly scopesSearched: readonly string[];
  readonly scene: SceneRef | null;
  readonly sceneRefusal?: string | null;
  /** Present on an `expand` response: which aspect was re-scattered. */
  readonly expandedFrom?: AspectId;
  readonly scatterRef: string;
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
