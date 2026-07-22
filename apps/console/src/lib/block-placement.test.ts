import { describe, expect, it } from 'vitest';
import {
  placeBlockAction,
  readBlockSize,
  reorderBlockActions,
} from './block-placement';

describe('block placement', () => {
  it('reorders by emitting move actions for the full sibling list', () => {
    const actions = reorderBlockActions('grid-1', ['a', 'b', 'c'], 'c', 'a');
    expect(actions).toEqual([
      { kind: 'move', id: 'c', new_parent: 'grid-1', order: 0 },
      { kind: 'move', id: 'a', new_parent: 'grid-1', order: 1 },
      { kind: 'move', id: 'b', new_parent: 'grid-1', order: 2 },
    ]);
  });

  it('promotes to full with size and geometry when requested', () => {
    const actions = placeBlockAction('vi-1', {
      placement: 'full',
      regionId: 'editor-1',
      order: 0,
      size: 'full',
    });
    expect(actions[0]).toEqual({ kind: 'move', id: 'vi-1', new_parent: 'editor-1', order: 0 });
    expect(actions[1]).toMatchObject({
      kind: 'update',
      id: 'vi-1',
      patch: {
        config: {
          size: 'full',
          geometry: { col: 1, row: 1, colSpan: 12, rowSpan: 12 },
        },
      },
    });
  });

  it('reads BlockSize from view-instance config', () => {
    expect(
      readBlockSize({
        id: 'vi',
        type: 'view-instance',
        properties: { config: { size: 'w' } },
      }),
    ).toBe('w');
    expect(
      readBlockSize({ id: 'vi', type: 'view-instance', properties: {} }, 'm'),
    ).toBe('m');
  });
});
