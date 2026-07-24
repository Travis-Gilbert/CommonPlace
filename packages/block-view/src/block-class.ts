// SOURCING: none. Pure logic, no upstream component applies.
// Homogeneous-block rule (paint treatment on the ground): a surface with three
// or more ground blocks must include at least two base classes.

import type { BlockSurfaceClass } from './types';

/** Resolve the block base class; omitted declarations default to tool. */
export function resolveBlockSurfaceClass(
  declared?: BlockSurfaceClass,
): BlockSurfaceClass {
  return declared ?? 'tool';
}

/**
 * True when `classes` is a defect: three or more blocks and fewer than two
 * distinct base classes.
 */
export function hasHomogeneousBlockDefect(
  classes: readonly BlockSurfaceClass[],
): boolean {
  if (classes.length < 3) return false;
  return new Set(classes).size < 2;
}
