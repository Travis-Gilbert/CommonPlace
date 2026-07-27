// SOURCING: none. Pure logic tests for page-owned surface composition.
import { describe, expect, it } from 'vitest';
import { createViewRegistry } from '@commonplace/block-view/registry';
import { upsertCompleteViewAction } from '@commonplace/block-view/surface-actions';
import { ConsoleBlockHost } from './console-host';

describe('upsert_complete_view (CS6)', () => {
  it('replaces three regions with two when regions are passed', async () => {
    const host = new ConsoleBlockHost(createViewRegistry([]), { records: [] });
    const create = await host.emit({
      kind: 'create',
      type: 'surface',
      props: { id: 'view-test', name: 'Test', slug: 'test', active: true },
    });
    expect(create.ok).toBe(true);

    await host.emit(
      upsertCompleteViewAction({
        id: 'view-test',
        regions: [
          { id: 'view-test.r1', props: { kind: 'editor', title: 'A' }, instances: [] },
          { id: 'view-test.r2', props: { kind: 'tool-window', title: 'B', side: 'right' }, instances: [] },
          { id: 'view-test.r3', props: { kind: 'tool-window', title: 'C', side: 'left' }, instances: [] },
        ],
      }),
    );

    const afterThree = host.queryLayout({ types: ['surface', 'region'], live: true });
    const surface = afterThree.objects.find((object) => object.id === 'view-test');
    expect(surface?.relations?.CONTAINS).toHaveLength(3);

    await host.emit(
      upsertCompleteViewAction({
        id: 'view-test',
        regions: [
          { id: 'view-test.r1', props: { kind: 'editor', title: 'A' }, instances: [] },
          { id: 'view-test.r2', props: { kind: 'tool-window', title: 'B', side: 'right' }, instances: [] },
        ],
      }),
    );

    const afterTwo = host.queryLayout({ types: ['surface', 'region'], live: true });
    const updated = afterTwo.objects.find((object) => object.id === 'view-test');
    expect(updated?.relations?.CONTAINS).toEqual(['view-test.r1', 'view-test.r2']);
    expect(afterTwo.objects.some((object) => object.id === 'view-test.r3')).toBe(false);
  });
});
