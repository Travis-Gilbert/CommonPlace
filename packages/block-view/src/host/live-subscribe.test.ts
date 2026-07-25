// SOURCING: none. Pure logic, no upstream component applies.
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ObjectGraph } from '../database/model';
import { HttpBlockHost } from './HttpBlockHost';
import { MemoryBlockHost } from './MemoryBlockHost';
import { resetChangefeedClientsForTests, resolveChangefeedClient } from './changefeed';

const TEST_GRAPH: ObjectGraph = {
  space: 'test',
  set: {
    id: 'set-1',
    name: 'Tasks',
    typeKey: 'task',
    views: [],
  },
  type: { key: 'task', name: 'Task' },
  relations: {},
  options: {},
  objects: [
    { id: 'task-1', typeKey: 'task', title: 'First', cells: {}, origin: 'seed' },
    { id: 'task-2', typeKey: 'task', title: 'Second', cells: {}, origin: 'seed' },
    { id: 'person-1', typeKey: 'person', title: 'Ada', cells: {}, origin: 'seed' },
  ],
};

afterEach(() => {
  resetChangefeedClientsForTests();
  vi.unstubAllGlobals();
});

describe('HttpBlockHost live subscriptions', () => {
  it('queries layout types over HTTP (no LAYOUT_TYPES shim)', async () => {
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify({
        objects: [{ id: 'console-chat', type: 'surface', properties: { name: 'Chat' } }],
        shape: { types: ['surface'], fields: ['name'], relations: [], axes: {}, cardinality: 'one' },
      }), { status: 200, headers: { 'Content-Type': 'application/json' } }));
    vi.stubGlobal('fetch', fetchMock);

    const host = new HttpBlockHost({ baseUrl: '/api' });
    const set = await host.query({
      types: ['surface', 'region', 'view-instance'],
      traverse: [{ edge: 'CONTAINS', dir: 'out' }],
    });
    expect(set.objects).toHaveLength(1);
    expect(set.objects[0]?.id).toBe('console-chat');
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/objects/query',
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('re-queries on changefeed invalidation without throwing into the block body', async () => {
    let fetchCount = 0;
    vi.stubGlobal('fetch', vi.fn(async () => {
      fetchCount += 1;
      const title = fetchCount === 1 ? 'First' : 'First (fresh)';
      return new Response(JSON.stringify({
        objects: [{ id: 'task-1', type: 'task', properties: { title } }],
        shape: { types: ['task'], fields: ['title'], relations: [], axes: {}, cardinality: 'one' },
      }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }));

    const statuses: string[] = [];
    const host = new HttpBlockHost({
      baseUrl: '/api',
      changefeedUrl: 'http://example.test/stream',
      onChangefeedStatus: (status) => statuses.push(status),
    });
    const set = await host.query({ types: ['task'], live: true });
    let latest = set.objects[0]?.properties.title;
    const unsubscribe = set.subscribe((next) => {
      latest = next.objects[0]?.properties.title;
    });

    resolveChangefeedClient({ url: 'http://example.test/stream' }).emitTestEvent({ object_type: 'task' });
    await vi.waitFor(() => expect(latest).toBe('First (fresh)'));
    expect(fetchCount).toBe(2);
    expect(statuses).toContain('stale');
    unsubscribe();
  });

  it('keeps subscribe as a no-op when live is false', async () => {
    vi.stubGlobal('fetch', vi.fn(async () =>
      new Response(JSON.stringify({
        objects: [],
        shape: { types: ['task'], fields: [], relations: [], axes: {}, cardinality: 'empty' },
      }), { status: 200, headers: { 'Content-Type': 'application/json' } })));

    const host = new HttpBlockHost({ baseUrl: '/api', changefeedUrl: 'http://example.test/stream' });
    const set = await host.query({ types: ['task'], live: false });
    let hits = 0;
    const unsubscribe = set.subscribe(() => {
      hits += 1;
    });
    resolveChangefeedClient({ url: 'http://example.test/stream' }).emitTestEvent({ object_type: 'task' });
    expect(hits).toBe(0);
    unsubscribe();
  });
});

describe('MemoryBlockHost emitTestEvent', () => {
  it('notifies live subscribers and respects type fan-out', () => {
    const host = new MemoryBlockHost(TEST_GRAPH);
    const taskSet = host.query({ types: ['task'], live: true });
    const personSet = host.query({ types: ['person'], live: true });
    let taskHits = 0;
    let personHits = 0;
    const stopTask = taskSet.subscribe(() => {
      taskHits += 1;
    });
    const stopPerson = personSet.subscribe(() => {
      personHits += 1;
    });

    host.emitTestEvent({ object_type: 'task' });
    expect(taskHits).toBe(1);
    expect(personHits).toBe(0);

    host.emitTestEvent({ object_type: 'person' });
    expect(taskHits).toBe(1);
    expect(personHits).toBe(1);
    stopTask();
    stopPerson();
  });

  it('still notifies emit-driven subscribers after domain mutations', async () => {
    const host = new MemoryBlockHost(TEST_GRAPH);
    const set = host.query({ types: ['task'], live: true });
    let latest = set.objects[0]?.properties.title;
    const unsubscribe = set.subscribe((next) => {
      latest = next.objects[0]?.properties.title;
    });

    await host.emit({ kind: 'update', id: 'task-1', patch: { title: 'Updated' } });
    expect(latest).toBe('Updated');

    host.emitTestEvent({ object_type: 'task' });
    expect(latest).toBe('Updated');
    unsubscribe();
  });
});
