'use client';

// SOURCING: hand-roll; additive-ink highlight overlay positioned from the coannotate
// geometry contract. Consumes @commonplace/coannotate (resolveQuoteRectsInRoot) plus
// ../../../lib/margin-recall/overlay-model (placement policy). DOM-mutating highlighters
// (web-highlighter, mark.js, rangy, annotorious) are excluded by the spec's "additive
// ink only, no restyling page content" non-goal, so no upstream component models this
// surface: it paints a separate layer, it never wraps or edits the page's own nodes.

import { useCallback, useEffect, useState, type RefObject } from 'react';
import { resolveQuoteRectsInRoot, type Rect } from '@commonplace/coannotate';
import { usePrefersReducedMotion } from '@/hooks/usePrefersReducedMotion';
import {
  placeHighlights,
  clipRect,
  type MarginCandidate,
  type PlacedHighlight,
} from '@/lib/margin-recall/overlay-model';
import styles from './MarginOverlay.module.css';

export interface MarginOverlayProps {
  /** The scrollable reader content root the quotes resolve within. */
  rootRef: RefObject<HTMLElement | null>;
  /** Salience candidates (from D2). An empty list paints nothing (honest empty state). */
  candidates: readonly MarginCandidate[];
  /** Max highlights painted (the spec budget is 5). */
  budget?: number;
}

interface OverlayRender {
  placed: PlacedHighlight[];
  /** The reader's visible box, in viewport coordinates, that marks are clipped to. */
  bounds: Rect | null;
}

const EMPTY: OverlayRender = { placed: [], bounds: null };

/**
 * D4 highlight overlay. Paints salience candidates as a faint gold tint over the
 * passages they anchor to: no chrome until hover, fading in per the motion tokens when
 * the pipeline returns, static under reduced motion. Purely additive (the page's own
 * nodes are never touched); interaction (click to the full connection) is D6, so this
 * layer is presentational and marked aria-hidden, with the accessible affordance living
 * in the D5 margin note rather than duplicated here.
 *
 * The tint uses mix-blend-mode multiply so it darkens toward the ink like a highlighter
 * and never lowers the text's contrast. Marks are positioned in viewport coordinates
 * (Range.getClientRects is viewport-relative) inside a fixed, click-through layer, and
 * re-resolved on scroll, resize, and reflow so they stay glued to their passages.
 */
export default function MarginOverlay({ rootRef, candidates, budget }: MarginOverlayProps) {
  const reducedMotion = usePrefersReducedMotion();
  const [render, setRender] = useState<OverlayRender>(EMPTY);

  const resolve = useCallback(() => {
    const root = rootRef.current;
    if (!root || candidates.length === 0) {
      setRender(EMPTY);
      return;
    }
    const box = root.getBoundingClientRect();
    const bounds: Rect = { x: box.x, y: box.y, width: box.width, height: box.height };
    const placed = placeHighlights(
      candidates,
      (quote, hint) => resolveQuoteRectsInRoot(root, quote, hint),
      budget != null ? { budget } : {},
    );
    setRender({ placed, bounds });
  }, [rootRef, candidates, budget]);

  useEffect(() => {
    resolve();
    const root = rootRef.current;
    if (!root) return;
    const onChange = () => resolve();
    root.addEventListener('scroll', onChange, { passive: true });
    window.addEventListener('resize', onChange);
    // Reflow when the reader content itself changes size (font size, panels opening).
    const observer = new ResizeObserver(onChange);
    observer.observe(root);
    return () => {
      root.removeEventListener('scroll', onChange);
      window.removeEventListener('resize', onChange);
      observer.disconnect();
    };
  }, [resolve, rootRef]);

  const { placed, bounds } = render;
  if (placed.length === 0 || bounds === null) return null;

  return (
    <div className={styles.layer} aria-hidden="true">
      {placed.flatMap((highlight) =>
        highlight.rects.map((rect, i) => {
          const clipped = clipRect(rect, bounds);
          if (clipped === null) return null;
          return (
            <span
              key={`${highlight.id}:${i}`}
              className={reducedMotion ? `${styles.mark} ${styles.static}` : styles.mark}
              data-tier={highlight.tier}
              style={{ left: clipped.x, top: clipped.y, width: clipped.width, height: clipped.height }}
            />
          );
        }),
      )}
    </div>
  );
}
