/**
 * Runtime OpenCode configuration injected via a server-managed config file
 * passed to the engine as OPENCODE_CONFIG.
 *
 * This is the single source of truth for the openwork agent definition,
 * plugins, and any other config that should be injected at runtime rather
 * than written to the user's own config files. Both cli.ts and embedded.ts
 * use this.
 *
 * The engine re-reads the OPENCODE_CONFIG file from disk on every instance
 * rebuild (e.g. /instance/dispose), so the file is synchronized on every
 * runtime-DB write — unlike the previous OPENCODE_CONFIG_CONTENT env var,
 * which was frozen at spawn and reverted MCP state on each dispose.
 */
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import {
  openworkExtensionsPreviewPluginPath,
  openworkAnthropicAdaptiveThinkingPluginPath,
  openworkAnthropicToolSchemaPluginPath,
  openworkOfficeAttachmentsPluginPath,
} from "./openwork-extensions-plugin-path.js";
import type { ServerConfig } from "./types.js";
import { runtimeStorageDir } from "./runtime-db.js";
import { THEOREM_MCP_NAME, withTheoremMcp } from "./theorem-mcp.js";
import {
  onRuntimeOpencodeConfigWrite,
  isEngineGlobalRuntimeConfigId,
  readEffectiveRuntimeOpencodeConfig,
  runtimeDisabledProviderList,
  runtimeMcpMap,
  runtimeProviderMap,
  runtimePluginList,
  type RuntimeOpencodeConfig,
} from "./runtime-opencode-config-store.js";

const OPENWORK_AGENT_PROMPT = `You are OpenWork.

When the user refers to "you", they mean the OpenWork app and the current workspace.

Your job:
- Help the user work on files safely.
- Automate repeatable work.
- Keep behavior portable and reproducible.

## Memory

Two kinds:
1. Behavior memory (shareable, in git): .opencode/skills/**, .opencode/agents/**, repo docs
2. Private memory (never commit): tokens, credentials, local config, logs

Hard rule: never copy private memory into repo files. Store only redacted summaries, schemas, and stable pointers.

## Working style

- If required setup or credentials are missing, ask one targeted question and continue once provided.
- If you change code, run the smallest meaningful test.
- If steps repeat, factor them into a skill.
- Prefer clear, practical steps over abstract explanations.

## OpenWork Artifacts

OpenWork can preview, edit, and download standard artifacts when you create or update them in the workspace.

- Prefer standard output files for user-visible deliverables: Markdown (.md), CSV (.csv), Excel workbooks (.xlsx), PowerPoint decks (.pptx), and browser previews (index.html or a local http://localhost:<port> URL).
- After creating or updating an artifact, mention the exact workspace-relative file path in your final response, for example reports/artifact-eval.md or reports/artifact-eval.xlsx.
- Do not invent Workspace/<id>/... paths unless a tool returns them; prefer clean workspace-relative paths.
- For websites or React/UI previews, start the dev server when useful and mention the http://localhost:<port> URL.
- For spreadsheets, use .csv for simple tabular data and .xlsx when the user asks for Excel/XLS specifically.

## The graph

Durable context lives in the Theorem graph, reached through the \`${THEOREM_MCP_NAME}\` MCP. It is NOT a local file: never write memories to .opencode/ or any file in the workspace.

The graph is not a key-value store you post strings into. Recall before you assume, and offload before you reason:
- Before answering from what you remember of this session, recall. A stale belief that reads as confident is worse than a lookup.
- For questions with an exact answer over structure or tables (reachability, closure, shortest paths, counts, aggregations, joins, set operations), route the question to the graph and reason over the returned facts. Do not compute those by inspection.
- Encode outcomes, decisions, and corrections that a later session would otherwise have to rediscover. Do not encode the transcript.

Discover the tools the \`${THEOREM_MCP_NAME}\` MCP actually exposes and use those; do not guess tool names. If the MCP is absent, say the graph is unavailable and continue without it. Never fabricate a receipt, a citation, or a recall result.

Ask the human before persisting anything they did not clearly intend to keep, and never persist secrets, credentials, API keys, tokens, or sensitive personal data. That applies to the content and to any snippet cited with it: redact before saving.`;

export async function buildOpenworkRuntimeConfigObject(
  config?: ServerConfig,
  workspaceId?: string,
): Promise<Record<string, unknown>> {
  const runtimeConfig = config && workspaceId ? await readEffectiveRuntimeOpencodeConfig(config, workspaceId) : {};
  return buildOpenworkRuntimeConfigObjectFromSnapshot(runtimeConfig);
}

export function buildOpenworkRuntimeConfigObjectFromSnapshot(
  runtimeConfig: RuntimeOpencodeConfig,
): Record<string, unknown> {
  const disabledProviders = runtimeDisabledProviderList(runtimeConfig);
  const provider = runtimeProviderMap(runtimeConfig);
  return {
    ...runtimeConfig,
    default_agent: runtimeConfig.default_agent ?? "openwork",
    agent: {
      openwork: {
        description: "OpenWork default agent",
        mode: "primary",
        temperature: 0.2,
        prompt: OPENWORK_AGENT_PROMPT,
        permission: {
          skill: {
            // OpenWork supplies its own current skill routing and no longer
            // supports these engine or legacy workspace skills.
            "customize-opencode": "deny",
            "get-started": "deny",
            "command-creator": "deny",
            "agent-creator": "deny",
            "plugin-creator": "deny",
          },
        },
      },
    },
    plugin: [
      "opencode-chrome-devtools",
      openworkExtensionsPreviewPluginPath(),
      openworkOfficeAttachmentsPluginPath(),
      openworkAnthropicAdaptiveThinkingPluginPath(),
      openworkAnthropicToolSchemaPluginPath(),
      ...runtimePluginList(runtimeConfig),
    ],
    ...(disabledProviders.length ? { disabled_providers: disabledProviders } : {}),
    // OW2: the head's graph door is merged over the operator-managed map, so a
    // settings write cannot silently disconnect the head from the graph.
    mcp: withTheoremMcp(runtimeMcpMap(runtimeConfig)),
    ...(Object.keys(provider).length ? { provider } : {}),
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function stableJsonValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stableJsonValue);
  if (!isRecord(value)) return value;
  return Object.fromEntries(
    Object.keys(value)
      .sort()
      .map((key) => [key, stableJsonValue(value[key])]),
  );
}

function stableStringify(value: unknown): string {
  return JSON.stringify(stableJsonValue(value));
}

export async function buildOpenworkRuntimeConfig(config?: ServerConfig, workspaceId?: string): Promise<string> {
  return stableStringify(await buildOpenworkRuntimeConfigObject(config, workspaceId));
}

export function openworkRuntimeConfigFilePath(config: ServerConfig): string {
  return join(runtimeStorageDir(config), "runtime-opencode-config.json");
}

// Serialize file writes per path so a slow older write can never land after
// (and clobber) a newer one. Content is built inside the queued job so each
// job reads the latest runtime-DB state.
export interface OpenworkRuntimeConfigWriteResult {
  path: string;
  changed: boolean;
}

const fileWriteQueue = new Map<string, Promise<OpenworkRuntimeConfigWriteResult>>();

/**
 * Rebuild the engine-visible runtime config file from the runtime DB.
 * Atomic (temp file + rename) so the engine never reads a partial file
 * mid-dispose.
 */
export async function writeOpenworkRuntimeConfigFile(
  config: ServerConfig,
  workspaceId: string,
): Promise<OpenworkRuntimeConfigWriteResult> {
  const path = openworkRuntimeConfigFilePath(config);
  const job = async () => {
    const content = await buildOpenworkRuntimeConfig(config, workspaceId);
    const current = await readFile(path, "utf8").catch(() => undefined);
    if (current === content) return { path, changed: false };
    await mkdir(runtimeStorageDir(config), { recursive: true });
    const tmp = `${path}.${randomUUID()}.tmp`;
    await writeFile(tmp, content, "utf8");
    await rename(tmp, path);
    return { path, changed: true };
  };
  const previous = fileWriteQueue.get(path) ?? Promise.resolve();
  const next = previous.then(job, job);
  fileWriteQueue.set(path, next);
  return await next;
}

/**
 * Keep the runtime config file in sync with the runtime DB so every engine
 * instance rebuild reads fresh state instead of a spawn-time snapshot.
 * Returns an unsubscribe function.
 */
export function keepOpenworkRuntimeConfigFileFresh(config: ServerConfig, workspaceId: string): () => void {
  return onRuntimeOpencodeConfigWrite((writeConfig, writtenWorkspaceId) => {
    if (writtenWorkspaceId !== workspaceId && !isEngineGlobalRuntimeConfigId(writtenWorkspaceId)) return;
    void writeOpenworkRuntimeConfigFile(writeConfig, workspaceId).catch(() => undefined);
  });
}
