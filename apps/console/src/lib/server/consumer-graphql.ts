// SOURCING: none. Server-side consumer GraphQL endpoint selection.
// HANDOFF-CONSOLE-SINGLE-DOOR-1.0: CONSOLE_DATA_API_URL is the only data door.

import 'server-only';

/**
 * Proactivity, Filing, Indexer, and RustyWeb search belong to the CommonPlace
 * consumer schema. They must not fall back to CONSOLE_HARNESS_URL, which is the
 * Harness MCP agent door and does not own their fields.
 */
export function consumerGraphqlUrl(
  environment: Readonly<Record<string, string | undefined>> = process.env,
): string | null {
  const configured =
    environment.CONSOLE_DATA_API_URL?.trim()
    || environment.THEOREM_GRAPHQL_URL?.trim();
  if (!configured) return null;

  const base = configured.replace(/\/+$/, '');
  return base.endsWith('/graphql') ? base : `${base}/graphql`;
}
