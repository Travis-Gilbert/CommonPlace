// SOURCING: none. Vitest coverage for record focus ladder (RT5).

import { describe, expect, it } from 'vitest';
import {
  enterHardFocus,
  exitFocus,
  moveSoftFocus,
  type CellFocus,
} from './focus';

const ROWS = ['r1', 'r2', 'r3'] as const;
const FIELDS = ['title', 'status', 'updated'] as const;

describe('moveSoftFocus', () => {
  it('starts at the first cell when focus is null', () => {
    expect(moveSoftFocus(null, 'right', ROWS, FIELDS)).toEqual({
      rowId: 'r1',
      fieldKey: 'status',
      mode: 'soft',
    });
  });

  it('refuses movement past grid edges', () => {
    const corner: CellFocus = { rowId: 'r1', fieldKey: 'title', mode: 'soft' };
    expect(moveSoftFocus(corner, 'up', ROWS, FIELDS)).toBeNull();
    expect(moveSoftFocus(corner, 'left', ROWS, FIELDS)).toBeNull();
  });

  it('walks down the row ids', () => {
    const current: CellFocus = { rowId: 'r1', fieldKey: 'title', mode: 'soft' };
    expect(moveSoftFocus(current, 'down', ROWS, FIELDS)).toEqual({
      rowId: 'r2',
      fieldKey: 'title',
      mode: 'soft',
    });
  });
});

describe('enterHardFocus', () => {
  it('promotes soft focus to hard', () => {
    const current: CellFocus = { rowId: 'r2', fieldKey: 'status', mode: 'soft' };
    expect(enterHardFocus(current)).toEqual({
      rowId: 'r2',
      fieldKey: 'status',
      mode: 'hard',
    });
  });
});

describe('exitFocus', () => {
  it('drops hard focus back to soft', () => {
    const current: CellFocus = { rowId: 'r2', fieldKey: 'status', mode: 'hard' };
    expect(exitFocus(current)).toEqual({
      rowId: 'r2',
      fieldKey: 'status',
      mode: 'soft',
    });
  });

  it('clears soft focus', () => {
    const current: CellFocus = { rowId: 'r2', fieldKey: 'status', mode: 'soft' };
    expect(exitFocus(current)).toBeNull();
  });
});
