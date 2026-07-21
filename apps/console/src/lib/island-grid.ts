// SOURCING: none. Pure logic. 12-column island grid spans from
// HANDOFF-CONSOLE-ISLAND-SHELL named choice 8 / BlockSize grammar.

import type { BlockSize } from '@commonplace/block-view/types';

/** Column × row spans on the 12-column island grid. */
export const BLOCK_SIZE_SPAN: Readonly<Record<BlockSize, { cols: number; rows: number }>> = {
  s: { cols: 3, rows: 2 },
  m: { cols: 4, rows: 3 },
  v: { cols: 3, rows: 5 },
  sq: { cols: 4, rows: 4 },
  w: { cols: 6, rows: 3 },
  full: { cols: 12, rows: 12 },
};

/** Minimum pixel size that keeps the island header legible (cozy 36px band). */
export const ISLAND_HEADER_MIN_PX = 36;

/** Track height for one grid row unit (header + body minimum). */
export const ISLAND_ROW_UNIT_PX = 72;

export function spanForSize(size: BlockSize): { cols: number; rows: number } {
  return BLOCK_SIZE_SPAN[size];
}

/** CSS grid placement for a declared size. */
export function gridStyleForSize(size: BlockSize): {
  gridColumn: string;
  gridRow: string;
  minHeight: string;
} {
  const span = BLOCK_SIZE_SPAN[size];
  return {
    gridColumn: `span ${span.cols}`,
    gridRow: `span ${span.rows}`,
    minHeight: `${Math.max(ISLAND_HEADER_MIN_PX + 48, span.rows * ISLAND_ROW_UNIT_PX)}px`,
  };
}

/**
 * Snap a freeform pixel size to the nearest declared BlockSize that still fits
 * the header minimum. Prefers the declared list order when distances tie.
 */
export function snapToDeclaredSize(
  widthPx: number,
  heightPx: number,
  declared: readonly BlockSize[],
  columnWidthPx: number,
): BlockSize {
  if (declared.length === 0) return 'm';
  const colW = Math.max(columnWidthPx, 1);
  let best = declared[0]!;
  let bestDistance = Number.POSITIVE_INFINITY;
  for (const size of declared) {
    const span = BLOCK_SIZE_SPAN[size];
    const targetW = span.cols * colW;
    const targetH = span.rows * ISLAND_ROW_UNIT_PX;
    if (targetH < ISLAND_HEADER_MIN_PX) continue;
    const distance = Math.hypot(widthPx - targetW, heightPx - targetH);
    if (distance < bestDistance) {
      bestDistance = distance;
      best = size;
    }
  }
  return best;
}

/**
 * Dev registration guard: every declared size must leave room for the header.
 * Returns the failing size ids, empty when all sizes are legal.
 */
export function sizesFailingHeaderFit(declared: readonly BlockSize[]): readonly BlockSize[] {
  return declared.filter((size) => {
    const span = BLOCK_SIZE_SPAN[size];
    return span.rows * ISLAND_ROW_UNIT_PX < ISLAND_HEADER_MIN_PX;
  });
}
