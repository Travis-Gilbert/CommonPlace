'use client';

// SOURCING: hand-roll; the D5 margin notes surface plus its D6-1/2 interactions. Consumes
// ../../../lib/margin-recall/margin-notes (layout policy), interaction (hover/select reducer),
// provenance (the D6-2 connection chain), and overlay-model (PlacedHighlight geometry). No
// upstream component models "a note anchored beside its highlight that previews on hover,
// expands to an openable provenance chain, collapses to a gutter chip when narrow, and spills
// overflow into a per-page list"; it is product policy over the D4 geometry contract. Honest
// scaffold: not mounted into a live reader until D2 feeds real candidates (the same gate as
// MarginOverlay), per the no-fake-UI rule.

import { useEffect, useMemo, useReducer, useState, type RefObject } from 'react';
import { usePrefersReducedMotion } from '@/hooks/usePrefersReducedMotion';
import type { PlacedHighlight } from '@/lib/margin-recall/overlay-model';
import {
  collapsedLine,
  layoutMarginNotes,
  type MarginNote,
} from '@/lib/margin-recall/margin-notes';
import {
  highlightInteraction,
  IDLE_INTERACTION,
  noteMode,
} from '@/lib/margin-recall/interaction';
import { connectionProvenance } from '@/lib/margin-recall/provenance';
import styles from './MarginNotes.module.css';

export interface MarginNotesProps {
  /** The overlay's placed highlights (D4 output): each carries the passage rects, the
   * connection explanation the note shows, and the records it links to. */
  placed: readonly PlacedHighlight[];
  /** The physical margin column the notes live in, for its box and width. */
  marginRef: RefObject<HTMLElement | null>;
  /** Below this width the column collapses to gutter chips (D5-1). */
  minNoteWidth?: number;
  /** Open a referenced record from an expanded connection (D6-2). The mount wires this to the
   * record navigation (the ReceiptRail pattern). Omitted, the chain renders read-only rather
   * than shipping buttons that do nothing. */
  onOpenRecord?: (recordId: string) => void;
}

/**
 * D5 margin notes with D6 gestures. Each highlight owns a note aligned to its passage, pushed
 * down only when notes crowd; a narrow margin collapses them to one-line chips; overflow stacks
 * into a doc-ordered per-page list (D5-4). Hover previews the connection and a click or tap
 * expands it to the full chain (D6-1/2): what it links to, why, and how it was drawn, each
 * record openable. Re-lays out on scroll and resize; static under reduced motion.
 */
export default function MarginNotes({
  placed,
  marginRef,
  minNoteWidth,
  onOpenRecord,
}: MarginNotesProps) {
  const reducedMotion = usePrefersReducedMotion();
  const [tick, setTick] = useState(0);
  const [interaction, dispatch] = useReducer(highlightInteraction, IDLE_INTERACTION);

  useEffect(() => {
    const margin = marginRef.current;
    if (!margin) return;
    const bump = () => setTick((value) => value + 1);
    window.addEventListener('resize', bump);
    const observer = new ResizeObserver(bump);
    observer.observe(margin);
    return () => {
      window.removeEventListener('resize', bump);
      observer.disconnect();
    };
  }, [marginRef]);

  const layout = useMemo(() => {
    const margin = marginRef.current;
    if (!margin || placed.length === 0) return null;
    const box = margin.getBoundingClientRect();
    const notes: MarginNote[] = placed
      .map((highlight): MarginNote | null => {
        const rect = highlight.rects[0];
        if (!rect) return null;
        return {
          id: highlight.id,
          explanation: highlight.candidate.explanation,
          anchorY: rect.y - box.top,
          tier: highlight.tier,
          refs: highlight.candidate.refs,
        };
      })
      .filter((note): note is MarginNote => note !== null);
    return layoutMarginNotes(
      notes,
      { top: 0, height: box.height },
      { marginWidth: box.width, ...(minNoteWidth != null ? { minNoteWidth } : {}) },
    );
    // `tick` forces recompute on scroll/resize; marginRef.current is read imperatively.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [placed, marginRef, minNoteWidth, tick]);

  if (!layout || (layout.placements.length === 0 && layout.overflow.length === 0)) {
    return null;
  }

  const baseClass = reducedMotion ? `${styles.note} ${styles.static}` : styles.note;

  return (
    <div className={styles.column}>
      {layout.placements.map((placement) => {
        const mode = noteMode(interaction, placement.id);
        const expanded = mode === 'expanded';
        const provenance = expanded ? connectionProvenance(placement.note) : null;
        return (
          <article
            key={placement.id}
            className={layout.mode === 'chips' ? `${baseClass} ${styles.chip}` : baseClass}
            data-tier={placement.note.tier}
            data-mode={mode}
            style={{ top: placement.y }}
            onPointerEnter={() => dispatch({ type: 'hover', id: placement.id })}
            onPointerLeave={() => dispatch({ type: 'leave', id: placement.id })}
          >
            <button
              type="button"
              className={styles.trigger}
              aria-expanded={expanded}
              onClick={() => dispatch({ type: 'select', id: placement.id })}
            >
              {mode === 'idle' ? collapsedLine(placement.note) : placement.note.explanation}
            </button>
            {provenance && (
              <div className={styles.chain}>
                <div className={styles.basis}>{provenance.basis}</div>
                {provenance.hasChain ? (
                  provenance.records.map((record) =>
                    onOpenRecord ? (
                      <button
                        key={record}
                        type="button"
                        className={styles.record}
                        onClick={() => onOpenRecord(record)}
                      >
                        {record}
                      </button>
                    ) : (
                      <span key={record} className={styles.recordStatic}>
                        {record}
                      </span>
                    ),
                  )
                ) : (
                  <div className={styles.basis}>No linked record to open.</div>
                )}
              </div>
            )}
          </article>
        );
      })}
      {layout.overflow.length > 0 && (
        <section className={styles.overflow} aria-label="More connections on this page">
          {layout.overflow.map((note) => (
            <div key={note.id} className={styles.overflowItem} data-tier={note.tier}>
              {collapsedLine(note)}
            </div>
          ))}
        </section>
      )}
    </div>
  );
}
