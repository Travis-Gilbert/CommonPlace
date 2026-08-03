// SOURCING: none. Pure fixture data, no upstream component applies.
/**
 * The EDITOR-DX fixture file, and the answers the store gives about it.
 *
 * SPEC-COMMONPLACE-VSCODE-SURFACE-1.0 V2 and V8 both name this fixture as the
 * oracle: V2 requires the pack and a raw GraphQL query to show identical
 * findings for it, V8 requires the console CM6 editor and the pack to render it
 * the same at the same generation. Keeping the fixture beside the contract is
 * what makes "identical" checkable without a live store.
 */

import type { FileIntelligence, FixPreview, ReadinessState } from './editor-intelligence';

export const FIXTURE_URI = 'file:///fixtures/editor-dx/sample.ts';

/** Source text of the fixture, so both fronts index the same bytes. */
export const FIXTURE_SOURCE = `export function total(items: Item[]) {
  let sum = 0;
  for (const item of items) {
    sum += item.price;
  }
  return sum;
}
`;

export const FIXTURE_GENERATION = 41;

/** The whole answer at FIXTURE_GENERATION, index warm. */
export const FIXTURE_INTELLIGENCE: FileIntelligence = {
  uri: FIXTURE_URI,
  generation: FIXTURE_GENERATION,
  diagnostics: [
    {
      id: 'diag-untyped-accumulator',
      range: { start: { line: 1, character: 6 }, end: { line: 1, character: 13 } },
      severity: 'warning',
      message: 'Accumulator has no declared type; the graph infers number from one call site only.',
      source: 'theorem.inference',
      objectId: 'obj-total-fn',
      fixIds: ['fix-annotate-accumulator'],
    },
    {
      id: 'diag-unguarded-price',
      range: { start: { line: 3, character: 11 }, end: { line: 3, character: 21 } },
      severity: 'information',
      message: 'price is optional on 2 of 3 observed Item shapes.',
      source: 'theorem.shapes',
      objectId: 'obj-item-shape',
    },
  ],
  tokens: [
    {
      range: { start: { line: 0, character: 16 }, end: { line: 0, character: 21 } },
      type: 'function',
      modifiers: ['declaration', 'exported'],
    },
    {
      range: { start: { line: 1, character: 6 }, end: { line: 1, character: 9 } },
      type: 'variable',
      modifiers: ['declaration'],
    },
  ],
  inlayHints: [
    { position: { line: 1, character: 9 }, label: ': number', tooltip: 'Inferred from 1 call site' },
  ],
  intentions: [
    {
      id: 'int-annotate',
      title: 'Annotate accumulator as number',
      kind: 'quickfix',
      range: { start: { line: 1, character: 6 }, end: { line: 1, character: 13 } },
      fixId: 'fix-annotate-accumulator',
    },
    { id: 'int-send-composer', title: 'Send selection to composer', kind: 'block' },
    { id: 'int-save-graph', title: 'Save selection to the graph', kind: 'block' },
  ],
};

/**
 * The same file while the index is cold. Findings are absent because they are
 * unknown, and the response says so; it is not an empty clean file.
 */
export const FIXTURE_COLD_INDEX: FileIntelligence = {
  uri: FIXTURE_URI,
  generation: FIXTURE_GENERATION - 1,
  diagnostics: [],
  tokens: [],
  inlayHints: [],
  intentions: [],
  degradation: {
    level: 'reduced',
    code: 'editor_index_cold',
    missing: ['theorem.inference', 'theorem.shapes'],
  },
};

export const FIXTURE_READINESS_COLD: ReadinessState = {
  ready: false,
  pending: ['theorem.inference', 'theorem.shapes'],
  generation: FIXTURE_GENERATION - 1,
};

export const FIXTURE_READINESS_WARM: ReadinessState = {
  ready: true,
  pending: [],
  generation: FIXTURE_GENERATION,
};

/**
 * Preview and applied result of the one fixture fix. V2 requires these to be
 * the same edits, which is why one constant serves both calls.
 */
export const FIXTURE_FIX_PREVIEW: FixPreview = {
  fixId: 'fix-annotate-accumulator',
  uri: FIXTURE_URI,
  generation: FIXTURE_GENERATION,
  edits: [
    {
      range: { start: { line: 1, character: 9 }, end: { line: 1, character: 9 } },
      newText: ': number',
    },
  ],
};

/** The fixture source with the fix applied, for round-trip assertions. */
export const FIXTURE_SOURCE_FIXED = FIXTURE_SOURCE.replace('let sum = 0;', 'let sum: number = 0;');
