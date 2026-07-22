// SOURCING: none. Pure logic, no upstream component applies.
import { describe, expect, it } from 'vitest';
import { createViewRegistry } from './registry';
import type { ViewDescriptor } from './types';

const noopRender = (() => null) as unknown as ViewDescriptor['render'];

function descriptor(
  id: string,
  block?: ViewDescriptor['block'],
): ViewDescriptor {
  return {
    id,
    name: id,
    accepts: { cardinality: 'any' },
    emits: ['open'],
    renderer: id,
    source: {
      package: '@commonplace/block-view',
      component: id,
      mode: 'bespoke',
      regime: 'css-vars',
      allowedBespokeReason: 'unit fixture',
    },
    render: noopRender,
    ...(block ? { block } : {}),
  };
}

describe('ViewRegistry presentation grammar', () => {
  it('registers a descriptor without block (additive compatibility)', () => {
    const registry = createViewRegistry([descriptor('surface-only')]);
    expect(registry.viewById('surface-only')).toBeDefined();
    expect(registry.matchingViews({
      types: [],
      fields: [],
      relations: [],
      axes: {},
      cardinality: 'many',
    }).map((view) => view.id)).toContain('surface-only');
    expect(registry.blocksForPlacement('ground')).toEqual([]);
  });

  it('filters blocksForPlacement by declared placements', () => {
    const registry = createViewRegistry([
      descriptor('records', {
        usage: 'browse records',
        placements: ['ground', 'full'],
        defaultSize: 'm',
        density: 'compact',
      }),
      descriptor('composer', {
        usage: 'compose with the agent',
        placements: ['full', 'ground'],
        defaultSize: 'w',
        density: 'both',
      }),
      descriptor('rail-only', {
        usage: 'navigate surfaces',
        placements: ['rail'],
        defaultSize: 's',
        density: 'compact',
      }),
      descriptor('kanban', {
        usage: 'arrange cards in columns',
        placements: ['ground', 'full'],
        defaultSize: 'w',
        density: 'cozy',
        acceptsChildren: { layout: 'columns', accepts: ['*'] },
      }),
      descriptor('no-block'),
    ]);

    expect(registry.blocksForPlacement('ground').map((view) => view.id)).toEqual([
      'records',
      'composer',
      'kanban',
    ]);
    expect(registry.blocksForPlacement('rail').map((view) => view.id)).toEqual([
      'rail-only',
    ]);
    expect(registry.blocksForPlacement('dock')).toEqual([]);
    expect(registry.viewById('kanban')?.block?.acceptsChildren?.layout).toBe('columns');
  });
});
