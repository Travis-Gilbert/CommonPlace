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
    expect(registry.blocksForMount('island')).toEqual([]);
  });

  it('filters blocksForMount by declared mounts', () => {
    const registry = createViewRegistry([
      descriptor('records', {
        usage: 'browse records',
        mounts: ['island', 'surface'],
        sizes: ['m', 'w', 'full'],
        density: 'compact',
      }),
      descriptor('composer', {
        usage: 'compose with the agent',
        mounts: ['surface', 'island'],
        sizes: ['w', 'full'],
        density: 'both',
      }),
      descriptor('stripe-only', {
        usage: 'navigate surfaces',
        mounts: ['stripe'],
        sizes: ['s'],
        density: 'compact',
      }),
      descriptor('no-block'),
    ]);

    expect(registry.blocksForMount('island').map((view) => view.id)).toEqual([
      'records',
      'composer',
    ]);
    expect(registry.blocksForMount('stripe').map((view) => view.id)).toEqual([
      'stripe-only',
    ]);
    expect(registry.blocksForMount('companion')).toEqual([]);
  });
});
