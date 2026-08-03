// SOURCING: none. Pure wire types, no upstream component applies.
/**
 * Wire contract for the editor intelligence surface.
 *
 * SPEC-COMMONPLACE-VSCODE-SURFACE-1.0 names SPEC-COMMONPLACE-EDITOR-DX-1.0 as
 * the owner of this surface: the inspection engine, the `commonplace-api`
 * queries, and the Not-LSP choice are its deliverables, not this spec's. This
 * file is the *shape* both consumers read, so the console CM6 editor (V8's
 * first front) and the VS Code pack (V8's second front) cannot drift while the
 * server side is being built.
 *
 * Two invariants ride on every response and are the reason this is one type and
 * not four:
 *
 * - `generation` is a monotonic stamp from the store. A consumer that has seen
 *   generation N discards anything stamped below N; late answers to superseded
 *   questions are the failure mode Not-LSP trades away sequence numbers to
 *   avoid. See `isStaleGeneration`.
 * - `degradation` is a value, not an exception. A cold index answers "reduced,
 *   these indexes are missing", never an empty findings list that reads as
 *   "your file is clean".
 *
 * Field names are the GraphQL/JSON casing, camelCase on the wire even though
 * the Rust side is snake_case, matching `search-stack.ts`.
 */

export const EDITOR_INTELLIGENCE_CONTRACT_VERSION = 'commonplace-editor-intelligence/v1';

/** Monotonic store stamp. Compared, never displayed. */
export type Generation = number;

/**
 * Why an answer is less than whole. Mirrors the console's `Degradation` in
 * `apps/console/src/lib/degradation.ts`: two levels, one vocabulary, wire codes
 * never reaching a user.
 */
export interface IntelligenceDegradation {
  readonly level: 'reduced' | 'unavailable';
  /** Wire code, mapped to a sentence by the consumer. Never rendered raw. */
  readonly code: string;
  /** Indexes or engines that were not available, named for the reader. */
  readonly missing?: readonly string[];
  /** Endpoint dialed, HTTP status, or the reason the far side gave. */
  readonly detail?: string;
}

/** Zero-based line/character position, matching VS Code and CM6 line numbering. */
export interface Position {
  readonly line: number;
  readonly character: number;
}

export interface Range {
  readonly start: Position;
  readonly end: Position;
}

export type DiagnosticSeverity = 'error' | 'warning' | 'information' | 'hint';

/** One finding, sourced from a Diagnostic graph node. */
export interface EditorDiagnostic {
  readonly id: string;
  readonly range: Range;
  readonly severity: DiagnosticSeverity;
  readonly message: string;
  /** The engine or rule that produced it, shown as the diagnostic source. */
  readonly source: string;
  /** Graph object this finding hangs off, for deep links and receipts. */
  readonly objectId?: string;
  /** Fix ids applicable at this finding, resolved through `applyFix`. */
  readonly fixIds?: readonly string[];
}

/**
 * One semantic token span. `type` and `modifiers` are the legend's names, not
 * indexes: the legend is negotiated per consumer, and VS Code's numeric
 * encoding is a rendering detail of the provider, not of the wire.
 */
export interface SemanticTokenSpan {
  readonly range: Range;
  readonly type: string;
  readonly modifiers?: readonly string[];
}

export interface EditorInlayHint {
  readonly position: Position;
  readonly label: string;
  readonly tooltip?: string;
}

/** A caret-local action. Block-level intentions carry no range. */
export interface Intention {
  readonly id: string;
  readonly title: string;
  readonly kind: 'quickfix' | 'refactor' | 'block';
  readonly range?: Range;
  /** Fix id passed to `applyFix`; absent for intentions the client runs itself. */
  readonly fixId?: string;
}

/** Index readiness, rendered as a language status item and a status bar chip. */
export interface ReadinessState {
  readonly ready: boolean;
  /** Indexes still building, named. Empty when ready. */
  readonly pending: readonly string[];
  readonly generation: Generation;
}

/** Everything the providers render for one file at one generation. */
export interface FileIntelligence {
  readonly uri: string;
  readonly generation: Generation;
  readonly diagnostics: readonly EditorDiagnostic[];
  readonly tokens: readonly SemanticTokenSpan[];
  readonly inlayHints: readonly EditorInlayHint[];
  readonly intentions: readonly Intention[];
  readonly degradation?: IntelligenceDegradation;
}

/** A fix, previewed and applied through the same shape. Preview equals applied. */
export interface FixPreview {
  readonly fixId: string;
  readonly uri: string;
  readonly edits: readonly { readonly range: Range; readonly newText: string }[];
  readonly generation: Generation;
}

/** Receipt returned by a write that went through the object seam. */
export interface SeamReceipt {
  readonly receiptId: string;
  readonly objectId: string;
  readonly generation: Generation;
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

/** The GraphQL documents both fronts send. One query surface, two consumers. */
export const EDITOR_INTELLIGENCE_QUERY = `query FileIntelligence($uri: String!) {
  fileIntelligence(uri: $uri) {
    uri
    generation
    diagnostics { id range { start { line character } end { line character } } severity message source objectId fixIds }
    tokens { range { start { line character } end { line character } } type modifiers }
    inlayHints { position { line character } label tooltip }
    intentions { id title kind range { start { line character } end { line character } } fixId }
    degradation { level code missing detail }
  }
}`;

export const EDITOR_READINESS_QUERY = `query EditorReadiness {
  editorReadiness { ready pending generation }
}`;

export const EDITOR_APPLY_FIX_MUTATION = `mutation ApplyFix($fixId: String!, $uri: String!, $preview: Boolean!) {
  applyFix(fixId: $fixId, uri: $uri, preview: $preview) {
    fixId
    uri
    generation
    edits { range { start { line character } end { line character } } newText }
  }
}`;
