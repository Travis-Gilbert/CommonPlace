// SOURCING: none. Pure logic, no upstream component applies.

import { describe, expect, it } from 'vitest';
import type {
  JsonValue,
  ObjectAction,
  ObjectActionReceipt,
  ObjectQuery,
  ObjectRef,
  ObjectSet,
  Result,
} from '@commonplace/block-view/types';
import { parseCanvasValue } from '@commonplace/json-canvas';
import {
  CANVAS_CONNECT_EDGE,
  CANVAS_MEMBER_EDGE,
  CANVAS_TYPE,
} from './object-bridge';
import {
  CanvasStore,
  DEFAULT_CANVAS_ID,
  PERSISTENCE_UNAVAILABLE_NOTE,
} from './store';

class DurableObjectSeam {
  readonly objects = new Map<string, ObjectRef>();
  readonly actions: ObjectAction[] = [];

  async query(query: ObjectQuery): Promise<ObjectSet> {
    const objects = [...this.objects.values()].filter((object) => (
      query.types.includes(object.type)
      && (
        query.where?.kind !== 'eq'
        || query.where.field !== 'id'
        || object.id === query.where.value
      )
    ));
    return {
      objects,
      shape: {
        types: [...query.types],
        fields: [],
        relations: [],
        axes: {},
        cardinality: objects.length === 0 ? 'empty' : objects.length === 1 ? 'one' : 'many',
      },
      subscribe: () => () => {},
    };
  }

  async emit(action: ObjectAction): Promise<Result<ObjectActionReceipt>> {
    this.actions.push(action);
    if (action.kind === 'create') {
      const id = typeof action.props.id === 'string' ? action.props.id : `object-${this.objects.size + 1}`;
      this.objects.set(id, {
        id,
        type: action.type,
        properties: { ...action.props, id },
      });
    } else if (action.kind === 'update') {
      const current = this.objects.get(action.id);
      if (!current) return { ok: false, error: `missing: ${action.id}` };
      this.objects.set(action.id, {
        ...current,
        properties: { ...current.properties, ...action.patch },
      });
    } else if (action.kind === 'delete') {
      this.objects.delete(action.id);
    }
    return {
      ok: true,
      value: {
        action_kind: action.kind,
        status: 'applied',
        target_ids: action.kind === 'create'
          ? [String(action.props.id)]
          : 'id' in action
            ? [action.id]
            : [],
        op_range: {
          first_op_id: `op-${this.actions.length}`,
          last_op_id: `op-${this.actions.length}`,
          range_hash: `hash-${this.actions.length}`,
        },
      },
    };
  }
}

describe('CanvasStore', () => {
  it('seeds the stable default canvas through the object seam', async () => {
    const seam = new DurableObjectSeam();
    const store = new CanvasStore(seam);

    await store.ready();

    expect(seam.objects.get(DEFAULT_CANVAS_ID)?.type).toBe(CANVAS_TYPE);
    expect(seam.actions[0]).toMatchObject({
      kind: 'create',
      type: CANVAS_TYPE,
      props: { id: DEFAULT_CANVAS_ID, persistence_kind: 'canvas-work-v1' },
    });
  });

  it('places, moves, links, and unlinks without deleting the object', async () => {
    const store = new CanvasStore(new DurableObjectSeam());
    await store.ready();
    const created = await store.emit({
      kind: 'create',
      type: 'note',
      props: {
        id: 'note.a',
        title: 'Alpha',
        text: 'Hello',
        canvasId: DEFAULT_CANVAS_ID,
        x: 10,
        y: 20,
      },
    });
    expect(created.ok).toBe(true);
    expect(created.value?.op_range).toBeDefined();

    const moved = await store.emit({
      kind: 'update',
      id: 'note.a',
      patch: { x: 100, y: 200 },
    });
    expect(moved.ok).toBe(true);
    expect(store.getCanvas(DEFAULT_CANVAS_ID)?.placements[0]).toMatchObject({
      objectId: 'note.a',
      x: 100,
      y: 200,
    });

    await store.emit({
      kind: 'create',
      type: 'note',
      props: { id: 'note.b', title: 'Beta', canvasId: DEFAULT_CANVAS_ID, x: 300, y: 20 },
    });
    const linked = await store.emit({
      kind: 'link',
      from: 'note.a',
      edge: CANVAS_CONNECT_EDGE,
      to: 'note.b',
    });
    expect(linked.ok).toBe(true);
    expect(store.getCanvas(DEFAULT_CANVAS_ID)?.connections).toHaveLength(1);

    const unlinked = await store.emit({
      kind: 'unlink',
      from: DEFAULT_CANVAS_ID,
      edge: CANVAS_MEMBER_EDGE,
      to: 'note.a',
    });
    expect(unlinked.ok).toBe(true);
    const canvas = store.getCanvas(DEFAULT_CANVAS_ID)!;
    expect(canvas.placements.some((placement) => placement.objectId === 'note.a')).toBe(false);
    expect(canvas.objects.some((object) => object.id === 'note.a')).toBe(true);
  });

  it('imports and exports a JSON Canvas document', async () => {
    const store = new CanvasStore(new DurableObjectSeam());
    await store.ready();
    const document = parseCanvasValue({
      nodes: [
        { id: 't', type: 'text', x: 0, y: 0, width: 120, height: 60, text: 'Imported', color: '3' },
        { id: 'u', type: 'link', x: 200, y: 0, width: 120, height: 60, url: 'https://example.com', color: '5' },
      ],
      edges: [{ id: 'e', fromNode: 't', toNode: 'u' }],
    });
    const receipt = await store.importDocument(DEFAULT_CANVAS_ID, document);
    expect(receipt.ok).toBe(true);
    const exported = store.exportDocument(DEFAULT_CANVAS_ID);
    expect(exported?.nodes.length).toBeGreaterThanOrEqual(2);
    expect(exported?.edges).toHaveLength(1);
    const link = store.getCanvas(DEFAULT_CANVAS_ID)?.objects.find((object) => object.url);
    expect(link?.color).toBe('5');
  });

  it('applies agent JSON Canvas via invoke_tool', async () => {
    const store = new CanvasStore(new DurableObjectSeam());
    await store.ready();
    const document = parseCanvasValue({
      nodes: [{ id: 'a', type: 'text', x: 1, y: 2, width: 10, height: 10, text: 'Agent' }],
      edges: [],
    });
    const receipt = await store.emit({
      kind: 'invoke_tool',
      tool: 'canvas.apply_json',
      args: { canvasId: DEFAULT_CANVAS_ID, document: document as unknown as JsonValue },
    });
    expect(receipt.ok).toBe(true);
    expect(store.getCanvas(DEFAULT_CANVAS_ID)?.placements.length).toBeGreaterThan(0);
  });

  it('refuses invalid JSON Canvas apply requests', async () => {
    const store = new CanvasStore(new DurableObjectSeam());
    await store.ready();
    const receipt = await store.emit({
      kind: 'invoke_tool',
      tool: 'canvas.apply_json',
      args: { canvasId: DEFAULT_CANVAS_ID, document: { nodes: 'invalid' } },
    });
    expect(receipt.ok).toBe(false);
  });

  it('restores the arrangement through a fresh store instance', async () => {
    const seam = new DurableObjectSeam();
    const first = new CanvasStore(seam);
    await first.ready();
    await first.emit({
      kind: 'create',
      type: 'note',
      props: {
        id: 'note.redeploy',
        title: 'Survives',
        canvasId: DEFAULT_CANVAS_ID,
        x: 40,
        y: 80,
      },
    });

    const afterRedeploy = new CanvasStore(seam);
    await afterRedeploy.ready();
    const restored = afterRedeploy.query({
      types: ['canvas', 'canvas.card', 'canvas.group', 'canvas.connection'],
      page: { limit: 500 },
    });

    expect(restored.objects.find((object) => object.id === 'note.redeploy')).toMatchObject({
      type: 'canvas.card',
      properties: { x: 40, y: 80, title: 'Survives' },
    });
  });

  it('refuses writes until a failed durable hydration can be retried', async () => {
    let queryAttempts = 0;
    let emitAttempts = 0;
    const store = new CanvasStore({
      query: async () => {
        queryAttempts += 1;
        throw new Error('durable read unavailable');
      },
      emit: async () => {
        emitAttempts += 1;
        return {
          ok: true,
          value: {
            action_kind: 'update',
            status: 'applied',
            target_ids: [],
            legacy_without_op_range: true,
          },
        };
      },
    });

    await store.ready();
    const result = await store.emit({
      kind: 'create',
      type: 'note',
      props: { id: 'note.refused', canvasId: DEFAULT_CANVAS_ID },
    });

    expect(result).toEqual({ ok: false, error: PERSISTENCE_UNAVAILABLE_NOTE });
    expect(queryAttempts).toBe(2);
    expect(emitAttempts).toBe(0);
  });

  it('rejects when a named canvas cannot be seeded durably', async () => {
    const seam = new DurableObjectSeam();
    const store = new CanvasStore(seam);
    await store.ready();
    seam.emit = async () => ({ ok: false, error: 'named canvas refused' });

    await expect(store.readyNamedCanvas('canvas.model.orders')).rejects.toThrow(
      'named canvas refused',
    );
  });

  it('serializes document imports with ordinary canvas mutations', async () => {
    const seam = new DurableObjectSeam();
    let activeWrites = 0;
    let maxActiveWrites = 0;
    const store = new CanvasStore({
      query: (query) => seam.query(query),
      emit: async (action) => {
        activeWrites += 1;
        maxActiveWrites = Math.max(maxActiveWrites, activeWrites);
        await new Promise((resolve) => setTimeout(resolve, 5));
        try {
          return await seam.emit(action);
        } finally {
          activeWrites -= 1;
        }
      },
    });
    await store.ready();
    maxActiveWrites = 0;
    const document = parseCanvasValue({
      nodes: [{ id: 'imported', type: 'text', x: 0, y: 0, width: 80, height: 40, text: 'Imported' }],
      edges: [],
    });

    await Promise.all([
      store.emit({
        kind: 'create',
        type: 'note',
        props: { id: 'note.concurrent', canvasId: DEFAULT_CANVAS_ID },
      }),
      store.importDocument(DEFAULT_CANVAS_ID, document),
    ]);

    expect(maxActiveWrites).toBe(1);
    expect(store.getCanvas(DEFAULT_CANVAS_ID)?.objects.map((object) => object.id))
      .toContain('text:imported');
  });

  it('persists child deletion back to its non-default canvas', async () => {
    const seam = new DurableObjectSeam();
    const store = new CanvasStore(seam);
    await store.ready();
    await store.emit({
      kind: 'create',
      type: CANVAS_TYPE,
      props: { id: 'canvas.secondary', title: 'Secondary' },
    });
    await store.emit({
      kind: 'create',
      type: 'note',
      props: { id: 'note.secondary', canvasId: 'canvas.secondary' },
    });

    const deleted = await store.emit({ kind: 'delete', id: 'note.secondary' });
    const durable = seam.objects.get('canvas.secondary')?.properties.graph as {
      placements?: Array<{ objectId?: string }>;
    };

    expect(deleted.ok).toBe(true);
    expect(seam.actions.at(-1)).toMatchObject({ kind: 'update', id: 'canvas.secondary' });
    expect(durable.placements?.some((placement) => placement.objectId === 'note.secondary'))
      .toBe(false);
  });
});
