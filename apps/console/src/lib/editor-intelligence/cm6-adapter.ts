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
 * generation. The conversion that actually drifts is position encoding, because
 * CM6 addresses a document by absolute offset while the wire and VS Code both
 * speak line and character. That conversion lives here, once, and the parity
 * fixture is what keeps it honest.
 */

import type {
  FileIntelligence,
  Position,
  Range,
  SemanticTokenSpan,
} from '@commonplace/block-view-contracts/editor-intelligence';

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
 * Line start offsets for a document, index 0 being line 0.
 *
 * Built once per conversion rather than per finding: a file with a thousand
 * findings would otherwise rescan the text a thousand times.
 */
export function lineOffsets(text: string): number[] {
  const offsets = [0];
  for (let index = 0; index < text.length; index += 1) {
    if (text[index] === '\n') offsets.push(index + 1);
  }
  return offsets;
}

/**
 * Line/character to absolute offset.
 *
 * A position past the end of the document clamps to the document length rather
 * than producing a negative or out-of-range offset: CM6 throws on those, and a
 * stale position arriving one generation late is an ordinary event, not a bug
 * worth crashing the editor over.
 */
export function toOffset(position: Position, offsets: readonly number[], length: number): number {
  const lineStart = offsets[Math.min(Math.max(position.line, 0), offsets.length - 1)] ?? 0;
  return Math.min(lineStart + Math.max(position.character, 0), length);
}

export function rangeToOffsets(
  range: Range,
  offsets: readonly number[],
  length: number,
): { from: number; to: number } {
  const from = toOffset(range.start, offsets, length);
  const to = toOffset(range.end, offsets, length);
  return from <= to ? { from, to } : { from: to, to: from };
}

const SEVERITY = {
  error: 'error',
  warning: 'warning',
  information: 'info',
  hint: 'hint',
} as const;

export function toCm6Diagnostics(
  intelligence: FileIntelligence,
  text: string,
): Cm6Diagnostic[] {
  const offsets = lineOffsets(text);
  return intelligence.diagnostics.map((finding) => {
    const { from, to } = rangeToOffsets(finding.range, offsets, text.length);
    return {
      from,
      to,
      severity: SEVERITY[finding.severity],
      message: finding.message,
      source: finding.source,
    };
  });
}

/** Token spans as decoration ranges, in document order. */
export function toCm6Tokens(
  spans: readonly SemanticTokenSpan[],
  text: string,
): Cm6TokenRange[] {
  const offsets = lineOffsets(text);
  return [...spans]
    .map((span) => {
      const { from, to } = rangeToOffsets(span.range, offsets, text.length);
      const modifiers = (span.modifiers ?? []).map((modifier) => `cm-tm-${modifier}`).join(' ');
      return {
        from,
        to,
        className: modifiers ? `cm-t-${span.type} ${modifiers}` : `cm-t-${span.type}`,
      };
    })
    .sort((a, b) => a.from - b.from || a.to - b.to);
}
