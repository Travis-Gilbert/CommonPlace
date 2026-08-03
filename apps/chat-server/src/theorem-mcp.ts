// SOURCING: none. Pure logic over the opencode config's own MCP shape.
//
// SPEC-COMMONPLACE-OPENWORK-FORK-1.0 OW2, named choice 2: stage one runs
// opencode as a Theorem head, with the Theorem MCP in the engine config and
// graph offload per doctrine. No SDK surgery: this is configuration, and OW6's
// audit is what would license anything more.
//
// The entry is server-managed, not user-managed. Upstream's MCP map comes from
// the runtime DB, which the settings UI writes; an operator can disable the
// head's own graph door there by accident and get a head that silently stops
// reading and writing the graph, with nothing in the session saying so. This
// entry is merged in after the runtime map for that reason, so the workspace
// KV store cannot shadow it.
//
// It is also the reason the Den cloud MCP is not simply repointed: that entry
// was reconciled through a Den token mint (cloud-mcp-health.ts), and reusing
// it would carry the whole control-plane handshake for a head that
// authenticates with a workspace-scoped key.

/** Name the engine registers the head's graph door under. Tools are prefixed with it. */
export const THEOREM_MCP_NAME = "theorem";

/**
 * How narrow the credential on this workspace volume actually is.
 *
 * OW5 puts a checkout and a long-lived credential on the same volume, and a
 * tenant-scoped key there means a compromised container reaches every
 * workspace in the tenant rather than the one it was given. The identity
 * service already mints workspace-scoped keys
 * (`/v1/workspaces/{id}/api-keys`), so the narrow credential is available
 * today; what was missing was this daemon preferring it and saying so when it
 * is handed the broad one.
 *
 * Which variable a key arrived in is the signal, deliberately. A key's scope
 * is a property of the record that issued it, not of its text, so sniffing a
 * prefix would be a guess that reads as a fact.
 */
export type TheoremCredentialScope = "workspace" | "tenant" | "none";

/** The variable a workspace-scoped key arrives in. Preferred over the tenant key. */
const WORKSPACE_KEY_VAR = "THEOREM_WORKSPACE_API_KEY";
/** The tenant-wide key. Still honoured, because refusing it would take the graph door down. */
const TENANT_KEY_VAR = "THEOREM_API_KEY";

export function theoremCredentialScope(
  environment: Readonly<Record<string, string | undefined>> = process.env,
): TheoremCredentialScope {
  if (trimmed(environment[WORKSPACE_KEY_VAR])) return "workspace";
  if (trimmed(environment[TENANT_KEY_VAR])) return "tenant";
  return "none";
}

/**
 * The operator-facing sentence for a credential broader than this workspace.
 *
 * Returned rather than logged so the caller decides where it belongs, and null
 * when there is nothing to say: a warning that fires on the healthy case
 * teaches operators to stop reading warnings.
 */
export function theoremCredentialWarning(
  environment: Readonly<Record<string, string | undefined>> = process.env,
): string | null {
  if (!resolveTheoremMcpConfig(environment)) return null;
  if (theoremCredentialScope(environment) !== "tenant") return null;
  return `The Theorem graph door is authenticated with ${TENANT_KEY_VAR}, which is scoped to the whole tenant. `
    + `This workspace's volume therefore holds a credential for every workspace in it. `
    + `Mint a workspace-scoped key and set ${WORKSPACE_KEY_VAR} instead.`;
}

export type TheoremMcpConfig = {
  readonly type: "remote";
  readonly url: string;
  readonly enabled: true;
  readonly headers?: Record<string, string>;
};

function trimmed(value: string | undefined): string {
  return value?.trim() ?? "";
}

/**
 * The Theorem MCP entry for the engine config, or null when unconfigured.
 *
 * Null is a legitimate state: a workspace running without a harness is a
 * plain opencode head, and inventing a default endpoint here is exactly the
 * hosted-catalog mistake OW1 severed (a third-party host contacted because a
 * constant said so rather than because an operator asked).
 *
 * Both an unset and a malformed URL yield null rather than a throw. A bad
 * value must not take the whole engine config down with it: the failure that
 * matters is "the head has no graph door", which is visible in the session,
 * not a daemon that refuses to start.
 */
export function resolveTheoremMcpConfig(
  environment: Readonly<Record<string, string | undefined>> = process.env,
): TheoremMcpConfig | null {
  const url = trimmed(environment.THEOREM_MCP_URL);
  if (!url) return null;

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;

  // The harness authenticates with a bearer key and scopes by tenant header.
  // Both are optional: a loopback harness in development needs neither, and
  // sending an empty Authorization header would be read as a malformed
  // credential rather than as no credential.
  //
  // The workspace-scoped key wins when both are set. A deployment migrating
  // from the tenant key will have both present for as long as it takes to
  // remove the old variable, and during that window the narrower credential is
  // the one that should be on the wire.
  const apiKey = trimmed(environment[WORKSPACE_KEY_VAR]) || trimmed(environment[TENANT_KEY_VAR]);
  const tenant = trimmed(environment.THEOREM_TENANT_ID);
  const headers: Record<string, string> = {};
  if (apiKey) headers.Authorization = `Bearer ${apiKey}`;
  if (tenant) headers["x-theorem-tenant"] = tenant;

  return {
    type: "remote",
    url,
    enabled: true,
    ...(Object.keys(headers).length ? { headers } : {}),
  };
}

/**
 * Merge the Theorem MCP into a runtime MCP map.
 *
 * Server-managed wins: an entry named "theorem" in the runtime DB is a stale
 * or hand-edited copy, and letting it shadow the resolved one would produce a
 * head pointed at whatever a settings write last said.
 */
export function withTheoremMcp(
  mcp: Record<string, Record<string, unknown>>,
  environment: Readonly<Record<string, string | undefined>> = process.env,
): Record<string, Record<string, unknown>> {
  const theorem = resolveTheoremMcpConfig(environment);
  if (!theorem) return mcp;
  return { ...mcp, [THEOREM_MCP_NAME]: { ...theorem } };
}
