// SOURCING: none. Pure logic. Free BlockGeometry on the 12-column canvas
// (HANDOFF-CONSOLE-ONE-BLOCK-MODEL named choice 3). Named BlockSize values are
// initial defaults and reset targets only, never the constraint set.

import type {
  BlockGeometry,
  BlockLimits,
  BlockSize,
} from '@commonplace/block-view/types';

/** Column × row spans used when placing from a named defaultSize. */
export const BLOCK_SIZE_SPAN: Readonly<Record<BlockSize, { cols: number; rows: number }>> = {
  s: { cols: 3, rows: 2 },
  m: { cols: 4, rows: 3 },
  v: { cols: 3, rows: 5 },
  sq: { cols: 4, rows: 4 },
  w: { cols: 6, rows: 3 },
  full: { cols: 12, rows: 12 },
};

/** Minimum pixel size that keeps the block header legible (cozy 36px band). */
export const BLOCK_HEADER_MIN_PX = 36;

/** Track height for one canvas row unit (header + body minimum). */
export const BLOCK_ROW_UNIT_PX = 72;

export const CANVAS_COLS = 12;

/** Rows required so header-fit guard passes (1 × 72px ≥ 36px). */
export const HEADER_FIT_MIN_ROWS = 1;

export function spanForSize(size: BlockSize): { cols: number; rows: number } {
  return BLOCK_SIZE_SPAN[size];
}

/** Geometry taken when a block is first placed from its defaultSize. */
export function geometryFromSize(
  size: BlockSize,
  origin: { col?: number; row?: number } = {},
): BlockGeometry {
  const span = BLOCK_SIZE_SPAN[size];
  return {
    col: origin.col ?? 1,
    row: origin.row ?? 1,
    colSpan: span.cols,
    rowSpan: span.rows,
  };
}

/** Effective limits: descriptor limits with header-fit floor on minRows. */
export function resolveLimits(limits?: BlockLimits): BlockLimits {
  return {
    minCols: Math.max(1, limits?.minCols ?? 1),
    minRows: Math.max(HEADER_FIT_MIN_ROWS, limits?.minRows ?? HEADER_FIT_MIN_ROWS),
    maxCols: limits?.maxCols ?? CANVAS_COLS,
    maxRows: limits?.maxRows,
  };
}

/** Clamp free geometry into canvas and descriptor limits. */
export function clampGeometry(
  geometry: BlockGeometry,
  limits?: BlockLimits,
): BlockGeometry {
  const resolved = resolveLimits(limits);
  const maxCols = resolved.maxCols ?? CANVAS_COLS;
  const colSpan = Math.min(
    maxCols,
    Math.max(resolved.minCols, Math.round(geometry.colSpan)),
  );
  const rowSpan = Math.min(
    resolved.maxRows ?? Number.POSITIVE_INFINITY,
    Math.max(resolved.minRows, Math.round(geometry.rowSpan)),
  );
  const col = Math.min(
    CANVAS_COLS - colSpan + 1,
    Math.max(1, Math.round(geometry.col)),
  );
  const row = Math.max(1, Math.round(geometry.row));
  return { col, row, colSpan, rowSpan };
}

/** CSS grid placement for free geometry (1-based col/row). */
export function gridStyleForGeometry(geometry: BlockGeometry): {
  gridColumn: string;
  gridRow: string;
  minHeight: string;
} {
  return {
    gridColumn: `${geometry.col} / span ${geometry.colSpan}`,
    gridRow: `${geometry.row} / span ${geometry.rowSpan}`,
    minHeight: `${Math.max(BLOCK_HEADER_MIN_PX + 48, geometry.rowSpan * BLOCK_ROW_UNIT_PX)}px`,
  };
}

/** @deprecated Prefer gridStyleForGeometry; kept for size-reset helpers. */
export function gridStyleForSize(size: BlockSize): {
  gridColumn: string;
  gridRow: string;
  minHeight: string;
} {
  return gridStyleForGeometry(geometryFromSize(size));
}

/**
 * Dev registration guard: defaultSize must leave room for the header.
 * Returns failing size ids, empty when legal.
 */
export function sizesFailingHeaderFit(declared: readonly BlockSize[]): readonly BlockSize[] {
  return declared.filter((size) => {
    const span = BLOCK_SIZE_SPAN[size];
    return span.rows * BLOCK_ROW_UNIT_PX < BLOCK_HEADER_MIN_PX;
  });
}

/** True when limits cannot fit the header band. */
export function limitsFailHeaderFit(limits?: BlockLimits): boolean {
  const resolved = resolveLimits(limits);
  return resolved.minRows * BLOCK_ROW_UNIT_PX < BLOCK_HEADER_MIN_PX;
}
