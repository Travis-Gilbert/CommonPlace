// SOURCING: none. Pure logic, no upstream component applies.
// The marriage requirement, tested: the arrangement is data; move and update
// semantics mutate the surface object and notify; the seed is deterministic.
// The 5000-row record fixture lives HERE, in tests, per R2.1: the app host
// rides the live data API and never serves fixture records.

import { describe, expect, it } from 'vitest';
import { afterEach, vi } from 'vitest';
import { CONTAINS_EDGE } from '@commonplace/block-view/surface-tree';
import { buildSurfaceTree, surfaceQuery } from '@commonplace/block-view/surface-tree';
import { ConsoleBlockHost } from './console-host';
import {
  activateConsoleDataSurface,
  unmountConsoleDataSurface,
} from './console-plugin/open-console';
import { clearLayoutCache, writeLayoutCache } from './state/layout-cache';
import {
  CONSOLE_DATA_SURFACE_ID,
  RECORD_COUNT,
  SURFACE_ID,
  SURVEY_SURFACE_ID,
  SURVEY_VIEW_INSTANCE_ID,
  seedLayout,
  seedRecords,
  MODEL_SURFACE_ID,
  MODEL_VIEW_INSTANCE_ID,
} from './workspace-seed';
import { PLACE_ENTRIES } from './rail/rail-model';

const NO_VIEWS = { matchingViews: () => [] };

afterEach(() => {
  vi.unstubAllGlobals();
  clearLayoutCache();
});

/** A host with the test-only record pool (the app passes no pool). */
function fixtureHost() {
  return new ConsoleBlockHost(NO_VIEWS, { records: seedRecords() });
}

describe('ConsoleBlockHost', () => {
  it('serves the seeded arrangement as a surface tree', () => {
    const host = new ConsoleBlockHost(NO_VIEWS);
    const set = host.queryLayout(surfaceQuery());
    const root = buildSurfaceTree(SURFACE_ID, set.objects);
    expect(root).not.toBeNull();
    expect(root!.children.map((child) => child.object.id)).toEqual([
      'chat.region-editor',
      'chat.region-files',
      'chat.region-context',
      'chat.region-thread',
    ]);
    const editor = root!.children.find((child) => child.object.id === 'chat.region-editor')!;
    expect(editor.children.map((node) => node.object.id)).toEqual(['chat.vi-surface']);
  });

  it('seeds the exact primary IA order and role-bearing companions', () => {
    const host = new ConsoleBlockHost(NO_VIEWS);
    const set = host.queryLayout(surfaceQuery());
    const surfaces = set.objects.filter((object) => object.type === 'surface');
    expect(surfaces.map((surface) => surface.id).sort()).toEqual([
      'console-account',
      'console-appearance',
      'console-automation',
      'console-canvas',
      'console-cards',
      'console-chat',
      'console-docs',
      'console-files',
      'console-goals',
      'console-harness-status',
      'console-index',
      'console-models',
      'console-proactivity',
      'console-records',
      'console-review',
      'console-survey',
      'console-threads',
      'console-workspace',
    ]);
    expect(surfaces.find((surface) => surface.properties.active === true)?.id).toBe(SURFACE_ID);
    expect(surfaces
      .filter((surface) => PLACE_ENTRIES.some((place) => place.surfaceId === surface.id))
      .sort((a, b) => Number(a.properties.stripe_order ?? 99) - Number(b.properties.stripe_order ?? 99))
      .map((surface) => surface.properties.name)).toEqual([
        'Chat', 'Researcher', 'Index', 'Editor', 'Models',
      ]);
    const workspace = buildSurfaceTree('console-workspace', set.objects);
    expect(workspace!.children.map((child) => child.object.id)).toEqual([
      'region-editor',
      'workspace.region-files',
      'workspace.region-context',
      'workspace.region-thread',
    ]);
    expect(workspace!.children.filter((child) => child.object.properties.role === 'companion')).toHaveLength(3);
    // The Index carries a third surface-role region, the urgent lane, whose
    // empty state is its designed norm (SPEC-COMMONPLACE-FILING-AND-INDEX-1.0
    // F5). It is a region rather than a companion because it belongs to this
    // surface alone; companions ride alongside every surface.
    const index = buildSurfaceTree('console-index', set.objects);
    expect(index!.children.map((child) => child.object.id)).toEqual([
      'index.region-rail',
      'index.region-editor',
      'index.region-urgent',
      'index.region-files',
      'index.region-context',
      'index.region-thread',
    ]);
    expect(index!.children.filter((child) => child.object.properties.role === 'companion')).toHaveLength(3);
    const files = buildSurfaceTree('console-files', set.objects);
    expect(files!.children.map((child) => child.object.id)).toEqual([
      'files.region-editor',
      'files.region-context',
      'files.region-thread',
    ]);
    const threads = buildSurfaceTree('console-threads', set.objects);
    expect(threads!.children[0]?.children[0]?.object.properties.descriptor_id).toBe('thread.list');
    expect(set.objects.some((object) => object.id === CONSOLE_DATA_SURFACE_ID)).toBe(false);
  });

  it('seeds the landmarks region as frame chrome with stripe view instances', () => {
    const host = new ConsoleBlockHost(NO_VIEWS);
    const set = host.queryLayout(surfaceQuery());
    const landmarks = set.objects.find((object) => object.id === 'console.region-landmarks');
    expect(landmarks?.type).toBe('region');
    expect(landmarks?.properties.kind).toBe('landmarks');
    expect(landmarks?.properties.collapsed).toBe(false);
    expect(landmarks?.relations?.[CONTAINS_EDGE]).toEqual([
      'console.landmark-brief',
      'console.landmark-code',
    ]);
    const briefLandmark = set.objects.find((object) => object.id === 'console.landmark-brief');
    expect(briefLandmark?.properties.descriptor_id).toBe('markdown.doc');
    expect(briefLandmark?.properties.pinned).toBe(true);
  });

  it('migrates landmarks into a persisted arrangement that lacked them', () => {
    const withoutLandmarks = seedLayout().filter(
      (object) => !object.id.startsWith('console.region-landmarks') && !object.id.startsWith('console.landmark-'),
    );
    writeLayoutCache(withoutLandmarks);
    const host = new ConsoleBlockHost(NO_VIEWS);
    const set = host.queryLayout(surfaceQuery());
    expect(set.objects.some((object) => object.id === 'console.region-landmarks')).toBe(true);
    expect(set.objects.some((object) => object.id === 'console.landmark-brief')).toBe(true);
    const survey = buildSurfaceTree(SURVEY_SURFACE_ID, set.objects);
    expect(survey!.children[0]?.children[0]?.object.id).toBe(SURVEY_VIEW_INSTANCE_ID);
    const models = buildSurfaceTree(MODEL_SURFACE_ID, set.objects);
    expect(models!.children[0]?.children[0]?.object.id).toBe(MODEL_VIEW_INSTANCE_ID);
    expect(models!.children[0]?.children[0]?.object.properties.descriptor_id).toBe(
      'model.studio',
    );
  });

  it('adds missing seed surfaces to an existing server layout before adopting it', async () => {
    const remote = seedLayout().filter(
      (object) => object.id !== SURVEY_SURFACE_ID && !object.id.startsWith('survey.'),
    );
    const actionBodies: Array<Record<string, unknown>> = [];
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body ?? '{}')) as Record<string, unknown>;
      if (!('kind' in body)) {
        return Response.json({
          objects: remote,
          shape: {
            types: ['surface', 'region', 'view-instance'],
            fields: [],
            relations: [CONTAINS_EDGE],
            axes: {},
            cardinality: 'many',
          },
        });
      }
      actionBodies.push(body);
      return Response.json({
        action_kind: body.kind,
        status: 'applied',
        target_ids: [],
        legacy_without_op_range: true,
      });
    });
    vi.stubGlobal('fetch', fetchMock);

    const host = new ConsoleBlockHost(NO_VIEWS);
    await host.ensureSeedLayout();

    const migrated = host.queryLayout(surfaceQuery()).objects;
    expect(migrated.some((object) => object.id === SURVEY_SURFACE_ID)).toBe(true);
    expect(migrated.some((object) => object.id === SURVEY_VIEW_INSTANCE_ID)).toBe(true);
    expect(actionBodies).toContainEqual(expect.objectContaining({
      kind: 'create',
      type: 'surface',
      props: expect.objectContaining({ id: SURVEY_SURFACE_ID }),
    }));
    expect(actionBodies).toContainEqual(expect.objectContaining({
      kind: 'move',
      id: SURVEY_VIEW_INSTANCE_ID,
      new_parent: 'survey.region-editor',
    }));
  });

  it('serves a topic-scoped Survey corpus through one ObjectQuery', async () => {
    const host = new ConsoleBlockHost(NO_VIEWS);
    const set = await Promise.resolve(host.query({
      types: ['topic', 'capture', 'survey-edge'],
      where: { kind: 'eq', field: 'topic_id', value: 'topic-evidence-research-surfaces' },
    }));

    expect(set.objects.filter((object) => object.type === 'topic')).toHaveLength(1);
    expect(set.objects.filter((object) => object.type === 'capture')).toHaveLength(15);
    expect(set.objects.filter((object) => object.type === 'survey-edge').length).toBeGreaterThan(0);
  });

  it('keeps declared model overlay metadata synchronized through host actions', async () => {
    const host = new ConsoleBlockHost(NO_VIEWS);
    const query = {
      types: ['field-metadata'],
      where: { kind: 'eq' as const, field: 'topic_id', value: 'topic-models' },
    };
    await host.emit({
      kind: 'create',
      type: 'field-metadata',
      props: {
        id: 'field-title',
        topic_id: 'topic-models',
        key: 'title',
        label: 'Title',
      },
    });
    let set = await Promise.resolve(host.query(query));
    expect(set.objects.map((object) => object.id)).toEqual(['field-title']);

    await host.emit({ kind: 'update', id: 'field-title', patch: { label: 'Document title' } });
    set = await Promise.resolve(host.query(query));
    expect(set.objects[0]?.properties.label).toBe('Document title');

    await host.emit({ kind: 'delete', id: 'field-title' });
    set = await Promise.resolve(host.query(query));
    expect(set.objects).toEqual([]);
  });

  it('keeps console-local object lifecycles off the live wire', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const host = new ConsoleBlockHost(NO_VIEWS);

    const created = await host.emit({
      kind: 'create',
      type: 'thread',
      props: { id: 'thread.local', title: 'Local thread' },
    });
    let set = await Promise.resolve(host.query({ types: ['thread'] }));
    expect(created.value?.status).toBe('applied');
    expect(set.objects.map((object) => object.id)).toEqual(['thread.local']);

    await host.emit({ kind: 'update', id: 'thread.local', patch: { title: 'Updated' } });
    set = await Promise.resolve(host.query({ types: ['thread'] }));
    expect(set.objects[0]?.properties.title).toBe('Updated');

    await host.emit({ kind: 'delete', id: 'thread.local' });
    set = await Promise.resolve(host.query({ types: ['thread'] }));
    expect(set.objects).toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('applies moveSurfaceNodeAction semantics: re-parent with order', async () => {
    const host = new ConsoleBlockHost(NO_VIEWS);
    const receipt = await host.emit({ kind: 'move', id: 'vi-code', new_parent: 'workspace.region-files', order: 0 });
    expect(receipt.ok).toBe(true);
    expect(receipt.value?.status).toBe('applied');
    const set = host.queryLayout(surfaceQuery());
    const left = set.objects.find((object) => object.id === 'workspace.region-files')!;
    const editor = set.objects.find((object) => object.id === 'region-editor')!;
    expect(left.relations?.[CONTAINS_EDGE]).toEqual(['vi-code', 'workspace.region-files.view']);
    expect(editor.relations?.[CONTAINS_EDGE]).toEqual(['workspace.vi-substrate', 'vi-brief']);
  });

  it('notifies layout subscribers on update', async () => {
    const host = new ConsoleBlockHost(NO_VIEWS);
    const set = host.queryLayout(surfaceQuery());
    let notified = 0;
    const unsubscribe = set.subscribe(() => {
      notified += 1;
    });
    await host.emit({ kind: 'update', id: 'workspace.region-files', patch: { size: 30 } });
    expect(notified).toBe(1);
    unsubscribe();
  });

  it('switches surfaces atomically and closes compact same-side companions', async () => {
    const host = new ConsoleBlockHost(NO_VIEWS);
    const set = host.queryLayout(surfaceQuery());
    let notified = 0;
    const unsubscribe = set.subscribe(() => {
      notified += 1;
    });
    expect(await host.activateSurface('console-workspace')).toBe(true);
    let current = host.queryLayout(surfaceQuery()).objects;
    expect(current.filter((object) => object.type === 'surface' && object.properties.active === true).map((object) => object.id))
      .toEqual(['console-workspace']);
    expect(notified).toBe(1);

    await host.setRegionOpen('workspace.region-context', true);
    await host.setRegionOpen('workspace.region-thread', true, ['workspace.region-context']);
    current = host.queryLayout(surfaceQuery()).objects;
    expect(current.find((object) => object.id === 'workspace.region-context')?.properties.open).toBe(false);
    expect(current.find((object) => object.id === 'workspace.region-thread')?.properties.open).toBe(true);
    unsubscribe();
  });

  it('serializes rapid surface write-through so the latest activation persists', async () => {
    const upstream = new Map<string, boolean>();
    vi.stubGlobal('fetch', vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      const action = JSON.parse(String(init?.body ?? '{}')) as {
        id?: string;
        patch?: { active?: boolean };
      };
      if (action.id === SURFACE_ID && action.patch?.active === true) {
        await new Promise((resolve) => setTimeout(resolve, 20));
      }
      if (action.id && typeof action.patch?.active === 'boolean') {
        upstream.set(action.id, action.patch.active);
      }
      return new Response(JSON.stringify({
        action_kind: 'update',
        status: 'applied',
        target_ids: action.id ? [action.id] : [],
      }), { status: 200 });
    }));
    const host = new ConsoleBlockHost(NO_VIEWS);

    await Promise.all([
      host.activateSurface(SURFACE_ID),
      host.activateSurface('console-workspace'),
    ]);

    expect([...upstream.entries()].filter(([, active]) => active).map(([id]) => id))
      .toEqual(['console-workspace']);
  });

  it('mounts and unmounts the plugin pane as a live contribution', async () => {
    const host = fixtureHost();
    expect(host.queryLayout(surfaceQuery()).objects.some(
      (object) => object.id === CONSOLE_DATA_SURFACE_ID,
    )).toBe(false);

    expect(await activateConsoleDataSurface(host)).toBe(true);
    let objects = host.queryLayout(surfaceQuery()).objects;
    const consoleData = buildSurfaceTree(CONSOLE_DATA_SURFACE_ID, objects);
    expect(consoleData?.children[0]?.children[0]?.object.properties.descriptor_id).toBe(
      'commonplace.console',
    );
    expect(objects.find((object) => object.id === CONSOLE_DATA_SURFACE_ID)?.properties.active)
      .toBe(true);

    expect(await host.activateSurface(SURFACE_ID)).toBe(true);
    expect(await unmountConsoleDataSurface(host)).toBe(true);
    objects = host.queryLayout(surfaceQuery()).objects;
    expect(objects.some((object) => object.id === CONSOLE_DATA_SURFACE_ID)).toBe(false);
    expect(objects.some((object) => object.id === 'console-data.region-editor')).toBe(false);
    expect(objects.some((object) => object.id === 'console-data.vi-pane')).toBe(false);
  });

  it('round-trips server-driven filter and sort through ObjectQuery', async () => {
    const host = fixtureHost();
    const filtered = await Promise.resolve(
      host.query({
        types: ['record'],
        where: { kind: 'eq', field: 'status', value: 'open' },
        rank: [{ kind: 'field', field: 'updated', direction: 'desc' }],
      }),
    );
    expect(filtered.objects.length).toBeGreaterThan(0);
    expect(filtered.objects.every((object) => object.properties.status === 'open')).toBe(true);
    const dates = filtered.objects.map((object) => String(object.properties.updated));
    const sorted = [...dates].sort((a, b) => b.localeCompare(a));
    expect(dates).toEqual(sorted);
  });

  it('serves the full 5000-row fixture deterministically (tests only)', async () => {
    expect(seedRecords()).toHaveLength(RECORD_COUNT);
    expect(seedRecords()[0]).toEqual(seedRecords()[0]);
    const host = fixtureHost();
    const set = await Promise.resolve(host.query({ types: ['record'] }));
    expect(set.objects).toHaveLength(RECORD_COUNT);
  });

  it('patches domain objects in-session and notifies domain subscribers', async () => {
    const host = fixtureHost();
    let notified = 0;
    const set = await Promise.resolve(host.query({ types: ['record'], page: { limit: 1 } }));
    const unsubscribe = set.subscribe(() => {
      notified += 1;
    });
    const target = set.objects[0];
    const receipt = await host.emit({ kind: 'update', id: target.id, patch: { status: 'settled' } });
    expect(receipt.ok).toBe(true);
    expect(notified).toBe(1);
    unsubscribe();
  });

  it('preserves mixed object types when documents share a search query', async () => {
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body ?? '{}')) as { types?: string[] };
      return new Response(JSON.stringify({
        objects: [{ id: 'person-ada', type: 'person', properties: { title: 'Ada Lovelace' } }],
        shape: { types: body.types ?? [], fields: ['title'], relations: [], axes: {}, cardinality: 'one' },
      }), { status: 200 });
    });
    vi.stubGlobal('fetch', fetchMock);
    const host = new ConsoleBlockHost(NO_VIEWS);
    const result = await Promise.resolve(host.query({
      types: ['record', 'person', 'doc'],
      where: { kind: 'contains', field: 'title', value: 'Ada' },
    }));
    const request = JSON.parse(String(fetchMock.mock.calls[0][1]?.body ?? '{}')) as { types?: string[] };
    expect(request.types).toEqual(['record', 'person', 'doc']);
    expect(result.objects[0]?.id).toBe('person-ada');
  });

  it('routes typed Hunk queries and named executor actions through the object seam', async () => {
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body ?? '{}')) as { types?: string[]; tool?: string };
      if (body.types?.includes('hunk')) {
        return new Response(JSON.stringify({
          objects: [],
          shape: { types: ['hunk'], fields: [], relations: [], axes: {}, cardinality: 'empty' },
        }), { status: 200 });
      }
      return new Response(JSON.stringify({ action_kind: 'invoke_tool', status: 'accepted' }), { status: 200 });
    });
    vi.stubGlobal('fetch', fetchMock);
    const host = new ConsoleBlockHost(NO_VIEWS);
    await Promise.resolve(host.query({ types: ['hunk'], live: true }));
    const receipt = await host.emit({
      kind: 'invoke_tool',
      tool: 'hunk.accept',
      args: { hunk_ids: ['hunk:1'] },
    });
    expect(receipt.ok).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[0][0]).toBe('/api/objects/query');
    expect(fetchMock.mock.calls[1][0]).toBe('/api/objects/action');
  });

  it('retries refused remote deletes before adopting a retired layout', async () => {
    let deleteAttempts = 0;
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body ?? '{}')) as {
        kind?: string;
        id?: string;
      };
      if (!body.kind) {
        return Response.json({
          objects: [
            { id: 'console-chat', type: 'surface', properties: { name: 'Chat' } },
            {
              id: 'console.region-landmarks',
              type: 'region',
              properties: { kind: 'landmarks' },
            },
            { id: 'view-chat', type: 'view-instance', properties: {} },
          ],
          shape: {
            types: ['surface', 'region', 'view-instance'],
            fields: [],
            relations: [],
            axes: {},
            cardinality: 'many',
          },
        });
      }
      deleteAttempts += 1;
      if (deleteAttempts === 1) {
        return Response.json({ error: 'temporary refusal' }, { status: 503 });
      }
      return Response.json({
        action_kind: 'delete',
        status: 'applied',
        target_ids: [body.id],
      });
    });
    vi.stubGlobal('fetch', fetchMock);
    const host = new ConsoleBlockHost(NO_VIEWS);

    await host.ensureSeedLayout();

    expect(deleteAttempts).toBe(2);
    expect(
      host.queryLayout(surfaceQuery()).objects.some((object) => object.id === 'view-chat'),
    ).toBe(false);
    const deleteBodies = fetchMock.mock.calls
      .slice(1)
      .map(([, init]) => JSON.parse(String(init?.body ?? '{}')));
    expect(deleteBodies).toEqual([
      { kind: 'delete', id: 'view-chat' },
      { kind: 'delete', id: 'view-chat' },
    ]);
  });

  it('retires the legacy unconsented Console pane without dangling layout edges', async () => {
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body ?? '{}')) as {
        kind?: string;
        id?: string;
      };
      if (!body.kind) {
        return Response.json({
          objects: [
            {
              id: 'console-chat',
              type: 'surface',
              properties: { name: 'Chat' },
              relations: {
                [CONTAINS_EDGE]: [CONSOLE_DATA_SURFACE_ID, 'view-chat'],
              },
            },
            {
              id: 'console.region-landmarks',
              type: 'region',
              properties: { kind: 'landmarks' },
            },
            {
              id: CONSOLE_DATA_SURFACE_ID,
              type: 'surface',
              properties: { seed_revision: 1 },
              relations: { [CONTAINS_EDGE]: ['console-data.region-editor'] },
            },
            {
              id: 'console-data.region-editor',
              type: 'region',
              properties: {},
              relations: { [CONTAINS_EDGE]: ['console-data.vi-pane'] },
            },
            {
              id: 'console-data.vi-pane',
              type: 'view-instance',
              properties: {},
            },
            { id: 'view-chat', type: 'view-instance', properties: {} },
          ],
          shape: {
            types: ['surface', 'region', 'view-instance'],
            fields: [],
            relations: [],
            axes: {},
            cardinality: 'many',
          },
        });
      }
      return Response.json({
        action_kind: 'delete',
        status: 'applied',
        target_ids: body.id ? [body.id] : [],
      });
    });
    vi.stubGlobal('fetch', fetchMock);
    const host = new ConsoleBlockHost(NO_VIEWS);

    await host.ensureSeedLayout();

    const objects = host.queryLayout(surfaceQuery()).objects;
    const retiredIds = new Set([
      CONSOLE_DATA_SURFACE_ID,
      'console-data.region-editor',
      'console-data.vi-pane',
      'view-chat',
    ]);
    expect(objects.some((object) => retiredIds.has(object.id))).toBe(false);
    expect(
      objects.find((object) => object.id === 'console-chat')?.relations?.[CONTAINS_EDGE],
    ).toEqual([]);
    const deletedIds = fetchMock.mock.calls
      .slice(1)
      .map(([, request]) => JSON.parse(String(request?.body ?? '{}')) as { id?: string })
      .map((body) => body.id);
    expect(new Set(deletedIds)).toEqual(retiredIds);
  });

  it('routes canvas ObjectRefs and mutations through the authenticated object seam', async () => {
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body ?? '{}')) as {
        kind?: string;
        props?: Record<string, unknown>;
        patch?: Record<string, unknown>;
      };
      if (!body.kind) {
        return new Response(JSON.stringify({
          objects: [],
          shape: { types: ['canvas'], fields: [], relations: [], axes: {}, cardinality: 'empty' },
        }), { status: 200 });
      }
      return new Response(JSON.stringify({
        action_kind: body.kind,
        status: 'applied',
        target_ids: ['canvas.default'],
        op_range: {
          first_op_id: 'op-1',
          last_op_id: 'op-1',
          range_hash: 'hash-1',
        },
      }), { status: 200 });
    });
    vi.stubGlobal('fetch', fetchMock);
    const host = new ConsoleBlockHost(NO_VIEWS);
    host.query({
      types: ['canvas', 'canvas.card', 'canvas.group', 'canvas.connection'],
      page: { limit: 500 },
    });
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));

    const receipt = await host.emit({
      kind: 'create',
      type: 'note',
      props: {
        id: 'note.object-seam',
        title: 'Persisted note',
        canvasId: 'canvas.default',
        x: 12,
        y: 24,
      },
    });
    const set = host.query({
      types: ['canvas', 'canvas.card', 'canvas.group', 'canvas.connection'],
      page: { limit: 500 },
    });

    expect(receipt.ok).toBe(true);
    expect(receipt.value?.op_range).toBeDefined();
    expect(set).not.toBeInstanceOf(Promise);
    if (set instanceof Promise) throw new Error('canvas query must stay synchronous');
    expect(set.objects.find((object) => object.id === 'note.object-seam')).toMatchObject({
      type: 'canvas.card',
      properties: { x: 12, y: 24 },
    });
    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([
      '/api/objects/query',
      '/api/objects/action',
      '/api/objects/action',
    ]);
    const update = JSON.parse(String(fetchMock.mock.calls[2]?.[1]?.body ?? '{}')) as {
      patch?: Record<string, unknown>;
    };
    expect(update.patch?.persistence_kind).toBe('canvas-work-v1');
  });
});
