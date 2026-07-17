/**
 * Re-export shim (HANDOFF-GREENFIELD-CONSOLE G0): the block-view contract now
 * lives in packages/block-view as @commonplace/block-view. One contract, no
 * fork; existing apps/web import paths keep working through this shim.
 */
export * from '@commonplace/block-view/types';
