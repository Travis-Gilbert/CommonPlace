import { describe, expect, it } from 'vitest';
import {
  blockDropActions,
  emitBlockDropActions,
  nestBlockInContainerActions,
  placeBlockAction,
  readBlockSize,
  readKanbanColumn,
  reorderBlockActions,
  resizeBlockAction,
  setBlockGeometryAction,
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

  it('preserves existing config keys when resizing or setting geometry', () => {
    expect(
      resizeBlockAction('vi-1', 'w', undefined, { size: 'm', kanbanColumn: 'doing' }),
    ).toEqual({
      kind: 'update',
      id: 'vi-1',
      patch: { config: { size: 'w', kanbanColumn: 'doing' } },
    });
    expect(
      setBlockGeometryAction(
        'vi-1',
        { col: 2, row: 3, colSpan: 4, rowSpan: 3 },
        { size: 'm', kanbanColumn: 'todo' },
      ),
    ).toEqual({
      kind: 'update',
      id: 'vi-1',
      patch: {
        config: {
          size: 'm',
          kanbanColumn: 'todo',
          geometry: { col: 2, row: 3, colSpan: 4, rowSpan: 3 },
        },
      },
    });
  });

  it('promotes to full while merging existing config', () => {
    const actions = placeBlockAction(
      'vi-1',
      {
        placement: 'full',
        regionId: 'editor-1',
        order: 0,
        size: 'full',
      },
      { kanbanColumn: 'done', size: 'm' },
    );
    expect(actions[1]).toMatchObject({
      kind: 'update',
      id: 'vi-1',
      patch: {
        config: {
          kanbanColumn: 'done',
          size: 'full',
          geometry: { col: 1, row: 1, colSpan: 12, rowSpan: 12 },
        },
      },
    });
  });

  it('nests a child under a container with CONTAINS move and column stamp', () => {
    const actions = nestBlockInContainerActions(
      'vi-records',
      'vi-kanban',
      'doing',
      0,
      { size: 'm' },
    );
    expect(actions[0]).toEqual({
      kind: 'move',
      id: 'vi-records',
      new_parent: 'vi-kanban',
      order: 0,
    });
    expect(actions[1]).toEqual({
      kind: 'update',
      id: 'vi-records',
      patch: { config: { size: 'm', kanbanColumn: 'doing' } },
    });
  });

  it('resolves a contain drop to move plus container config', () => {
    expect(
      blockDropActions(
        'vi-records',
        {
          viewInstanceId: 'vi-kanban',
          acceptsDrop: {
            semantic: 'contain',
            layout: 'columns',
            accepts: ['*'],
          },
          columnId: 'done',
        },
        2,
        { size: 'm' },
      ),
    ).toEqual([
      {
        kind: 'move',
        id: 'vi-records',
        new_parent: 'vi-kanban',
        order: 2,
      },
      {
        kind: 'update',
        id: 'vi-records',
        patch: { config: { size: 'm', kanbanColumn: 'done' } },
      },
    ]);
  });

  it('resolves a generic contain drop to move without kanban config', () => {
    expect(
      blockDropActions(
        'vi-source',
        {
          viewInstanceId: 'vi-stack',
          acceptsDrop: {
            semantic: 'contain',
            layout: 'stack',
          },
        },
        3,
        { size: 'm' },
      ),
    ).toEqual([
      {
        kind: 'move',
        id: 'vi-source',
        new_parent: 'vi-stack',
        order: 3,
      },
    ]);
  });

  it('resolves a relate drop to link without moving either block', () => {
    expect(
      blockDropActions(
        'vi-source',
        {
          viewInstanceId: 'vi-target',
          acceptsDrop: {
            semantic: 'relate',
            edge: 'RELATED_TO',
            accepts: ['model.kind'],
          },
        },
        0,
      ),
    ).toEqual([
      {
        kind: 'link',
        from: 'vi-source',
        edge: 'RELATED_TO',
        to: 'vi-target',
      },
    ]);
  });

  it('defers a relate drop without a default edge to the target picker', () => {
    expect(
      blockDropActions(
        'vi-source',
        {
          viewInstanceId: 'vi-target',
          acceptsDrop: { semantic: 'relate' },
        },
        0,
      ),
    ).toEqual([]);
  });

  it('rejects self-drops for containment and relation targets', () => {
    expect(
      blockDropActions(
        'vi-source',
        {
          viewInstanceId: 'vi-source',
          acceptsDrop: { semantic: 'contain', layout: 'stack' },
        },
        0,
      ),
    ).toEqual([]);
    expect(
      blockDropActions(
        'vi-source',
        {
          viewInstanceId: 'vi-source',
          acceptsDrop: { semantic: 'relate', edge: 'RELATED_TO' },
        },
        0,
      ),
    ).toEqual([]);
  });

  it('returns applied move and link receipt counts from the host emit path', async () => {
    const emitted: unknown[] = [];
    const summary = await emitBlockDropActions(
      {
        emit: async (action) => {
          emitted.push(action);
          return {
            ok: true,
            value: {
              action_kind: action.kind,
              status: 'applied',
              legacy_without_op_range: true,
              target_ids: action.kind === 'link'
                ? [action.from, action.to]
                : action.kind === 'move'
                  ? [action.id]
                  : [],
            },
          };
        },
      },
      [
        {
          kind: 'move',
          id: 'vi-source',
          new_parent: 'vi-container',
          order: 0,
        },
        {
          kind: 'link',
          from: 'vi-source',
          edge: 'RELATED_TO',
          to: 'vi-target',
        },
      ],
    );

    expect(emitted).toHaveLength(2);
    expect(summary).toEqual({ moves: 1, links: 1, allApplied: true });
  });

  it('stops a dependent drop action chain after the first refused receipt', async () => {
    const emitted: unknown[] = [];
    const summary = await emitBlockDropActions(
      {
        emit: async (action) => {
          emitted.push(action);
          return { ok: false, error: 'refused:test' };
        },
      },
      [
        {
          kind: 'move',
          id: 'vi-source',
          new_parent: 'vi-container',
          order: 0,
        },
        {
          kind: 'update',
          id: 'vi-source',
          patch: { config: { kanbanColumn: 'doing' } },
        },
      ],
    );

    expect(emitted).toHaveLength(1);
    expect(summary).toEqual({ moves: 0, links: 0, allApplied: false });
  });

  it('marks a partially applied dependent drop chain as incomplete', async () => {
    let attempts = 0;
    const summary = await emitBlockDropActions(
      {
        emit: async (action) => {
          attempts += 1;
          if (attempts === 2) return { ok: false, error: 'refused:column_patch' };
          return {
            ok: true,
            value: {
              action_kind: action.kind,
              status: 'applied',
              legacy_without_op_range: true,
              target_ids: ['vi-source'],
            },
          };
        },
      },
      [
        {
          kind: 'move',
          id: 'vi-source',
          new_parent: 'vi-container',
          order: 0,
        },
        {
          kind: 'update',
          id: 'vi-source',
          patch: { config: { kanbanColumn: 'doing' } },
        },
      ],
    );

    expect(summary).toEqual({ moves: 1, links: 0, allApplied: false });
  });

  it('reads kanban column from config with todo default', () => {
    expect(
      readKanbanColumn({
        id: 'vi',
        type: 'view-instance',
        properties: { config: { kanbanColumn: 'done' } },
      }),
    ).toBe('done');
    expect(
      readKanbanColumn({ id: 'vi', type: 'view-instance', properties: {} }),
    ).toBe('todo');
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
