// SOURCING: none. Free geometry and header-fit guards.

import { describe, expect, it } from 'vitest';
import {
  BLOCK_SIZE_SPAN,
  clampGeometry,
  geometryFromSize,
  limitsFailHeaderFit,
  packOrigin,
  packOrigins,
  resolveLimits,
  sizesFailingHeaderFit,
} from './block-geometry';

describe('block-geometry', () => {
  it('maps named sizes to spans for initial placement', () => {
    expect(BLOCK_SIZE_SPAN.m).toEqual({ cols: 4, rows: 3 });
    expect(geometryFromSize('w')).toEqual({
      col: 1,
      row: 1,
      colSpan: 6,
      rowSpan: 3,
    });
  });

  it('clamps free geometry by limits and canvas bounds', () => {
    expect(
      clampGeometry(
        { col: 10, row: 1, colSpan: 8, rowSpan: 1 },
        { minCols: 2, minRows: 2, maxCols: 12 },
      ),
    ).toEqual({ col: 5, row: 1, colSpan: 8, rowSpan: 2 });
  });

  it('allows vertical growth independent of named presets', () => {
    const tall = clampGeometry(
      { col: 1, row: 1, colSpan: 4, rowSpan: 7 },
      { minCols: 2, minRows: 2 },
    );
    expect(tall.colSpan).toBe(4);
    expect(tall.rowSpan).toBe(7);
  });

  it('floors minRows at header-fit', () => {
    expect(resolveLimits({ minCols: 1, minRows: 0 }).minRows).toBe(1);
    expect(limitsFailHeaderFit({ minCols: 1, minRows: 1 })).toBe(false);
    expect(sizesFailingHeaderFit(['s', 'm', 'v', 'sq', 'w', 'full'])).toEqual([]);
  });

  it('packs seed origins left to right then next row', () => {
    expect(packOrigin(0, 'm')).toEqual({ col: 1, row: 1 });
    expect(packOrigin(1, 'm')).toEqual({ col: 5, row: 1 });
    expect(packOrigin(2, 'm')).toEqual({ col: 9, row: 1 });
    expect(packOrigin(3, 'm')).toEqual({ col: 1, row: 4 });
    expect(packOrigin(0, 'w')).toEqual({ col: 1, row: 1 });
    expect(packOrigin(1, 'w')).toEqual({ col: 7, row: 1 });
    expect(packOrigin(2, 'w')).toEqual({ col: 1, row: 4 });
  });

  it('packs mixed sizes without overlap', () => {
    expect(packOrigins(['w', 'm'])).toEqual([
      { col: 1, row: 1 },
      { col: 7, row: 1 },
    ]);
    expect(packOrigins(['w', 'w', 'm'])).toEqual([
      { col: 1, row: 1 },
      { col: 7, row: 1 },
      { col: 1, row: 4 },
    ]);
  });

  it('caps maxCols to the canvas width', () => {
    expect(resolveLimits({ minCols: 1, minRows: 1, maxCols: 99 }).maxCols).toBe(12);
  });
});
