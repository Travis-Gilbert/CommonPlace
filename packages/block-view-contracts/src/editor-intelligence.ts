// SOURCING: none. Pure wire types, no upstream component applies.
/**
 * Wire contract for the editor intelligence surface.
 *
 * This mirrors the surface SPEC-COMMONPLACE-EDITOR-DX-1.0 landed in
 * `apps/commonplace-api` (`src/editor_intelligence.rs`, `src/workspace.rs`,
 * `src/schema.rs`). It is the shape both consumers read — the console CM6
 * editor and the VS Code pack — so V8's parity comparison has one definition to
 * compare against.
 *
 * Three invariants ride on every response and are the reason this is one file
 * and not four:
 *
 * - **Offsets are UTF-8 byte indexes.** Both consumers address text in UTF-16
 *   code units (VS Code positions, CodeMirror 6 offsets). Converting requires
 *   the exact bytes the server measured, which is what `contentHash` identifies
 *   and `content` can carry. See `editor-offsets.ts`.
 * - **`generation` is a monotonic store stamp.** A consumer that has seen
 *   generation N discards anything stamped below N; late answers to superseded
 *   questions are the failure mode Not-LSP trades away sequence numbers to
 *   avoid. See `isStaleGeneration`.
 * - **`degraded` is a value, not an exception.** A cold index answers
 *   "reduced, these indexes are missing", never an empty findings list that
 *   reads as "your file is clean". `degraded: true` with
 *   `missingIndexes: ["compute_code"]` is the *steady state* for a freshly
 *   mounted project, so a consumer that renders any degradation as an alarm
 *   pins a permanent warning to a working editor. See `degradationLevel`.
 *
 * Field names are the GraphQL/JSON casing — camelCase on the wire even though
 * the Rust side is snake_case, matching `search-stack.ts`.
 */

export const EDITOR_INTELLIGENCE_CONTRACT_VERSION = 'commonplace-editor-intelligence/v2';

/** Monotonic store stamp. Compared, never displayed. */
export type Generation = number;

/**
 * UTF-8 byte offset into the indexed file bytes. Never a UTF-16 code unit and
 * never a character index; the two diverge on the first non-ASCII byte.
 */
export type ByteOffset = number;

/**
 * Blake3 identity of the exact UTF-8 bytes the server indexed, formatted
 * `blake3:<hex>`. The one value that lets a client prove it holds the bytes a
 * byte offset was measured against.
 */
export type ContentHash = string;

// ---------------------------------------------------------------------------
// Published vocabularies
//
// Each was a bare `String` on the wire before EDITOR-DX published it. They are
// GraphQL enums now, so these unions are exhaustive by construction rather than
// by guess, and a consumer that hits an unknown value is reading a newer server.
// ---------------------------------------------------------------------------

export type EditorSeverity = 'info' | 'warning' | 'error' | 'fatal';

export type EditorIntentionKind = 'inspection_fix' | 'block_action';

export type InlayHintKind = 'type' | 'parameter' | 'other';

export type ReadinessCapabilityState = 'ready' | 'building';

/** Stable block-action intention ids. Published so consumers stop string-matching. */
export const SEND_SELECTION_TO_COMPOSER = 'editor.send_selection_to_composer';
export const SAVE_SELECTION_TO_GRAPH = 'editor.save_selection_to_graph';

/**
 * Tree-sitter re-anchoring pair, on every token and every finding.
 *
 * `anchorKind` is the node kind the span was captured from; `anchorPath` is the
 * child-index path from the file root to that node. After an edit a client
 * re-anchors by walking the same path on the new tree and reading the node's
 * fresh byte span; if the path no longer resolves, the span is dropped rather
 * than trusted.
 *
 * Neither consumer here holds a parse tree, so both take the strict reading:
 * a span survives only while `contentHash` still matches, and is dropped
 * otherwise. The fields are carried so a consumer that *does* hold a tree can
 * do better without a contract change.
 */
export interface Anchor {
  readonly anchorKind: string;
  readonly anchorPath: readonly number[];
}

/**
 * The envelope every read payload shares. Carrying identity on all four is what
 * makes cross-provider consistency checkable: tokens and diagnostics for one
 * file at one generation must agree on `contentHash` or one of them is stale.
 */
export interface EditorPayloadEnvelope {
  /** Absolute filesystem path under a mounted content root. */
  readonly file: string;
  readonly generation: Generation;
  readonly contentHash: ContentHash;
  /** The indexed bytes, present only when the client asked via `includeContent`. */
  readonly content?: string | null;
  readonly degraded: boolean;
  /** Indexes that were not available. `compute_code` when resolution is cold. */
  readonly missingIndexes: readonly string[];
}

// ---------------------------------------------------------------------------
// Read payloads
// ---------------------------------------------------------------------------

export interface SemanticToken extends Anchor {
  readonly startByte: ByteOffset;
  readonly endByte: ByteOffset;
  readonly tokenType: string;
  readonly modifiers: readonly string[];
}

export interface SemanticTokensPayload extends EditorPayloadEnvelope {
  readonly tokens: readonly SemanticToken[];
}

export interface InlayHint {
  readonly positionByte: ByteOffset;
  readonly label: string;
  readonly kind: InlayHintKind;
}

export interface InlayHintsPayload extends EditorPayloadEnvelope {
  readonly hints: readonly InlayHint[];
}

export interface EditorDiagnostic extends Anchor {
  /** Detector registry id, e.g. `text.trailing_whitespace`. */
  readonly detector: string;
  readonly severity: EditorSeverity;
  readonly message: string;
  readonly startByte: ByteOffset;
  readonly endByte: ByteOffset;
  /** Opaque handle bound to this path, generation, and base hash. */
  readonly fixId?: string | null;
}

export interface DiagnosticsPayload extends EditorPayloadEnvelope {
  readonly diagnostics: readonly EditorDiagnostic[];
}

export interface EditorIntention {
  readonly id: string;
  readonly title: string;
  readonly kind: EditorIntentionKind;
  readonly startByte: ByteOffset;
  readonly endByte: ByteOffset;
  readonly fixId?: string | null;
}

export interface IntentionsPayload extends EditorPayloadEnvelope {
  readonly intentions: readonly EditorIntention[];
}

export interface ReadinessCapability {
  readonly capability: string;
  readonly state: ReadinessCapabilityState;
  /** Indexes still building. Empty when `state` is `ready`. */
  readonly missing: readonly string[];
}

/** Index readiness, workspace-wide. Per-file state rides `degraded` instead. */
export interface ReadinessPayload {
  readonly generation: Generation;
  readonly capabilities: readonly ReadinessCapability[];
}

// ---------------------------------------------------------------------------
// Writes
//
// Every write is optimistic-concurrency controlled on `baseContentHash` and can
// refuse. The refusal is a typed union arm rather than a GraphQL error because
// the consumer's correct response is specific: re-read the file, re-fetch, and
// re-offer. A generic error cannot carry the hashes needed to say what moved.
// ---------------------------------------------------------------------------

export interface EditorTextEdit {
  readonly startByte: ByteOffset;
  readonly endByte: ByteOffset;
  readonly replacement: string;
}

export interface AppliedFix {
  readonly __typename?: 'ApplyEditorFixGql';
  readonly fixId: string;
  readonly path: string;
  readonly baseContentHash: ContentHash;
  readonly edits: readonly EditorTextEdit[];
  readonly appliedGeneration: Generation;
}

export interface ConcurrencyRefusal {
  readonly __typename?: 'EditorConcurrencyRefusalGql';
  readonly code: string;
  readonly path?: string | null;
  readonly itemId?: string | null;
  readonly expectedContentHash: ContentHash;
  readonly actualContentHash: ContentHash;
  readonly message: string;
}

export interface FileWriteReceipt {
  readonly __typename?: 'FileWriteReceiptGql';
  readonly receiptId: string;
  readonly path: string;
  readonly baseContentHash: ContentHash;
  readonly contentHash: ContentHash;
  readonly generation: Generation;
}

export interface ItemWriteReceipt {
  readonly __typename?: 'ItemWriteReceiptGql';
  readonly receiptId: string;
  readonly itemId: string;
  readonly baseContentHash: ContentHash;
  readonly contentHash: ContentHash;
}

export type ApplyFixResult = AppliedFix | ConcurrencyRefusal;
export type FileWriteResult = FileWriteReceipt | ConcurrencyRefusal;
export type ItemWriteResult = ItemWriteReceipt | ConcurrencyRefusal;

/**
 * Narrow a write result to its refusal arm.
 *
 * The union arms are distinguished by `__typename`, which every write document
 * below selects. The structural fallback covers a caller that dropped it.
 */
export function isConcurrencyRefusal(
  result: ApplyFixResult | FileWriteResult | ItemWriteResult,
): result is ConcurrencyRefusal {
  if (result.__typename) return result.__typename === 'EditorConcurrencyRefusalGql';
  return 'expectedContentHash' in result && 'actualContentHash' in result;
}

// ---------------------------------------------------------------------------
// History
// ---------------------------------------------------------------------------

export interface FileRevision {
  /** Revisions are keyed by generation, not by a separate revision id. */
  readonly generation: Generation;
  readonly hash: string;
  readonly label?: string | null;
  /**
   * Epoch milliseconds. Typed `Int` on the wire, which GraphQL defines as
   * signed 32-bit while epoch ms is ~1.78e12. Read it as a plain JSON number;
   * do not route it through SDL-driven codegen that enforces the 32-bit bound.
   */
  readonly timestampMs: number;
  readonly content?: string | null;
}

export interface FileHistory {
  readonly path: string;
  readonly revisions: readonly FileRevision[];
}

// ---------------------------------------------------------------------------
// Invalidation
// ---------------------------------------------------------------------------

/**
 * One push event from `GET /v1/editor/invalidations` (`text/event-stream`).
 *
 * The schema has no `Subscription` type; this SSE door is the push contract.
 * Carrying `path` is what lets a consumer re-query one file rather than every
 * standing query it holds.
 */
export interface EditorInvalidation {
  readonly path: string;
  readonly generation: Generation;
  readonly contentHash: ContentHash;
  readonly projectId?: string | null;
}

/** Path of the SSE door, relative to the API origin. Takes an optional `?projectId=`. */
export const EDITOR_INVALIDATIONS_PATH = '/v1/editor/invalidations';

/**
 * Parse one SSE `data:` frame. Returns null for anything that is not a
 * well-formed invalidation, including the stream's opening comment, so a
 * malformed frame degrades to "no news" instead of a spurious refresh.
 */
export function parseEditorInvalidation(data: string): EditorInvalidation | null {
  let value: unknown;
  try {
    value = JSON.parse(data);
  } catch {
    return null;
  }
  if (typeof value !== 'object' || value === null) return null;
  const candidate = value as Record<string, unknown>;
  if (
    typeof candidate.path !== 'string'
    || candidate.path.length === 0
    || typeof candidate.generation !== 'number'
    || !Number.isSafeInteger(candidate.generation)
    || typeof candidate.contentHash !== 'string'
  ) {
    return null;
  }
  return {
    path: candidate.path,
    generation: candidate.generation,
    contentHash: candidate.contentHash,
    projectId: typeof candidate.projectId === 'string' ? candidate.projectId : null,
  };
}

// ---------------------------------------------------------------------------
// Degradation
// ---------------------------------------------------------------------------

/**
 * How loudly a payload's state should read.
 *
 * `reduced` is the common case and must stay quiet: the acceptance test asserts
 * `degraded: true` with `missingIndexes: ["compute_code"]` for a freshly
 * mounted project, while tokens and fixes still answer. Only an unreachable
 * surface — no answer at all — earns a loud treatment.
 */
export type DegradationLevel = 'whole' | 'reduced' | 'unavailable';

export function degradationLevel(payload: {
  readonly degraded: boolean;
  readonly missingIndexes: readonly string[];
}): DegradationLevel {
  if (!payload.degraded) return 'whole';
  return 'reduced';
}

/** The client-side shape for a surface that did not answer at all. */
export interface UnavailableSurface {
  readonly level: 'unavailable';
  /** Wire code, mapped to a sentence by the consumer. Never rendered raw. */
  readonly code: string;
  /** Endpoint dialed, HTTP status, or the reason the far side gave. */
  readonly detail?: string;
}

/**
 * True when `incoming` answers a question the consumer has already moved past.
 *
 * Equal generations are *not* stale: two providers legitimately read the same
 * generation, and a re-query after an invalidation can land on the same stamp
 * when nothing the query covers actually changed.
 */
export function isStaleGeneration(seen: Generation, incoming: Generation): boolean {
  return incoming < seen;
}

// ---------------------------------------------------------------------------
// GraphQL documents
//
// One query surface, two consumers. `includeContent` is a variable rather than
// always-on because a host that can read the file itself should not pay for the
// bytes twice; a browser host (`code serve-web`) has no filesystem and must.
// ---------------------------------------------------------------------------

const PAYLOAD_ENVELOPE = 'file generation contentHash content degraded missingIndexes';
const ANCHOR = 'anchorKind anchorPath';

export const SEMANTIC_TOKENS_QUERY = `query SemanticTokens($file: String!, $includeContent: Boolean) {
  semanticTokens(file: $file, includeContent: $includeContent) {
    ${PAYLOAD_ENVELOPE}
    tokens { startByte endByte tokenType modifiers ${ANCHOR} }
  }
}`;

export const DIAGNOSTICS_QUERY = `query Diagnostics($file: String!, $includeContent: Boolean) {
  diagnostics(file: $file, includeContent: $includeContent) {
    ${PAYLOAD_ENVELOPE}
    diagnostics { detector severity message startByte endByte ${ANCHOR} fixId }
  }
}`;

export const INLAY_HINTS_QUERY = `query InlayHints($file: String!, $includeContent: Boolean) {
  inlayHints(file: $file, includeContent: $includeContent) {
    ${PAYLOAD_ENVELOPE}
    hints { positionByte label kind }
  }
}`;

/**
 * The three position-free surfaces in one operation.
 *
 * They share a generation and a `contentHash`, so fetching them separately
 * would let tokens and findings land on different generations of the same file
 * and be rendered against each other. `includeContent` is asked once, on the
 * tokens payload, and its text converts all three. One operation is also one
 * round trip per invalidation instead of three.
 */
export const FILE_INTELLIGENCE_QUERY = `query FileIntelligence($file: String!, $includeContent: Boolean) {
  semanticTokens(file: $file, includeContent: $includeContent) {
    ${PAYLOAD_ENVELOPE}
    tokens { startByte endByte tokenType modifiers ${ANCHOR} }
  }
  diagnostics(file: $file) {
    file generation contentHash degraded missingIndexes
    diagnostics { detector severity message startByte endByte ${ANCHOR} fixId }
  }
  inlayHints(file: $file) {
    file generation contentHash degraded missingIndexes
    hints { positionByte label kind }
  }
}`;

export const INTENTIONS_QUERY = `query Intentions($file: String!, $position: Int!, $includeContent: Boolean) {
  intentions(file: $file, position: $position, includeContent: $includeContent) {
    ${PAYLOAD_ENVELOPE}
    intentions { id title kind startByte endByte fixId }
  }
}`;

export const READINESS_QUERY = `query EditorReadiness {
  readiness { generation capabilities { capability state missing } }
}`;

const APPLIED_FIX_FIELDS = 'fixId path baseContentHash appliedGeneration edits { startByte endByte replacement }';
const REFUSAL_FIELDS = 'code path itemId expectedContentHash actualContentHash message';

/** Pure read of the exact preview a fix handle would apply. Never mutates. */
export const PREVIEW_FIX_QUERY = `query PreviewFix($fixId: String!) {
  previewFix(fixId: $fixId) { ${APPLIED_FIX_FIELDS} }
}`;

export const APPLY_FIX_MUTATION = `mutation ApplyFix($fixId: String!) {
  applyFix(fixId: $fixId) {
    __typename
    ... on ApplyEditorFixGql { ${APPLIED_FIX_FIELDS} }
    ... on EditorConcurrencyRefusalGql { ${REFUSAL_FIELDS} }
  }
}`;

export const WRITE_FILE_MUTATION = `mutation WriteFile($path: String!, $content: String!, $baseContentHash: String!) {
  writeFile(path: $path, content: $content, baseContentHash: $baseContentHash) {
    __typename
    ... on FileWriteReceiptGql { receiptId path baseContentHash contentHash generation }
    ... on EditorConcurrencyRefusalGql { ${REFUSAL_FIELDS} }
  }
}`;

export const WRITE_ITEM_BODY_MUTATION = `mutation WriteItemBody($id: String!, $text: String!, $baseContentHash: String!) {
  writeItemBody(id: $id, text: $text, baseContentHash: $baseContentHash) {
    __typename
    ... on ItemWriteReceiptGql { receiptId itemId baseContentHash contentHash }
    ... on EditorConcurrencyRefusalGql { ${REFUSAL_FIELDS} }
  }
}`;

/**
 * The revision list. `content` is deliberately not selected.
 *
 * The server populates a body for every revision under 1 MiB, so asking for it
 * here would ship the whole history of a file to draw a list of dates.
 */
/**
 * One graph item, for a `theorem://` document.
 *
 * `bodyText` and `blobHash` together determine the write's `baseContentHash`;
 * see `itemBaseContentHash` in `editor-content-hash.ts` for why both are read.
 */
export const ITEM_QUERY = `query Item($id: String!) {
  item(id: $id) { id kind title bodyText blobHash mime updatedAtMs }
}`;

/**
 * Create a graph item from a selection.
 *
 * `writeItemBody` edits an item that already exists and refuses without a base
 * hash; creating one is `putNote`. Keeping the two apart is what lets the write
 * path stay strict about bases without making "save this selection" impossible.
 */
export const PUT_NOTE_MUTATION = `mutation PutNote($title: String!, $text: String!, $tags: [String!]) {
  putNote(title: $title, text: $text, tags: $tags) { id kind title bodyText blobHash mime updatedAtMs }
}`;

export const FILE_HISTORY_QUERY = `query FileHistory($path: String!) {
  fileHistory(path: $path) {
    path
    revisions { generation hash label timestampMs }
  }
}`;

/**
 * One revision's bytes, for the left side of a diff.
 *
 * `pinnedVfsGeneration` filters the history to revisions at or below the pin,
 * so pinning to the wanted generation puts it at the head of the list rather
 * than requiring a second addressing scheme for revisions.
 */
export const FILE_REVISION_CONTENT_QUERY = `query FileRevisionContent($path: String!, $generation: Int!) {
  fileHistory(path: $path, pinnedVfsGeneration: $generation) {
    path
    revisions { generation hash label timestampMs content }
  }
}`;

/** Restore produces a new revision rather than rewinding, and returns the history. */
export const RESTORE_REVISION_MUTATION = `mutation RestoreRevision($path: String!, $generation: Int!) {
  restoreRevision(path: $path, generation: $generation) {
    path
    revisions { generation hash label timestampMs }
  }
}`;
