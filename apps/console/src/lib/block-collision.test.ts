import { describe, expect, it } from 'vitest';
import { createBlockCollisionDetection } from './block-collision';

describe('block-collision', () => {
  it('exports a collision detection factory', () => {
    expect(typeof createBlockCollisionDetection()).toBe('function');
  });
});
