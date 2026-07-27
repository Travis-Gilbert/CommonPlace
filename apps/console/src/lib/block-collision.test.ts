import { describe, expect, it } from 'vitest';
import {
  acceptsBlockDrop,
  createBlockCollisionDetection,
} from './block-collision';

describe('block-collision', () => {
  it('exports a collision detection factory', () => {
    expect(typeof createBlockCollisionDetection()).toBe('function');
  });

  it('accepts both typed semantics when the descriptor matches', () => {
    expect(
      acceptsBlockDrop(
        {
          acceptsDrop: {
            semantic: 'contain',
            layout: 'columns',
            accepts: ['record.table'],
          },
        },
        'record.table',
      ),
    ).toBe(true);
    expect(
      acceptsBlockDrop(
        {
          acceptsDrop: {
            semantic: 'relate',
            edge: 'RELATED_TO',
            accepts: ['model.kind'],
          },
        },
        'model.kind',
      ),
    ).toBe(true);
  });

  it('keeps undeclared and descriptor-mismatched targets inert', () => {
    expect(acceptsBlockDrop(undefined, 'record.table')).toBe(false);
    expect(acceptsBlockDrop({}, 'record.table')).toBe(false);
    expect(
      acceptsBlockDrop(
        {
          acceptsDrop: {
            semantic: 'relate',
            edge: 'RELATED_TO',
            accepts: ['model.kind'],
          },
        },
        'record.table',
      ),
    ).toBe(false);
  });
});
