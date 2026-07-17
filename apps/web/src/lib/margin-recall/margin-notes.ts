// SOURCING: none; the pure placement half of the D5 margin notes (HANDOFF-MARGIN-RECALL).
// No upstream library models "anchor a note to its highlight, stack on collision, collapse to
// chips when narrow, spill the rest into a doc-ordered list"; it is product policy over the
// D4 geometry, so it stays hand-written and node-tested (the same shape as overlay-model.ts).
// Carries no DOM: the React mount (MarginNotes.tsx) only renders what this returns.

import type { SalienceTier } from './select';

/** A note to place in the margin: its connection text, tier, and the document-position anchor
 * (the top y of its highlight's first rect, in the reader's coordinate space). */
export interface MarginNote {
  id: string;
  explanation: string;
  anchorY: number;
  tier: SalienceTier;
}

/** The reader's margin box in the same coordinate space as `anchorY`. */
export interface MarginBox {
  top: number;
  height: number;
}

/** A note resolved to a non-overlapping vertical position inside the margin. */
export interface NotePlacement {
  id: string;
  /** Collision-adjusted top y: the note's anchorY when there is room, pushed down otherwise. */
  y: number;
  note: MarginNote;
}

export interface MarginLayout {
  /** `notes` when the margin is wide enough; `chips` collapses each to a one-line gutter chip
   * (D5-1). Rendering differs; placement does not. */
  mode: 'notes' | 'chips';
  /** Positioned, non-overlapping notes that fit within the box, in document order. */
  placements: NotePlacement[];
  /** Notes that did not fit, for the compact per-page list, in document order (D5-4). */
  overflow: MarginNote[];
}

export interface MarginLayoutOptions {
  /** Available margin width; below `minNoteWidth` the layout collapses to chips (D5-1). */
  marginWidth: number;
  minNoteWidth?: number;
  /** Vertical space one note/chip reserves. */
  noteHeight?: number;
  /** Gap between stacked notes. */
  gap?: number;
}

const DEFAULT_MIN_NOTE_WIDTH = 220;
const DEFAULT_NOTE_HEIGHT = 64;
const DEFAULT_GAP = 8;

/**
 * Lay out margin notes: order by document position, anchor each to its highlight, push a note
 * down only when it would overlap the one above (so a note sits beside its passage whenever
 * there is room, and the column stays readable when passages crowd), and spill anything past
 * the margin's bottom into `overflow`. Pure and deterministic, so scroll/resize behavior is
 * unit-tested rather than eyeballed.
 */
export function layoutMarginNotes(
  notes: readonly MarginNote[],
  box: MarginBox,
  opts: MarginLayoutOptions,
): MarginLayout {
  const minNoteWidth = opts.minNoteWidth ?? DEFAULT_MIN_NOTE_WIDTH;
  const noteHeight = opts.noteHeight ?? DEFAULT_NOTE_HEIGHT;
  const gap = opts.gap ?? DEFAULT_GAP;
  const mode: 'notes' | 'chips' = opts.marginWidth >= minNoteWidth ? 'notes' : 'chips';

  const ordered = [...notes].sort(
    (left, right) => left.anchorY - right.anchorY || left.id.localeCompare(right.id),
  );

  const placements: NotePlacement[] = [];
  const overflow: MarginNote[] = [];
  const bottomLimit = box.top + box.height;
  let cursor = box.top;

  for (const note of ordered) {
    const y = Math.max(note.anchorY, cursor);
    if (y + noteHeight > bottomLimit) {
      overflow.push(note);
      continue;
    }
    placements.push({ id: note.id, y, note });
    cursor = y + noteHeight + gap;
  }

  return { mode, placements, overflow };
}

/** The collapsed one-line form of a note (the named connection, D5-1): the first sentence of
 * the explanation, trimmed to a single line for a gutter chip or the overflow list. */
export function collapsedLine(note: MarginNote, maxChars = 80): string {
  const firstSentence = note.explanation.split(/(?<=[.!?])\s/)[0] ?? note.explanation;
  const oneLine = firstSentence.replace(/\s+/g, ' ').trim();
  return oneLine.length > maxChars ? `${oneLine.slice(0, maxChars - 1).trimEnd()}…` : oneLine;
}
