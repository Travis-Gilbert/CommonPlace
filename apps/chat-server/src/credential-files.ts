// SOURCING: none — pure logic over this daemon's own workspace layout. The
// question is "does this workspace-relative path name a file that holds
// provider keys or MCP authorization headers", which is specific to the file
// names OpenCode and OpenWork write; no upstream component models it.

/**
 * Files inside a workspace that hold credentials.
 *
 * The lesson that produced this module: the config *routes* were gated one at
 * a time (GET /opencode-config, then GET /config, then the export), and each
 * time a different door to the same bytes stayed open — the engine proxy, then
 * the generic file reader, which will happily serve .opencode/opencode.json to
 * a viewer verbatim. Gating routes does not protect a secret. The secret is in
 * a file, so the rule belongs to the file.
 *
 * Matching is on the path, not the contents: a viewer must not learn whether
 * the file happens to contain a key today.
 */
const CREDENTIAL_FILE_NAMES = new Set([
  "opencode.json",
  "opencode.jsonc",
  "openwork.json",
  "auth.json",
  ".env",
]);

/** Directories whose entire contents are treated as credential-bearing. */
const CREDENTIAL_DIRECTORY_SEGMENTS = [[".opencode", "auth"], [".opencode", "openwork", "secrets"]];

function segmentsOf(relativePath: string): string[] {
  return relativePath.split("/").filter(Boolean);
}

/**
 * True when a workspace-relative path names a credential-bearing file.
 *
 * Both `opencode.json` and `.opencode/opencode.json` count: the engine reads a
 * project config from either position, and both can carry a provider block or
 * an MCP entry with an Authorization header. `.env` variants count for the
 * same reason.
 */
export function isCredentialBearingWorkspacePath(relativePath: string): boolean {
  const segments = segmentsOf(relativePath);
  if (segments.length === 0) return false;

  const name = segments[segments.length - 1]!.toLowerCase();
  if (CREDENTIAL_FILE_NAMES.has(name)) return true;
  // .env.local, .env.production, and friends.
  if (name.startsWith(".env.")) return true;

  const lowered = segments.map((segment) => segment.toLowerCase());
  return CREDENTIAL_DIRECTORY_SEGMENTS.some((prefix) =>
    prefix.every((segment, index) => lowered[index] === segment),
  );
}

/**
 * Whether an actor at `scope` may read `relativePath`'s contents.
 *
 * Only viewers are restricted. A collaborator can already write these files
 * through the config routes, so withholding the read would be theatre.
 */
export function canReadWorkspacePath(scope: string | undefined, relativePath: string): boolean {
  if (scope !== "viewer") return true;
  return !isCredentialBearingWorkspacePath(relativePath);
}
