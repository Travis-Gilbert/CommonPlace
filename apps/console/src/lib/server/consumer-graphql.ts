// SOURCING: none. Server-only consumer GraphQL endpoint selection.

/**
 * Proactivity and Filing belong to the CommonPlace consumer schema. They must
 * not fall back to CONSOLE_HARNESS_URL, which is the Harness MCP service and
 * does not own their fields.
 */
export function consumerGraphqlUrl(
  environment: Readonly<Record<string, string | undefined>> = process.env,
): string | null {
  const configured = environment.THEOREM_GRAPHQL_URL?.trim();
  if (!configured) return null;

  const base = configured.replace(/\/+$/, '');
  return base.endsWith('/graphql') ? base : `${base}/graphql`;
}
