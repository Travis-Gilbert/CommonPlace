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
import { RECORD_COUNT, SURFACE_ID, seedRecords } from './workspace-seed';

const NO_VIEWS = { matchingViews: () => [] };

afterEach(() => {
  vi.unstubAllGlobals();
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
      'region-left',
      'region-editor',
      'region-right',
    ]);
    const editor = root!.children.find((child) => child.object.id === 'region-editor')!;
    expect(editor.children.map((node) => node.object.id)).toEqual(['vi-brief', 'vi-code']);
  });

  it('seeds all named surfaces with their own regions (R3)', () => {
    const host = new ConsoleBlockHost(NO_VIEWS);
    const set = host.queryLayout(surfaceQuery());
    const surfaces = set.objects.filter((object) => object.type === 'surface');
    expect(surfaces.map((surface) => surface.id).sort()).toEqual([
      'console-docs',
      'console-index',
      'console-proactivity',
      'console-review',
      'console-workspace',
    ]);
    expect(surfaces.find((surface) => surface.properties.active === true)?.id).toBe(SURFACE_ID);
    const index = buildSurfaceTree('console-index', set.objects);
    expect(index!.children.map((child) => child.object.id)).toEqual([
      'index.region-rail',
      'index.region-editor',
    ]);
  });

  it('applies moveSurfaceNodeAction semantics: re-parent with order', async () => {
    const host = new ConsoleBlockHost(NO_VIEWS);
    const receipt = await host.emit({ kind: 'move', id: 'vi-code', new_parent: 'region-left', order: 0 });
    expect(receipt.ok).toBe(true);
    expect(receipt.value?.status).toBe('applied');
    const set = host.queryLayout(surfaceQuery());
    const left = set.objects.find((object) => object.id === 'region-left')!;
    const editor = set.objects.find((object) => object.id === 'region-editor')!;
    expect(left.relations?.[CONTAINS_EDGE]).toEqual(['vi-code', 'vi-records']);
    expect(editor.relations?.[CONTAINS_EDGE]).toEqual(['vi-brief']);
  });

  it('notifies layout subscribers on update', async () => {
    const host = new ConsoleBlockHost(NO_VIEWS);
    const set = host.queryLayout(surfaceQuery());
    let notified = 0;
    const unsubscribe = set.subscribe(() => {
      notified += 1;
    });
    await host.emit({ kind: 'update', id: 'region-left', patch: { size: 30 } });
    expect(notified).toBe(1);
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
