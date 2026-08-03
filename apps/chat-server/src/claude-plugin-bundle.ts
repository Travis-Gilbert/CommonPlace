// SOURCING: none. The Claude Code plugin layout is a published format, not a
// component: this file is the parser for it, and no package on npm reads it.
// The GitHub reads are three plain REST calls against a base URL that must
// stay overridable for tests (OPENWORK_GITHUB_API_BASE), which @octokit/rest
// would carry a dependency and an auth model to do no better.
/**
 * Claude Code plugin bundle compatibility.
 *
 * Resolves a GitHub repo containing a Claude Code plugin
 * (`.claude-plugin/plugin.json` + `.mcp.json` + `skills/` + `commands/` +
 * `agents/`) into the existing CloudPluginResolved shape, so installation
 * reuses installCloudPlugin: namespacing, Claude frontmatter translation,
 * MCP registration, the install registry, uninstall, approvals, and reload
 * events all come for free.
 *
 * Format reference: https://code.claude.com/docs/en/plugins-reference
 */
import { ByteBudget, PayloadTooLargeError, readBoundedText } from "./bounded-body.js";
import { ApiError } from "./errors.js";
import { parseFrontmatter } from "./frontmatter.js";
import type { CloudPluginResolved } from "./cloud-plugins.js";
import { externalFetch } from "./server-fetch.js";

// Every limit below exists because this resolver walks a repository chosen by
// the caller. Authorization now runs before resolution (server.ts), so the
// caller is at least a collaborator, but a collaborator naming a pathological
// repository is still a repository this process has to survive: a dry run is
// an unwritten preview, and an unwritten preview that exhausts the host is
// still an outage.
//
// The numbers are sized against real plugins rather than round figures. The
// largest bundles in this ecosystem carry tens of components and SKILL.md
// files in the low tens of kilobytes, so these leave roughly an order of
// magnitude of headroom and still refuse a repository that is not a plugin.

/** A tree listing large enough that the repository is not a plugin. */
const MAX_TREE_ENTRIES = 20_000;
/** The trees API response itself, which `recursive=1` can grow without bound. */
const MAX_TREE_BYTES = 8 * 1024 * 1024;
/** One manifest, MCP file, SKILL.md, command, or agent. */
const MAX_FILE_BYTES = 512 * 1024;
/** Every file one resolution downloads, summed. */
const MAX_BUNDLE_BYTES = 16 * 1024 * 1024;
/** Installable components in one bundle. */
const MAX_COMPONENTS = 500;

/**
 * Turn a byte-limit refusal into the API's own error shape.
 *
 * 413 rather than 502: the far end behaved correctly and this server declined
 * the size, which is a different fact from GitHub failing, and the two were
 * worth telling apart in an operator's logs.
 */
function asApiError(error: unknown): unknown {
  if (error instanceof PayloadTooLargeError) {
    return new ApiError(413, "plugin_too_large", `${error.subject} is too large to install (limit ${error.limit} bytes).`);
  }
  return error;
}

export type ClaudePluginSource = {
  owner: string;
  repo: string;
  ref: string | null;
  dir: string | null;
  /**
   * Raw path segments after `/tree/` when present. Branch names may contain
   * slashes (e.g. `release/v1`), so the ref/dir split is ambiguous from the
   * URL alone — the resolver tries candidates against the trees API.
   */
  treeSegments: string[] | null;
};

export type ClaudePluginComponent = {
  type: "mcp" | "skill" | "command" | "agent";
  name: string;
  description: string | null;
};

export type ClaudePluginPreview = {
  pluginId: string;
  name: string;
  description: string | null;
  version: string | null;
  source: { owner: string; repo: string; ref: string; dir: string | null };
  components: ClaudePluginComponent[];
  warnings: string[];
};

export type ClaudePluginBundle = {
  resolved: CloudPluginResolved;
  preview: ClaudePluginPreview;
};

function githubApiBase(): string {
  return (process.env.OPENWORK_GITHUB_API_BASE?.trim() || "https://api.github.com").replace(/\/+$/, "");
}

function githubRawBase(): string {
  return (process.env.OPENWORK_GITHUB_RAW_BASE?.trim() || "https://raw.githubusercontent.com").replace(/\/+$/, "");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

// GitHub owners are alphanumeric + hyphen; repos additionally allow dots and underscores.
const GITHUB_OWNER_RE = /^[A-Za-z0-9-]+$/;
const GITHUB_REPO_RE = /^[A-Za-z0-9._-]+$/;

/**
 * Accepts `https://github.com/owner/repo`, `github.com/owner/repo`,
 * `owner/repo`, with optional `.git` suffix and `/tree/<ref>(/<subdir>)`.
 */
export function parseClaudePluginSource(input: string): ClaudePluginSource {
  // Drop query strings and hash fragments (e.g. ?tab=readme-ov-file).
  const trimmed = (input.split(/[?#]/)[0] ?? "").trim();
  if (!trimmed) throw new ApiError(400, "invalid_plugin_url", "GitHub URL is required");
  const withoutProtocol = trimmed.replace(/^https?:\/\//, "");
  const hadHost = /^[A-Za-z0-9.-]+\.[A-Za-z]{2,}\//.test(withoutProtocol);
  if (hadHost && !withoutProtocol.startsWith("github.com/")) {
    throw new ApiError(400, "invalid_plugin_url", "Only github.com sources are supported");
  }
  const path = hadHost ? withoutProtocol.slice(withoutProtocol.indexOf("/") + 1) : withoutProtocol;
  const parts = path.split("/").filter(Boolean);
  const owner = parts[0] ?? "";
  const repo = (parts[1] ?? "").replace(/\.git$/, "");
  if (!GITHUB_OWNER_RE.test(owner) || !GITHUB_REPO_RE.test(repo)) {
    throw new ApiError(400, "invalid_plugin_url", "Expected a GitHub repo URL like https://github.com/owner/repo");
  }
  let ref: string | null = null;
  let dir: string | null = null;
  let treeSegments: string[] | null = null;
  if (parts[2] === "tree" && parts[3]) {
    treeSegments = parts.slice(3);
    ref = parts[3] ?? null;
    const rest = parts.slice(4);
    if (rest.length > 0) dir = rest.join("/");
  }
  return { owner, repo, ref, dir, treeSegments };
}

async function fetchGithubJson(url: string, limit: number, subject: string): Promise<unknown> {
  const response = await externalFetch(url, {
    headers: { Accept: "application/vnd.github+json", "User-Agent": "openwork-server" },
    signal: AbortSignal.timeout(20_000),
  });
  if (!response.ok) {
    // The error body is attacker-influenced too, so it is read under the same
    // ceiling as a success body rather than with response.text().
    const text = await readBoundedText(response, 8 * 1024, subject).catch(() => "");
    throw new ApiError(502, "plugin_fetch_failed", `Failed to fetch plugin data (${response.status}): ${text || url}`);
  }
  const text = await readBoundedText(response, limit, subject);
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new ApiError(502, "plugin_fetch_failed", `${subject} is not valid JSON`);
  }
}

async function fetchGithubText(url: string, subject: string, budget?: ByteBudget): Promise<string> {
  const response = await externalFetch(url, {
    headers: { Accept: "text/plain", "User-Agent": "openwork-server" },
    signal: AbortSignal.timeout(20_000),
  });
  if (!response.ok) {
    const text = await readBoundedText(response, 8 * 1024, subject).catch(() => "");
    throw new ApiError(502, "plugin_fetch_failed", `Failed to fetch plugin file (${response.status}): ${text || url}`);
  }
  return readBoundedText(response, MAX_FILE_BYTES, subject, budget);
}

type TreeEntry = { path: string; sha: string };

async function fetchRepoTree(source: ClaudePluginSource, ref: string): Promise<TreeEntry[]> {
  const url = `${githubApiBase()}/repos/${encodeURIComponent(source.owner)}/${encodeURIComponent(source.repo)}/git/trees/${encodeURIComponent(ref)}?recursive=1`;
  const tree = await fetchGithubJson(url, MAX_TREE_BYTES, `The tree of ${source.owner}/${source.repo}`);
  const entries = isRecord(tree) && Array.isArray(tree.tree) ? tree.tree : [];
  // Counted before filtering to blobs. The cost being bounded is the walk over
  // every entry and the Map built from it, which a repository of directories
  // pays just as surely as one of files.
  if (entries.length > MAX_TREE_ENTRIES) {
    throw new ApiError(
      413,
      "plugin_too_large",
      `${source.owner}/${source.repo} lists ${entries.length} paths, past the ${MAX_TREE_ENTRIES} this can resolve. Point the URL at the plugin directory: /tree/<ref>/<dir>.`,
    );
  }
  return entries.flatMap((entry) => {
    if (!isRecord(entry) || entry.type !== "blob") return [];
    if (typeof entry.path !== "string" || typeof entry.sha !== "string") return [];
    return [{ path: entry.path, sha: entry.sha }];
  });
}

async function resolveDefaultBranch(source: ClaudePluginSource): Promise<string> {
  const url = `${githubApiBase()}/repos/${encodeURIComponent(source.owner)}/${encodeURIComponent(source.repo)}`;
  try {
    const info = await fetchGithubJson(url, 256 * 1024, `The repository record for ${source.owner}/${source.repo}`);
    if (isRecord(info) && typeof info.default_branch === "string" && info.default_branch.trim()) {
      return info.default_branch.trim();
    }
  } catch {
    // Fall through to "main" below.
  }
  return "main";
}

function rawFileUrl(source: ClaudePluginSource, ref: string, path: string): string {
  const segments = path.split("/").map((segment) => encodeURIComponent(segment)).join("/");
  // Branch names may contain slashes; raw URLs expect them as path segments.
  const refSegments = ref.split("/").map((segment) => encodeURIComponent(segment)).join("/");
  return `${githubRawBase()}/${encodeURIComponent(source.owner)}/${encodeURIComponent(source.repo)}/${refSegments}/${segments}`;
}

// Branch names may contain slashes (release/v1), so a /tree/<...> URL is
// ambiguous between ref and subdirectory. Try progressively longer refs
// against the trees API and use the first that resolves.
async function resolveRefAndTree(
  source: ClaudePluginSource,
  explicitRef: string | undefined,
): Promise<{ ref: string; dir: string | null; tree: TreeEntry[] }> {
  const candidates: Array<{ ref: string; dir: string | null }> = [];
  if (explicitRef) {
    let dir = source.dir;
    if (source.treeSegments) {
      const joined = source.treeSegments.join("/");
      dir = joined === explicitRef
        ? null
        : joined.startsWith(`${explicitRef}/`)
          ? joined.slice(explicitRef.length + 1)
          : source.dir;
    }
    candidates.push({ ref: explicitRef, dir });
  } else if (source.treeSegments && source.treeSegments.length > 0) {
    for (let index = 1; index <= source.treeSegments.length; index += 1) {
      candidates.push({
        ref: source.treeSegments.slice(0, index).join("/"),
        dir: index < source.treeSegments.length ? source.treeSegments.slice(index).join("/") : null,
      });
    }
  } else {
    candidates.push({ ref: await resolveDefaultBranch(source), dir: null });
  }

  let lastError: unknown = null;
  for (const candidate of candidates) {
    try {
      const tree = await fetchRepoTree(source, candidate.ref);
      return { ref: candidate.ref, dir: candidate.dir, tree };
    } catch (error) {
      lastError = error;
    }
  }
  if (lastError instanceof Error) throw lastError;
  throw new ApiError(404, "plugin_ref_not_found", "Could not resolve the requested branch or tag");
}

// Find the plugin root: the given subdir, the repo root, or the shallowest
// directory containing `.claude-plugin/plugin.json`.
function locatePluginRoot(tree: TreeEntry[], dir: string | null): string {
  const manifestPaths = tree
    .map((entry) => entry.path)
    .filter((path) => path === ".claude-plugin/plugin.json" || path.endsWith("/.claude-plugin/plugin.json"));
  if (dir) {
    const normalized = dir.replace(/\/+$/, "");
    const expected = `${normalized}/.claude-plugin/plugin.json`;
    if (!manifestPaths.includes(expected)) {
      throw new ApiError(404, "plugin_manifest_not_found", `No .claude-plugin/plugin.json found under ${normalized}/`);
    }
    return `${normalized}/`;
  }
  if (manifestPaths.length === 0) {
    throw new ApiError(404, "plugin_manifest_not_found", "No .claude-plugin/plugin.json found in this repository");
  }
  manifestPaths.sort((a, b) => a.split("/").length - b.split("/").length || a.localeCompare(b));
  const shallowest = manifestPaths[0]!;
  const root = shallowest.slice(0, shallowest.length - ".claude-plugin/plugin.json".length);
  const sameDepth = manifestPaths.filter((path) => path.split("/").length === shallowest.split("/").length);
  if (sameDepth.length > 1) {
    const candidates = sameDepth
      .map((path) => path.slice(0, path.length - "/.claude-plugin/plugin.json".length))
      .join(", ");
    throw new ApiError(400, "plugin_ambiguous", `Multiple plugins found (${candidates}). Add the plugin directory to the URL, e.g. /tree/main/<dir>.`);
  }
  return root;
}

function readString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function readPathList(value: unknown): string[] {
  if (typeof value === "string") return value.trim() ? [value.trim()] : [];
  if (Array.isArray(value)) return value.flatMap((entry) => (typeof entry === "string" && entry.trim() ? [entry.trim()] : []));
  return [];
}

function normalizeRelative(root: string, path: string): string {
  const cleaned = path.replace(/^\.\//, "").replace(/^\/+/, "");
  if (cleaned.split("/").some((part) => part === "..")) return "";
  return `${root}${cleaned}`;
}

async function mapWithConcurrency<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let index = 0;
  const workers = new Array(Math.min(limit, items.length)).fill(0).map(async () => {
    while (index < items.length) {
      const current = index++;
      results[current] = await fn(items[current]!);
    }
  });
  await Promise.all(workers);
  return results;
}

const CLAUDE_PLUGIN_ROOT_VAR = "${CLAUDE_PLUGIN_ROOT}";

function mcpConfigReferencesPluginRoot(config: unknown): boolean {
  if (typeof config === "string") return config.includes(CLAUDE_PLUGIN_ROOT_VAR);
  if (Array.isArray(config)) return config.some((entry) => mcpConfigReferencesPluginRoot(entry));
  if (isRecord(config)) return Object.values(config).some((entry) => mcpConfigReferencesPluginRoot(entry));
  return false;
}

/**
 * Resolve a Claude Code plugin repository into an installable bundle.
 *
 * The byte ceilings live inside the reader, so they surface as
 * PayloadTooLargeError from wherever the limit was reached. Translating here
 * rather than at each of the six call sites keeps one answer for "too large"
 * and stops a limit refusal from reaching the route handler as an untyped
 * error, which would have become a 500 that reads like a server fault.
 */
export async function resolveClaudePluginBundle(input: { url: string; ref?: string }): Promise<ClaudePluginBundle> {
  try {
    return await resolveBundle(input);
  } catch (error) {
    throw asApiError(error);
  }
}

async function resolveBundle(input: { url: string; ref?: string }): Promise<ClaudePluginBundle> {
  const source = parseClaudePluginSource(input.url);
  const { ref, dir, tree } = await resolveRefAndTree(source, input.ref?.trim() || undefined);
  const root = locatePluginRoot(tree, dir);
  const treeByPath = new Map(tree.map((entry) => [entry.path, entry]));
  const warnings: string[] = [];

  // One allowance for every file this resolution downloads. Per-file limits
  // alone would let a repository of ten thousand small files pass every
  // individual check and still exhaust the host.
  const budget = new ByteBudget(MAX_BUNDLE_BYTES, `This plugin's files`);

  const manifestPath = `${root}.claude-plugin/plugin.json`;
  const manifestText = await fetchGithubText(rawFileUrl(source, ref, manifestPath), manifestPath, budget);
  let manifest: Record<string, unknown>;
  try {
    const parsed: unknown = JSON.parse(manifestText);
    if (!isRecord(parsed)) throw new Error("not an object");
    manifest = parsed;
  } catch {
    throw new ApiError(400, "invalid_plugin_manifest", `${manifestPath} is not valid JSON`);
  }

  const pluginName = readString(manifest.displayName) ?? readString(manifest.name);
  if (!pluginName) {
    throw new ApiError(400, "invalid_plugin_manifest", `${manifestPath} is missing a plugin name`);
  }
  const description = readString(manifest.description);
  const version = readString(manifest.version);
  if (manifest.hooks !== undefined) {
    warnings.push("This plugin declares hooks, which OpenWork does not support yet. Hooks were skipped.");
  }

  // --- Collect component file paths -----------------------------------------
  const inTree = (path: string) => treeByPath.has(path);

  const collectMarkdown = (declared: string[], defaultDir: string): string[] => {
    const roots = declared.length > 0
      ? declared.map((entry) => normalizeRelative(root, entry)).filter(Boolean)
      : [`${root}${defaultDir}`];
    const paths = new Set<string>();
    for (const entry of roots) {
      if (entry.endsWith(".md") && inTree(entry)) {
        paths.add(entry);
        continue;
      }
      const prefix = `${entry.replace(/\/+$/, "")}/`;
      for (const candidate of treeByPath.keys()) {
        if (candidate.startsWith(prefix) && candidate.endsWith(".md")) paths.add(candidate);
      }
    }
    return [...paths].sort();
  };

  const commandPaths = collectMarkdown(readPathList(manifest.commands), "commands");
  const agentPaths = collectMarkdown(readPathList(manifest.agents), "agents");

  // Skills are directories containing SKILL.md.
  const skillRoots = readPathList(manifest.skills).map((entry) => normalizeRelative(root, entry)).filter(Boolean);
  const skillPrefixes = skillRoots.length > 0 ? skillRoots.map((entry) => `${entry.replace(/\/+$/, "")}/`) : [`${root}skills/`];
  const skillEntrypoints = [...treeByPath.keys()]
    .filter((path) => skillPrefixes.some((prefix) => path.startsWith(prefix)) && path.endsWith("/SKILL.md"))
    .sort();
  const skillExtraFiles = new Map<string, number>();
  for (const entrypoint of skillEntrypoints) {
    const skillDir = entrypoint.slice(0, -"SKILL.md".length);
    const extras = [...treeByPath.keys()].filter((path) => path.startsWith(skillDir) && path !== entrypoint);
    if (extras.length > 0) skillExtraFiles.set(entrypoint, extras.length);
  }
  if (skillExtraFiles.size > 0) {
    warnings.push(
      `Some skills bundle extra files beyond SKILL.md (${[...skillExtraFiles.keys()].map((path) => path.split("/").at(-2)).join(", ")}). Only SKILL.md is installed for now.`,
    );
  }

  // --- MCP servers -----------------------------------------------------------
  const mcpServers: Record<string, unknown> = {};
  const addMcpServers = (value: unknown) => {
    if (!isRecord(value)) return;
    const record = isRecord(value.mcpServers) ? value.mcpServers : value;
    for (const [name, config] of Object.entries(record)) {
      if (!isRecord(config)) continue;
      if (mcpConfigReferencesPluginRoot(config)) {
        warnings.push(`MCP server "${name}" uses \${CLAUDE_PLUGIN_ROOT} (a plugin-local command), which OpenWork does not support yet. It was skipped.`);
        continue;
      }
      mcpServers[name] = config;
    }
  };

  const declaredMcp = manifest.mcpServers;
  if (typeof declaredMcp === "string") {
    const mcpPath = normalizeRelative(root, declaredMcp);
    if (mcpPath && inTree(mcpPath)) {
      const text = await fetchGithubText(rawFileUrl(source, ref, mcpPath), mcpPath, budget);
      try {
        addMcpServers(JSON.parse(text));
      } catch {
        warnings.push(`${mcpPath} is not valid JSON; its MCP servers were skipped.`);
      }
    }
  } else if (isRecord(declaredMcp)) {
    addMcpServers(declaredMcp);
  }
  const dotMcpPath = `${root}.mcp.json`;
  if (inTree(dotMcpPath)) {
    const text = await fetchGithubText(rawFileUrl(source, ref, dotMcpPath), dotMcpPath, budget);
    try {
      addMcpServers(JSON.parse(text));
    } catch {
      warnings.push(`${dotMcpPath} is not valid JSON; its MCP servers were skipped.`);
    }
  }

  // --- Fetch component contents ----------------------------------------------
  type FetchedComponent = {
    type: "skill" | "command" | "agent";
    path: string;
    title: string;
    description: string | null;
    content: string;
  };

  const componentInputs = [
    ...skillEntrypoints.map((path) => ({ type: "skill" as const, path })),
    ...commandPaths.map((path) => ({ type: "command" as const, path })),
    ...agentPaths.map((path) => ({ type: "agent" as const, path })),
  ];

  // Refused before the first download rather than during it. A manifest whose
  // `commands` points at the repository root collects every .md file in the
  // tree, and finding that out after six hundred round trips is finding it out
  // too late.
  if (componentInputs.length > MAX_COMPONENTS) {
    throw new ApiError(
      413,
      "plugin_too_large",
      `This plugin declares ${componentInputs.length} components, past the ${MAX_COMPONENTS} that can be installed at once.`,
    );
  }

  const fetched = await mapWithConcurrency(componentInputs, 6, async (item): Promise<FetchedComponent> => {
    const content = await fetchGithubText(rawFileUrl(source, ref, item.path), item.path, budget);
    const { data } = parseFrontmatter(content);
    const fallbackTitle = item.type === "skill"
      ? item.path.split("/").at(-2) ?? "skill"
      : (item.path.split("/").at(-1) ?? "").replace(/\.md$/, "");
    const frontmatterName = readString(data.name);
    return {
      type: item.type,
      path: item.path,
      title: item.type === "skill" && frontmatterName ? frontmatterName : fallbackTitle,
      description: readString(data.description),
      content,
    };
  });

  // --- Assemble CloudPluginResolved -------------------------------------------
  const dirSuffix = dir ? `#${dir}` : "";
  const pluginId = `github:${source.owner}/${source.repo}${dirSuffix}`;
  const memberships: CloudPluginResolved["memberships"] = fetched.map((component) => ({
    configObjectId: component.path,
    configObject: {
      id: component.path,
      objectType: component.type,
      title: component.title,
      description: component.description,
      currentRelativePath: null,
      status: "active",
      updatedAt: null,
      latestVersion: {
        id: treeByPath.get(component.path)?.sha ?? component.path,
        rawSourceText: component.content,
        normalizedPayloadJson: null,
      },
    },
  }));

  if (Object.keys(mcpServers).length > 0) {
    memberships.push({
      configObjectId: `${pluginId}/mcp`,
      configObject: {
        id: `${pluginId}/mcp`,
        objectType: "mcp",
        title: `${pluginName} MCP`,
        description: null,
        currentRelativePath: null,
        status: "active",
        updatedAt: null,
        latestVersion: {
          id: treeByPath.get(dotMcpPath)?.sha ?? `${pluginId}/mcp`,
          rawSourceText: null,
          normalizedPayloadJson: { mcpServers },
        },
      },
    });
  }

  if (memberships.length === 0) {
    throw new ApiError(400, "plugin_empty", "This plugin has no MCP servers, skills, commands, or agents OpenWork can install.");
  }

  const resolved: CloudPluginResolved = {
    plugin: {
      id: pluginId,
      name: pluginName,
      description,
      updatedAt: null,
    },
    memberships,
  };

  const components: ClaudePluginComponent[] = [
    ...Object.keys(mcpServers).map((name) => ({ type: "mcp" as const, name, description: null })),
    ...fetched.map((component) => ({ type: component.type, name: component.title, description: component.description })),
  ];

  return {
    resolved,
    preview: {
      pluginId,
      name: pluginName,
      description,
      version,
      source: { owner: source.owner, repo: source.repo, ref, dir },
      components,
      warnings,
    },
  };
}
