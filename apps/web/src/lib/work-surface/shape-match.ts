/**
 * Re-export shim (HANDOFF-GREENFIELD-CONSOLE G0): the ObjectShapeMatch
 * interpreter now lives in packages/block-view. Existing import paths keep
 * working; the tests in shape-match.test.ts exercise the package code.
 */
export * from '@commonplace/block-view/shape-match';
