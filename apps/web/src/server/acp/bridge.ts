/**
 * Re-export shim (HANDOFF-CONSOLE-ROUND-2 R2.2): the Theorem ACP server
 * modules now live in packages/theorem-acp. Existing import paths keep
 * working; apps/console consumes the same package.
 */
export * from '@commonplace/theorem-acp/bridge';
