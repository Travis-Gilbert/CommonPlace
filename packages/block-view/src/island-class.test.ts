// SOURCING: none. Pure logic, no upstream component applies.
import { describe, expect, it } from 'vitest';
import {
  hasHomogeneousIslandDefect,
  resolveIslandSurfaceClass,
} from './island-class';

describe('island-class', () => {
  it('defaults omitted surface class to tool', () => {
    expect(resolveIslandSurfaceClass()).toBe('tool');
    expect(resolveIslandSurfaceClass('editor')).toBe('editor');
  });

  it('allows fewer than three islands of one class', () => {
    expect(hasHomogeneousIslandDefect([])).toBe(false);
    expect(hasHomogeneousIslandDefect(['tool', 'tool'])).toBe(false);
  });

  it('flags three or more islands of a single class', () => {
    expect(hasHomogeneousIslandDefect(['tool', 'tool', 'tool'])).toBe(true);
    expect(hasHomogeneousIslandDefect(['editor', 'editor', 'editor', 'editor'])).toBe(
      true,
    );
  });

  it('passes when three or more islands mix classes', () => {
    expect(hasHomogeneousIslandDefect(['tool', 'tool', 'editor'])).toBe(false);
    expect(
      hasHomogeneousIslandDefect(['tool', 'tool', 'tool', 'editor']),
    ).toBe(false);
  });
});
