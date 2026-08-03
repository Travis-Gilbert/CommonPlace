// SOURCING: none. Pure fixture data, no upstream component applies.
/**
 * The EDITOR-DX fixture file, and the answers the surface gives about it.
 *
 * SPEC-COMMONPLACE-VSCODE-SURFACE-1.0 V2 and V8 both name this fixture as the
 * oracle: V2 requires the pack and a raw GraphQL query to show identical
 * findings for it, V8 requires the console CM6 editor and the pack to render it
 * the same at the same generation. Keeping the fixture beside the contract is
 * what makes "identical" checkable without a live store.
 *
 * Two properties are deliberate:
 *
 * - **The source is not ASCII.** A fixture that is pure ASCII cannot catch the
 *   one bug this surface is most exposed to, because UTF-8 byte offsets and
 *   UTF-16 code units agree exactly until the first multi-byte character. Greek,
 *   accented Latin, an em dash, and CJK all appear before the first finding.
 * - **Byte offsets are derived, never typed by hand.** Every span below is
 *   computed from the source text through the same conversion the consumers
 *   use, so editing the source moves the spans with it instead of silently
 *   invalidating them.
 */

import type {
  AppliedFix,
  ConcurrencyRefusal,
  DiagnosticsPayload,
  EditorInvalidation,
  FileHistory,
  InlayHintsPayload,
  IntentionsPayload,
  ReadinessPayload,
  SemanticTokensPayload,
} from './editor-intelligence';
import { SAVE_SELECTION_TO_GRAPH, SEND_SELECTION_TO_COMPOSER } from './editor-intelligence';
import { buildOffsetTable, utf16ToByte } from './editor-offsets';

/** Absolute path under a mounted content root, as the surface requires. */
export const FIXTURE_FILE = '/fixtures/editor-dx/sample.ts';
export const FIXTURE_URI = `file://${FIXTURE_FILE}`;

/**
 * The trailing run the `text.trailing_whitespace` detector reports.
 *
 * Interpolated rather than typed into the template below, because a literal
 * trailing run is stripped by every formatter and by `git diff --check`. Typed
 * literally it would vanish on the first commit and quietly unmake the finding.
 */
const TRAILING = '  ';

/**
 * Source text of the fixture, so both fronts index the same bytes.
 *
 * The comment line carries a 2-byte code point (Σ), a 2-byte accented letter
 * (é), a 3-byte em dash, and 3-byte CJK, so every UTF-8 width appears before
 * the first finding.
 */
export const FIXTURE_SOURCE = `export function total(items: Item[]) {
  // Σ over the résumé line items — 価格 may be absent
  let sum = 0;${TRAILING}
  for (const item of items) {
    sum += item.price;
  }
  return sum;
}
`;

export const FIXTURE_GENERATION = 41;

/**
 * Opaque to every consumer. The client never computes a hash; it compares this
 * value for equality and hands it back on writes, which is the whole contract.
 */
export const FIXTURE_CONTENT_HASH =
  'blake3:1f0c4a9d2b7e35618af04c2d9e6b8137a5c0de49f28b7d1360ea5c94b2f7038d';

const TABLE = buildOffsetTable(FIXTURE_SOURCE, FIXTURE_CONTENT_HASH);

/** Byte span of a literal in the fixture source. Throws rather than guess. */
function span(needle: string, from = 0): { startByte: number; endByte: number } {
  const index = FIXTURE_SOURCE.indexOf(needle, from);
  if (index < 0) throw new Error(`fixture literal not found: ${JSON.stringify(needle)}`);
  return {
    startByte: utf16ToByte(TABLE, index),
    endByte: utf16ToByte(TABLE, index + needle.length),
  };
}

/** Byte offset just past a literal, for caret positions and insertions. */
function caretAfter(needle: string): number {
  return span(needle).endByte;
}

const TRAILING_WHITESPACE = span(TRAILING, FIXTURE_SOURCE.indexOf('let sum = 0;'));
const ACCUMULATOR = span('sum', FIXTURE_SOURCE.indexOf('let sum'));
const TOTAL = span('total');
const PRICE = span('item.price');

export const FIXTURE_ACCUMULATOR_CARET = caretAfter('let sum');

/** The warm answer at FIXTURE_GENERATION. Degraded only by a cold index. */
export const FIXTURE_TOKENS: SemanticTokensPayload = {
  file: FIXTURE_FILE,
  generation: FIXTURE_GENERATION,
  contentHash: FIXTURE_CONTENT_HASH,
  content: FIXTURE_SOURCE,
  degraded: false,
  missingIndexes: [],
  tokens: [
    {
      ...TOTAL,
      tokenType: 'function',
      modifiers: ['declaration', 'exported'],
      anchorKind: 'identifier',
      anchorPath: [0, 1],
    },
    {
      ...ACCUMULATOR,
      tokenType: 'variable',
      modifiers: ['declaration'],
      anchorKind: 'identifier',
      anchorPath: [0, 3, 1, 0],
    },
  ],
};

export const FIXTURE_DIAGNOSTICS: DiagnosticsPayload = {
  file: FIXTURE_FILE,
  generation: FIXTURE_GENERATION,
  contentHash: FIXTURE_CONTENT_HASH,
  content: FIXTURE_SOURCE,
  degraded: false,
  missingIndexes: [],
  diagnostics: [
    {
      detector: 'text.trailing_whitespace',
      severity: 'warning',
      message: 'Trailing whitespace.',
      startByte: TRAILING_WHITESPACE.startByte,
      endByte: TRAILING_WHITESPACE.endByte,
      anchorKind: 'line',
      anchorPath: [2],
      fixId: 'editor-fix:trailing-whitespace:41',
    },
    {
      detector: 'compute_code.unresolved_reference',
      severity: 'info',
      message: 'price is optional on 2 of 3 observed Item shapes.',
      startByte: PRICE.startByte,
      endByte: PRICE.endByte,
      anchorKind: 'member_expression',
      anchorPath: [0, 3, 2, 1],
      fixId: null,
    },
  ],
};

/**
 * The core inlay-hint provider is intentionally empty. Documented emptiness is
 * not a gap, and the fixture records it so a consumer does not read an empty
 * list as a transport failure.
 */
export const FIXTURE_INLAY_HINTS: InlayHintsPayload = {
  file: FIXTURE_FILE,
  generation: FIXTURE_GENERATION,
  contentHash: FIXTURE_CONTENT_HASH,
  content: FIXTURE_SOURCE,
  degraded: false,
  missingIndexes: [],
  hints: [],
};

export const FIXTURE_INTENTIONS: IntentionsPayload = {
  file: FIXTURE_FILE,
  generation: FIXTURE_GENERATION,
  contentHash: FIXTURE_CONTENT_HASH,
  content: FIXTURE_SOURCE,
  degraded: false,
  missingIndexes: [],
  intentions: [
    {
      id: 'int-trim-trailing-whitespace',
      title: 'Trim trailing whitespace',
      kind: 'inspection_fix',
      startByte: TRAILING_WHITESPACE.startByte,
      endByte: TRAILING_WHITESPACE.endByte,
      fixId: 'editor-fix:trailing-whitespace:41',
    },
    {
      id: SEND_SELECTION_TO_COMPOSER,
      title: 'Send selection to composer',
      kind: 'block_action',
      startByte: ACCUMULATOR.startByte,
      endByte: ACCUMULATOR.endByte,
      fixId: null,
    },
    {
      id: SAVE_SELECTION_TO_GRAPH,
      title: 'Save selection to the graph',
      kind: 'block_action',
      startByte: ACCUMULATOR.startByte,
      endByte: ACCUMULATOR.endByte,
      fixId: null,
    },
  ],
};

/** Index into a payload list, loudly. `noUncheckedIndexedAccess` is on. */
function first<T>(values: readonly T[]): T {
  const value = values[0];
  if (value === undefined) throw new Error('fixture payload is empty');
  return value;
}

/**
 * The same file while `compute_code` is still building.
 *
 * This is the *steady state* for a freshly mounted project, not an alarm: the
 * surface answers with the tokens it has and names the index it lacks. A
 * consumer that renders this loudly pins a permanent warning to a working
 * editor.
 */
export const FIXTURE_TOKENS_COLD: SemanticTokensPayload = {
  file: FIXTURE_FILE,
  generation: FIXTURE_GENERATION - 1,
  contentHash: FIXTURE_CONTENT_HASH,
  content: FIXTURE_SOURCE,
  degraded: true,
  missingIndexes: ['compute_code'],
  tokens: [first(FIXTURE_TOKENS.tokens)],
};

export const FIXTURE_DIAGNOSTICS_COLD: DiagnosticsPayload = {
  file: FIXTURE_FILE,
  generation: FIXTURE_GENERATION - 1,
  contentHash: FIXTURE_CONTENT_HASH,
  content: FIXTURE_SOURCE,
  degraded: true,
  missingIndexes: ['compute_code'],
  diagnostics: [first(FIXTURE_DIAGNOSTICS.diagnostics)],
};

export const FIXTURE_READINESS_COLD: ReadinessPayload = {
  generation: FIXTURE_GENERATION - 1,
  capabilities: [
    { capability: 'tree_sitter', state: 'ready', missing: [] },
    { capability: 'compute_code', state: 'building', missing: ['compute_code'] },
  ],
};

export const FIXTURE_READINESS_WARM: ReadinessPayload = {
  generation: FIXTURE_GENERATION,
  capabilities: [
    { capability: 'tree_sitter', state: 'ready', missing: [] },
    { capability: 'compute_code', state: 'ready', missing: [] },
  ],
};

/**
 * Preview and applied result of the one fixture fix. V2 requires these to be
 * the same edits, which is why one constant serves both calls: `previewFix`
 * returns exactly this, and `applyFix` returns it again with the generation it
 * landed on.
 */
export const FIXTURE_FIX_PREVIEW: AppliedFix = {
  __typename: 'ApplyEditorFixGql',
  fixId: 'editor-fix:trailing-whitespace:41',
  path: FIXTURE_FILE,
  baseContentHash: FIXTURE_CONTENT_HASH,
  appliedGeneration: FIXTURE_GENERATION + 1,
  edits: [
    {
      startByte: TRAILING_WHITESPACE.startByte,
      endByte: TRAILING_WHITESPACE.endByte,
      replacement: '',
    },
  ],
};

/** The fixture source with the fix applied, for round-trip assertions. */
export const FIXTURE_SOURCE_FIXED = FIXTURE_SOURCE.replace(
  `let sum = 0;${TRAILING}\n`,
  'let sum = 0;\n',
);

/** What a write returns when the file moved underneath the client. */
export const FIXTURE_CONCURRENCY_REFUSAL: ConcurrencyRefusal = {
  __typename: 'EditorConcurrencyRefusalGql',
  code: 'content_hash_mismatch',
  path: FIXTURE_FILE,
  itemId: null,
  expectedContentHash: FIXTURE_CONTENT_HASH,
  actualContentHash:
    'blake3:88b1e7c4390a5d26fe07b3419c85d0aa62f39471be5c08d2a41f96370bc2ed15',
  message: 'The file changed since this edit was prepared.',
};

export const FIXTURE_HISTORY: FileHistory = {
  path: FIXTURE_FILE,
  revisions: [
    {
      generation: FIXTURE_GENERATION,
      hash: FIXTURE_CONTENT_HASH,
      label: null,
      timestampMs: 1_785_000_000_000,
      content: FIXTURE_SOURCE,
    },
    {
      generation: FIXTURE_GENERATION - 1,
      hash: 'blake3:3a5d9e0148c7b26f9d31ae570b8c4269fd13e08a7c95b4d260f8a137ce4b0952',
      label: 'before the accumulator landed',
      timestampMs: 1_784_999_000_000,
      content: null,
    },
  ],
};

export const FIXTURE_INVALIDATION: EditorInvalidation = {
  path: FIXTURE_FILE,
  generation: FIXTURE_GENERATION + 1,
  contentHash:
    'blake3:88b1e7c4390a5d26fe07b3419c85d0aa62f39471be5c08d2a41f96370bc2ed15',
  projectId: 'proj-editor-dx',
};
