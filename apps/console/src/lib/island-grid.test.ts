// SOURCING: none. Pure logic.
import { describe, expect, it } from 'vitest';
import {
  BLOCK_SIZE_SPAN,
  gridStyleForSize,
  sizesFailingHeaderFit,
  snapToDeclaredSize,
} from './island-grid';

describe('island grid', () => {
  it('maps BlockSize to the 12-column spans', () => {
    expect(BLOCK_SIZE_SPAN.s).toEqual({ cols: 3, rows: 2 });
    expect(BLOCK_SIZE_SPAN.m).toEqual({ cols: 4, rows: 3 });
    expect(BLOCK_SIZE_SPAN.v).toEqual({ cols: 3, rows: 5 });
    expect(BLOCK_SIZE_SPAN.sq).toEqual({ cols: 4, rows: 4 });
    expect(BLOCK_SIZE_SPAN.w).toEqual({ cols: 6, rows: 3 });
    expect(BLOCK_SIZE_SPAN.full).toEqual({ cols: 12, rows: 12 });
  });

  it('emits CSS grid placement for a size', () => {
    expect(gridStyleForSize('m')).toMatchObject({
      gridColumn: 'span 4',
      gridRow: 'span 3',
    });
  });

  it('snaps freeform dimensions to the nearest declared size', () => {
    expect(snapToDeclaredSize(400, 220, ['s', 'm', 'w'], 100)).toBe('m');
    expect(snapToDeclaredSize(620, 220, ['s', 'm', 'w'], 100)).toBe('w');
  });

  it('reports no header-fit failures for the grammar spans', () => {
    expect(sizesFailingHeaderFit(['s', 'm', 'v', 'sq', 'w', 'full'])).toEqual([]);
  });
});
