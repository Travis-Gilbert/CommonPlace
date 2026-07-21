// SOURCING: none. Pure logic, no upstream component applies.
// Homogeneous-island rule (HANDOFF-CONSOLE-ISLAND-SHELL): a surface with three
// or more islands must include at least two base classes.

import type { IslandSurfaceClass } from './types';

/** Resolve the island base class; omitted declarations default to tool. */
export function resolveIslandSurfaceClass(
  declared?: IslandSurfaceClass,
): IslandSurfaceClass {
  return declared ?? 'tool';
}

/**
 * True when `classes` is a defect: three or more islands and fewer than two
 * distinct base classes.
 */
export function hasHomogeneousIslandDefect(
  classes: readonly IslandSurfaceClass[],
): boolean {
  if (classes.length < 3) return false;
  return new Set(classes).size < 2;
}
