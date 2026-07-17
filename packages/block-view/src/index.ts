// SOURCING: none. Pure logic, no upstream component applies.
/**
 * @commonplace/block-view: the block-view object contract, extracted from
 * apps/web per HANDOFF-GREENFIELD-CONSOLE G0. One contract, no fork:
 * apps/web consumes this package through re-export shims, apps/console
 * imports it directly. Zero CSS, zero components by construction.
 */

export * from './types';
export * from './shape-match';
export * from './registry';
// Both ./types and ./surface-tree declare a SurfaceTreeNode (the contract
// carries the historical shape, the tree builder carries the render shape the
// web SurfaceRenderer actually walks). The explicit re-export resolves the
// star-export ambiguity in favor of the render shape; the contract shape stays
// reachable through the ./types subpath.
export * from './surface-tree';
export { type SurfaceTreeNode } from './surface-tree';
export * from './surface-actions';
export * from './database/model';
export * from './host/HttpBlockHost';
export * from './host/MemoryBlockHost';
export * from './host/useDatabase';
