'use client';

// SOURCING: hand-roll; the D5 margin notes surface. Consumes ../../../lib/margin-recall/
// margin-notes (layout policy) and overlay-model (PlacedHighlight geometry). No upstream
// component models "a note anchored beside its highlight that collapses to a gutter chip when
// narrow and spills overflow into a per-page list"; it is product policy over the D4 geometry
// contract. Honest scaffold: not mounted into a live reader until D2 feeds real candidates
// (the same gate as MarginOverlay), per the no-fake-UI rule.

import { useEffect, useMemo, useState, type RefObject } from 'react';
import { usePrefersReducedMotion } from '@/hooks/usePrefersReducedMotion';
import type { PlacedHighlight } from '@/lib/margin-recall/overlay-model';
import {
  collapsedLine,
  layoutMarginNotes,
  type MarginNote,
} from '@/lib/margin-recall/margin-notes';
import styles from './MarginNotes.module.css';

export interface MarginNotesProps {
  /** The overlay's placed highlights (D4 output): each carries the passage rects and the
   * connection explanation the note shows. */
  placed: readonly PlacedHighlight[];
  /** The physical margin column the notes live in, for its box and width. */
  marginRef: RefObject<HTMLElement | null>;
  /** Below this width the column collapses to gutter chips (D5-1). */
  minNoteWidth?: number;
}

/**
 * D5 margin notes. Each highlight owns a note in the physical margin, aligned to its passage
 * and pushed down only when notes crowd (layoutMarginNotes); when the margin is too narrow the
 * column collapses to one-line chips; anything past the bottom stacks into a compact per-page
 * list ordered by document position (D5-4). Re-lays out on scroll and resize so notes stay
 * beside their passages; static under reduced motion. Presentational: replying (D5-2) is wired
 * through the chat agent route by the mount, not here.
 */
export default function MarginNotes({ placed, marginRef, minNoteWidth }: MarginNotesProps) {
  const reducedMotion = usePrefersReducedMotion();
  const [tick, setTick] = useState(0);

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
      {layout.placements.map((placement) => (
        <article
          key={placement.id}
          className={layout.mode === 'chips' ? `${baseClass} ${styles.chip}` : baseClass}
          data-tier={placement.note.tier}
          style={{ top: placement.y }}
        >
          {layout.mode === 'chips'
            ? collapsedLine(placement.note)
            : placement.note.explanation}
        </article>
      ))}
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
