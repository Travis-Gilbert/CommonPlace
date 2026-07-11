import { describe, it, expect } from 'vitest';
import type { ActionKind, ObjectShape } from '@/lib/block-view/types';
import { V2_VIEW_REGISTRY, matchingViews, viewById } from './view-registry';

// The full declared ActionKind union (SPEC-OBJECT-CONTRACT-V2). A view may only
// promise to emit kinds drawn from this set.
const ALL_ACTION_KINDS: readonly ActionKind[] = [
  'create',
  'update',
  'move',
  'delete',
  'link',
  'unlink',
  'run_agent',
  'invoke_tool',
  'dispatch',
  'open',
  'select',
];

const manyShape: ObjectShape = {
  types: ['task'],
  fields: ['id', 'title', 'status'],
  relations: [],
  axes: {},
  cardinality: 'many',
};

describe('V2 view registry (TW5)', () => {
  it('registers table and board in switcher order', () => {
    expect(V2_VIEW_REGISTRY.map((view) => view.id)).toEqual(['table', 'board']);
  });

  it('every view emits only declared ActionKinds', () => {
    for (const view of V2_VIEW_REGISTRY) {
      expect(view.emits.length).toBeGreaterThan(0);
      for (const kind of view.emits) {
        expect(ALL_ACTION_KINDS).toContain(kind);
      }
    }
  });

  it('every view carries a render component', () => {
    for (const view of V2_VIEW_REGISTRY) {
      expect(typeof view.render).toBe('function');
    }
  });

  it('matchingViews returns shape-accepting views in registry order', () => {
    expect(matchingViews(manyShape).map((view) => view.id)).toEqual(['table', 'board']);
  });

  it('matchingViews still offers the table for a fieldless shape', () => {
    const empty: ObjectShape = { types: [], fields: [], relations: [], axes: {}, cardinality: 'empty' };
    expect(matchingViews(empty).map((view) => view.id)).toContain('table');
  });

  it('viewById resolves a registered view and misses cleanly', () => {
    expect(viewById('board')?.name).toBe('Board');
    expect(viewById('nope')).toBeUndefined();
  });
});
