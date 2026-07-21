import { describe, expect, it } from 'vitest';
import {
  promoteIslandAction,
  readIslandSize,
  reorderIslandActions,
} from './island-promotion';

describe('island-promotion', () => {
  it('reorders by emitting move actions for the full sibling list', () => {
    const actions = reorderIslandActions('grid-1', ['a', 'b', 'c'], 'c', 'a');
    expect(actions).toEqual([
      { kind: 'move', id: 'c', new_parent: 'grid-1', order: 0 },
      { kind: 'move', id: 'a', new_parent: 'grid-1', order: 1 },
      { kind: 'move', id: 'b', new_parent: 'grid-1', order: 2 },
    ]);
  });

  it('promotes to surface with full size when requested', () => {
    const actions = promoteIslandAction('vi-1', {
      kind: 'surface',
      regionId: 'editor-1',
      order: 0,
      size: 'full',
    });
    expect(actions[0]).toEqual({ kind: 'move', id: 'vi-1', new_parent: 'editor-1', order: 0 });
    expect(actions[1]).toMatchObject({
      kind: 'update',
      id: 'vi-1',
      patch: { config: { size: 'full' } },
    });
  });

  it('reads BlockSize from view-instance config', () => {
    expect(
      readIslandSize({
        id: 'vi',
        type: 'view-instance',
        properties: { config: { size: 'w' } },
      }),
    ).toBe('w');
    expect(
      readIslandSize({ id: 'vi', type: 'view-instance', properties: {} }, 'm'),
    ).toBe('m');
  });
});
