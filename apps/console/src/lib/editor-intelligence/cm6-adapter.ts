// SOURCING: CodeMirror 6 (@codemirror/lint diagnostic shape, @codemirror/view
// decoration ranges), already this console's editor stack. Shapes are declared
// structurally rather than imported so this module stays free of a React or DOM
// import and can run in the parity test's node lane; the console editor passes
// these values straight into lint() and Decoration.set().
/**
 * The console's front of the editor intelligence surface.
 *
 * SPEC-COMMONPLACE-VSCODE-SURFACE-1.0 V8 is one store and two fronts: this one
 * and the VS Code pack must render the same fixture identically at the same
 * generation.
 *
 * The conversion that actually drifts is position encoding. The surface
 * measures every span as a UTF-8 byte offset into the bytes it indexed, while
 * CM6 addresses a document by absolute offset in UTF-16 code units. Those two
 * agree exactly on ASCII and diverge on the first multi byte character, so the
 * conversion is not optional and it is not local to this file: both fronts call
 * the same `editor-offsets` module, which is what makes parity a property of
 * one implementation rather than an agreement between two.
 *
 * VS Code positions are also UTF-16, so the pack converts byte to UTF-16 and
 * then to line and character, while this front stops at the UTF-16 offset CM6
 * wants. Same conversion, one step shorter.
 */

import type {
  DiagnosticsPayload,
  EditorSeverity,
  SemanticToken,
} from '@commonplace/block-view-contracts/editor-intelligence';
import type { ContentDrift, OffsetTable } from '@commonplace/block-view-contracts/editor-offsets';
import { resolveOffsets, toUtf16Span } from '@commonplace/block-view-contracts/editor-offsets';

/** Structural mirror of @codemirror/lint's Diagnostic. */
export interface Cm6Diagnostic {
  readonly from: number;
  readonly to: number;
  readonly severity: 'error' | 'warning' | 'info' | 'hint';
  readonly message: string;
  readonly source: string;
}

/** A decoration range: what Decoration.mark().range(from, to) is built from. */
export interface Cm6TokenRange {
  readonly from: number;
  readonly to: number;
  /** Class name the register theme styles, e.g. `cm-t-function`. */
  readonly className: string;
}

/**
 * CM6 severities, which stop at three levels.
 *
 * The surface distinguishes `fatal` from `error`; CM6 does not, so `fatal`
 * collapses upward and stays at least as loud as an error rather than
 * disappearing into `info`.
 */
const SEVERITY: Record<EditorSeverity, Cm6Diagnostic['severity']> = {
  info: 'info',
  warning: 'warning',
  error: 'error',
  fatal: 'error',
};

/**
 * Byte span to CM6 offsets.
 *
 * Exported because the console editor converts fix edits and selection ranges
 * through the same path, and a second conversion is a second place to be wrong.
 */
export function toCm6Range(
  table: OffsetTable,
  startByte: number,
  endByte: number,
): { from: number; to: number } {
  const { start, end } = toUtf16Span(table, startByte, endByte);
  return { from: start, to: end };
}

/**
 * Decide whether a payload may be drawn on `text`, once per repaint.
 *
 * Returns the drift instead of a table when the buffer has moved past the bytes
 * the answer describes. The caller renders nothing and says why: findings drawn
 * at offsets measured against different bytes land under the wrong words with
 * nothing on screen to admit it.
 */
export function resolveForDocument(
  payload: { readonly contentHash: string; readonly content?: string | null },
  text: string,
): { readonly table: OffsetTable; readonly drift: null } | { readonly table: null; readonly drift: ContentDrift } {
  return resolveOffsets(payload, text);
}

export function toCm6Diagnostics(payload: DiagnosticsPayload, text: string): Cm6Diagnostic[] {
  const resolved = resolveOffsets(payload, text);
  if (!resolved.table) return [];
  const table = resolved.table;
  return payload.diagnostics.map((finding) => {
    const { from, to } = toCm6Range(table, finding.startByte, finding.endByte);
    return {
      from,
      to,
      severity: SEVERITY[finding.severity] ?? 'info',
      message: finding.message,
      source: finding.detector,
    };
  });
}

/** Token spans as decoration ranges, in document order. */
export function toCm6Tokens(
  spans: readonly SemanticToken[],
  table: OffsetTable,
): Cm6TokenRange[] {
  return [...spans]
    .map((span) => {
      const { from, to } = toCm6Range(table, span.startByte, span.endByte);
      const modifiers = span.modifiers.map((modifier) => `cm-tm-${modifier}`).join(' ');
      return {
        from,
        to,
        className: modifiers ? `cm-t-${span.tokenType} ${modifiers}` : `cm-t-${span.tokenType}`,
      };
    })
    .sort((a, b) => a.from - b.from || a.to - b.to);
}
