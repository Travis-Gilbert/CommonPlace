import { describe, expect, it } from 'vitest';
import {
  buildExplicitViewSelection,
  pickPrimaryEntitySelection,
  resolveSelectionExprId,
} from './resolveSelectionExprId';

describe('resolveSelectionExprId', () => {
  it('prefers payload expr_id over the path map', () => {
    expect(
      resolveSelectionExprId(
        { type: 'entity', entity_path: '/proto/a/box', expr_id: 'expr:payload' },
        { '/proto/a/box': 'expr:map' },
      ),
    ).toBe('expr:payload');
  });

  it('fills expr_id from the load-time path map when payload omits it', () => {
    expect(
      resolveSelectionExprId(
        { type: 'entity', entity_path: '/proto/a/box' },
        { '/proto/a/box': 'expr:map' },
      ),
    ).toBe('expr:map');
  });

  it('returns null when neither payload nor map can supply expr_id', () => {
    expect(
      resolveSelectionExprId({ type: 'entity', entity_path: '/proto/a/box' }, {}),
    ).toBeNull();
  });
});

describe('buildExplicitViewSelection', () => {
  it('builds the Theorem ViewSelectionEvent shape', () => {
    expect(
      buildExplicitViewSelection(
        { type: 'entity', entity_path: '/proto/assemble/box_a', expr_id: 'expr:box_a' },
        {},
      ),
    ).toEqual({
      entity_path: '/proto/assemble/box_a',
      expr_id: 'expr:box_a',
      part_name: 'box_a',
    });
  });
});

describe('pickPrimaryEntitySelection', () => {
  it('v1: first entity wins when multiple entities are selected', () => {
    const item = pickPrimaryEntitySelection({
      items: [
        { type: 'space' },
        { type: 'entity', entity_path: '/proto/a/first' },
        { type: 'entity', entity_path: '/proto/a/second' },
      ],
    });
    expect(item?.entity_path).toBe('/proto/a/first');
  });

  it('returns null when no entity items are present', () => {
    expect(
      pickPrimaryEntitySelection({ items: [{ type: 'space' }] }),
    ).toBeNull();
  });
});
