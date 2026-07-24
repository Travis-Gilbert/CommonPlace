// SOURCING: none. Pure logic, no upstream component applies.
import { describe, expect, it } from 'vitest';
import {
  hasHomogeneousBlockDefect,
  resolveBlockSurfaceClass,
} from './block-class';

describe('block surface class', () => {
  it('defaults omitted declarations to tool', () => {
    expect(resolveBlockSurfaceClass()).toBe('tool');
    expect(resolveBlockSurfaceClass('editor')).toBe('editor');
  });

  it('flags homogeneous sets of three or more', () => {
    expect(hasHomogeneousBlockDefect(['tool', 'tool'])).toBe(false);
    expect(hasHomogeneousBlockDefect(['tool', 'tool', 'tool'])).toBe(true);
    expect(hasHomogeneousBlockDefect(['tool', 'tool', 'editor'])).toBe(false);
  });
});
