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
import { clearLayoutCache, writeLayoutCache } from './state/layout-cache';
import {
  RECORD_COUNT,
  SURFACE_ID,
  SURVEY_SURFACE_ID,
  SURVEY_VIEW_INSTANCE_ID,
  seedLayout,
  seedRecords,
} from './workspace-seed';

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
      'console-cards',
      'console-chat',
      'console-docs',
      'console-goals',
      'console-harness-status',
      'console-index',
      'console-proactivity',
      'console-review',
      'console-survey',
      'console-topics',
      'console-workspace',
    ]);
    expect(surfaces.find((surface) => surface.properties.active === true)?.id).toBe(SURFACE_ID);
    expect(surfaces
      .filter((surface) => typeof surface.properties.stripe_order === 'number')
      .sort((a, b) => Number(a.properties.stripe_order) - Number(b.properties.stripe_order))
      .map((surface) => surface.properties.name)).toEqual([
        'Chat', 'Workspace', 'Goal Stack', 'Index', 'Documents', 'Cards',
      ]);
    const workspace = buildSurfaceTree('console-workspace', set.objects);
    expect(workspace!.children.map((child) => child.object.id)).toEqual([
      'region-editor',
      'workspace.region-files',
      'workspace.region-context',
      'workspace.region-thread',
      'workspace.region-automation',
    ]);
    expect(workspace!.children.filter((child) => child.object.properties.role === 'companion')).toHaveLength(4);
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
  });

  it('seeds the landmarks region as frame chrome with stripe view instances', () => {
    const host = new ConsoleBlockHost(NO_VIEWS);
    const set = host.queryLayout(surfaceQuery());
    const landmarks = set.objects.find((object) => object.id === 'console.region-landmarks');
    expect(landmarks?.type).toBe('region');
    expect(landmarks?.properties.kind).toBe('landmarks');
    expect(landmarks?.properties.collapsed).toBe(false);
    expect(landmarks?.relations?.[CONTAINS_EDGE]).toEqual([
      'console.landmark-chat',
      'console.landmark-records',
    ]);
    const chatLandmark = set.objects.find((object) => object.id === 'console.landmark-chat');
    expect(chatLandmark?.properties.descriptor_id).toBe('chat.surface');
    expect(chatLandmark?.properties.pinned).toBe(true);
  });

  it('migrates landmarks into a persisted arrangement that lacked them', () => {
    const withoutLandmarks = seedLayout().filter(
      (object) => !object.id.startsWith('console.region-landmarks') && !object.id.startsWith('console.landmark-'),
    );
    writeLayoutCache(withoutLandmarks);
    const host = new ConsoleBlockHost(NO_VIEWS);
    const set = host.queryLayout(surfaceQuery());
    expect(set.objects.some((object) => object.id === 'console.region-landmarks')).toBe(true);
    expect(set.objects.some((object) => object.id === 'console.landmark-chat')).toBe(true);
    const survey = buildSurfaceTree(SURVEY_SURFACE_ID, set.objects);
    expect(survey!.children[0]?.children[0]?.object.id).toBe(SURVEY_VIEW_INSTANCE_ID);
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
});
