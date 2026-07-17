// SOURCING: none. Pure logic, no upstream component applies.
// The marriage requirement, tested: the arrangement is data; move and update
// semantics mutate the surface object and notify; the seed is deterministic.

import { describe, expect, it } from 'vitest';
import { CONTAINS_EDGE } from '@commonplace/block-view/surface-tree';
import { buildSurfaceTree, surfaceQuery } from '@commonplace/block-view/surface-tree';
import { ConsoleBlockHost } from './console-host';
import { RECORD_COUNT, SURFACE_ID, seedRecords } from './workspace-seed';

const NO_VIEWS = { matchingViews: () => [] };

describe('ConsoleBlockHost', () => {
  it('serves the seeded arrangement as a surface tree', () => {
    const host = new ConsoleBlockHost(NO_VIEWS);
    const set = host.query(surfaceQuery());
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

  it('applies moveSurfaceNodeAction semantics: re-parent with order', async () => {
    const host = new ConsoleBlockHost(NO_VIEWS);
    const receipt = await host.emit({ kind: 'move', id: 'vi-code', new_parent: 'region-left', order: 0 });
    expect(receipt.ok).toBe(true);
    expect(receipt.value?.status).toBe('applied');
    const set = host.query(surfaceQuery());
    const left = set.objects.find((object) => object.id === 'region-left')!;
    const editor = set.objects.find((object) => object.id === 'region-editor')!;
    expect(left.relations?.[CONTAINS_EDGE]).toEqual(['vi-code', 'vi-records']);
    expect(editor.relations?.[CONTAINS_EDGE]).toEqual(['vi-brief']);
  });

  it('notifies layout subscribers on update', async () => {
    const host = new ConsoleBlockHost(NO_VIEWS);
    const set = host.query(surfaceQuery());
    let notified = 0;
    const unsubscribe = set.subscribe(() => {
      notified += 1;
    });
    await host.emit({ kind: 'update', id: 'region-left', patch: { size: 30 } });
    expect(notified).toBe(1);
    unsubscribe();
  });

  it('round-trips server-driven filter and sort through ObjectQuery', () => {
    const host = new ConsoleBlockHost(NO_VIEWS);
    const filtered = host.query({
      types: ['record'],
      where: { kind: 'eq', field: 'status', value: 'open' },
      rank: [{ kind: 'field', field: 'updated', direction: 'desc' }],
    });
    expect(filtered.objects.length).toBeGreaterThan(0);
    expect(filtered.objects.every((object) => object.properties.status === 'open')).toBe(true);
    const dates = filtered.objects.map((object) => String(object.properties.updated));
    const sorted = [...dates].sort((a, b) => b.localeCompare(a));
    expect(dates).toEqual(sorted);
  });

  it('serves the full 5000-row fixture deterministically', () => {
    expect(seedRecords()).toHaveLength(RECORD_COUNT);
    expect(seedRecords()[0]).toEqual(seedRecords()[0]);
    const host = new ConsoleBlockHost(NO_VIEWS);
    expect(host.query({ types: ['record'] }).objects).toHaveLength(RECORD_COUNT);
  });

  it('patches domain objects in-session and notifies domain subscribers', async () => {
    const host = new ConsoleBlockHost(NO_VIEWS);
    let notified = 0;
    const set = host.query({ types: ['record'], page: { limit: 1 } });
    const unsubscribe = set.subscribe(() => {
      notified += 1;
    });
    const target = set.objects[0];
    const receipt = await host.emit({ kind: 'update', id: target.id, patch: { status: 'settled' } });
    expect(receipt.ok).toBe(true);
    expect(notified).toBe(1);
    unsubscribe();
  });
});
