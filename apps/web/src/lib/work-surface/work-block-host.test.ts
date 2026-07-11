import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ObjectQuery, ObjectShape, ViewDescriptor } from '@/lib/block-view/types';

const queryObjects = vi.fn();
const emitObjectAction = vi.fn();
const fetchObjectViews = vi.fn();

vi.mock('./object-client', () => ({
  queryObjects: (...args: unknown[]) => queryObjects(...args),
  emitObjectAction: (...args: unknown[]) => emitObjectAction(...args),
  fetchObjectViews: (...args: unknown[]) => fetchObjectViews(...args),
}));

// Imported after the mock so createWorkBlockHost sees the mocked object-client.
const { createWorkBlockHost } = await import('./work-block-host');

function shape(overrides: Partial<ObjectShape> = {}): ObjectShape {
  return { types: ['task'], fields: [], relations: [], axes: {}, cardinality: 'many', ...overrides };
}

function view(id: string, requiredTypes: readonly string[]): ViewDescriptor {
  return {
    id,
    name: id,
    accepts: { required_types: requiredTypes },
    emits: [],
    renderer: id,
    source: { package: 'test', component: id, mode: 'wrap', regime: 'css-vars' },
    render: undefined as unknown as ViewDescriptor['render'],
  };
}

async function flush() {
  await Promise.resolve();
  await Promise.resolve();
}

afterEach(() => {
  vi.clearAllMocks();
});

describe('createWorkBlockHost', () => {
  it('query() delegates to queryObjects and attaches a working (no-op) subscribe', async () => {
    const wire = { objects: [], shape: shape(), notes: ['ok'] };
    queryObjects.mockResolvedValue(wire);
    fetchObjectViews.mockResolvedValue([]);

    const host = createWorkBlockHost();
    const query: ObjectQuery = { types: ['task'] };
    const set = await host.query(query);

    expect(queryObjects).toHaveBeenCalledWith(query);
    expect(set.objects).toEqual([]);
    expect(set.notes).toEqual(['ok']);
    expect(typeof set.subscribe).toBe('function');
    expect(set.subscribe(() => {})).toBeTypeOf('function');
  });

  it('emit() wraps a successful receipt as ok:true', async () => {
    fetchObjectViews.mockResolvedValue([]);
    emitObjectAction.mockResolvedValue({ action_kind: 'update', status: 'applied' });

    const host = createWorkBlockHost();
    const result = await host.emit({ kind: 'update', id: 'x', patch: {} });

    expect(result.ok).toBe(true);
    expect(result.value).toEqual({ action_kind: 'update', status: 'applied' });
  });

  it('emit() wraps a thrown error as ok:false with a message', async () => {
    fetchObjectViews.mockResolvedValue([]);
    emitObjectAction.mockRejectedValue(new Error('backend unreachable'));

    const host = createWorkBlockHost();
    const result = await host.emit({ kind: 'delete', id: 'x' });

    expect(result.ok).toBe(false);
    expect(result.error).toBe('backend unreachable');
  });

  it('viewsFor() returns [] before the views catalog has loaded', () => {
    fetchObjectViews.mockReturnValue(new Promise(() => {})); // never resolves in this test

    const host = createWorkBlockHost();
    expect(host.viewsFor(shape())).toEqual([]);
    expect(host.viewsLoaded).toBe(false);
  });

  it('viewsFor() filters the loaded catalog by shape once the fetch resolves', async () => {
    fetchObjectViews.mockResolvedValue([view('board', ['task']), view('table', ['project'])]);

    const host = createWorkBlockHost();
    await flush();

    expect(host.viewsLoaded).toBe(true);
    const matched = host.viewsFor(shape({ types: ['task'] }));
    expect(matched.map((v) => v.id)).toEqual(['board']);
  });

  it('viewsFor() attaches a placeholder render function to wire descriptors', async () => {
    fetchObjectViews.mockResolvedValue([view('board', ['task'])]);

    const host = createWorkBlockHost();
    await flush();

    const [descriptor] = host.viewsFor(shape({ types: ['task'] }));
    expect(typeof descriptor.render).toBe('function');
  });

  it('viewsFor() degrades to [] (not a throw) when the catalog fetch fails', async () => {
    fetchObjectViews.mockRejectedValue(new Error('network down'));

    const host = createWorkBlockHost();
    await flush();

    expect(host.viewsLoaded).toBe(true);
    expect(host.viewsFor(shape())).toEqual([]);
  });
});
