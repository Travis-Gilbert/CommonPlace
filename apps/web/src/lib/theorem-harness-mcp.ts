// SOURCING: none — pure JSON-RPC-over-fetch transport plus JSON narrowing. No MCP
// client library is adopted in apps/web/package.json; the repo already hand-rolls
// this exact tools/call transport in api/theorem/harness/summary/route.ts, and this
// module factors that proven pattern out for reuse. No upstream UI component applies.
/**
 * Shared client for calling harness MCP tools over JSON-RPC (tools/call).
 *
 * This is the live bridge to the RustyRed harness runtime (memory, rooms,
 * coordination). It is the same transport the harness summary route
 * (api/theorem/harness/summary/route.ts) already uses in production; factored
 * here so other product routes can reach harness memory without re-deriving the
 * endpoint resolution and JSON-RPC plumbing.
 *
 * Migration note: when commonplace-api grows native memory resolvers (the
 * canonical "one door"), harness memory reads should move behind
 * /api/theorem/graphql. Until the harness memory store is co-located with
 * commonplace-api (today it is a separate, possibly hosted, RedCore store), the
 * MCP path is the only path that reaches the live memory documents.
 */
import { THEOREM_HARNESS_MCP_URL } from '@/lib/theorem-hosted';

const MCP_PATH = '/mcp';
const LOCAL_MCP_URL = 'http://127.0.0.1:17888/mcp';
const REQUEST_TIMEOUT_MS = 12_000;

export interface HarnessMcpCallResult {
  ok: boolean;
  data?: Record<string, unknown>;
  attempts: string[];
}

/**
 * Call a harness MCP tool by name. Tries each configured endpoint in order and
 * returns the first structured payload. Never throws: a failed call resolves
 * with ok=false and the collected attempt errors, so callers can render an
 * honest unavailable state instead of a 500.
 */
export async function callHarnessMcpTool(
  name: string,
  args: Record<string, unknown>,
): Promise<HarnessMcpCallResult> {
  const attempts: string[] = [];
  for (const endpoint of mcpEndpoints()) {
    try {
      const data = await callOnce(endpoint, name, args);
      return { ok: true, data, attempts };
    } catch (err) {
      attempts.push(`${sourceLabel(endpoint)}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
  return { ok: false, attempts };
}

async function callOnce(
  endpoint: string,
  name: string,
  args: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: mcpHeaders(),
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: `${name}-${Date.now()}`,
        method: 'tools/call',
        params: { name, arguments: args },
      }),
      cache: 'no-store',
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`MCP returned ${response.status}.`);

    const rpc = asRecord(await response.json());
    const error = asRecord(rpc?.error);
    if (error) throw new Error(text(error.message) ?? 'MCP tool call failed.');
    return normalizeResult(rpc?.result);
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw new Error(`MCP timed out after ${REQUEST_TIMEOUT_MS}ms.`);
    }
    throw err;
  } finally {
    clearTimeout(timeout);
  }
}

function normalizeResult(result: unknown): Record<string, unknown> {
  const record = asRecord(result);
  if (!record) throw new Error('MCP returned an invalid result.');
  if (record.isError === true) throw new Error(contentText(record) ?? 'MCP tool returned an error.');

  const structured = asRecord(record.structuredContent);
  if (structured && Object.keys(structured).length > 0) return structured;

  const payload = contentText(record);
  if (payload) {
    try {
      const parsed = asRecord(JSON.parse(payload));
      if (parsed) return parsed;
    } catch {
      throw new Error('MCP returned non-JSON content.');
    }
  }
  throw new Error('MCP result had no structured payload.');
}

function contentText(result: Record<string, unknown>): string | undefined {
  for (const item of asArray(result.content)) {
    const value = text(asRecord(item)?.text);
    if (value) return value;
  }
  return undefined;
}

function mcpEndpoints(): string[] {
  const configured = [
    process.env.THEOREM_HARNESS_MCP_URL,
    process.env.THEOREM_MCP_URL,
    process.env.THEOREM_HARNESS_URL,
    process.env.THEOREM_API_URL,
    process.env.NEXT_PUBLIC_HARNESS_URL,
    process.env.NEXT_PUBLIC_THEOREM_API_URL,
  ]
    .map(normalizeEndpoint)
    .filter(nonNullable);
  const defaults =
    process.env.NODE_ENV === 'development'
      ? [LOCAL_MCP_URL, THEOREM_HARNESS_MCP_URL]
      : [THEOREM_HARNESS_MCP_URL];
  return Array.from(new Set([...configured, ...defaults]));
}

function normalizeEndpoint(value: unknown): string | undefined {
  const raw = text(value);
  if (!raw) return undefined;
  try {
    const url = new URL(raw);
    const pathname = url.pathname.replace(/\/+$/, '');
    if (!pathname) {
      url.pathname = MCP_PATH;
      url.search = '';
      url.hash = '';
      return url.toString();
    }
    if (pathname.endsWith(MCP_PATH)) return url.toString().replace(/\/+$/, '');
    const basePath = pathname.replace(/\/(?:graphql|api\/theorem\/agent|v1\/theorem\/agent\/run)$/i, '');
    url.pathname = `${basePath}${MCP_PATH}`.replace(/\/{2,}/g, '/');
    url.search = '';
    url.hash = '';
    return url.toString();
  } catch {
    return raw.replace(/\/+$/, '');
  }
}

function mcpHeaders(): HeadersInit {
  const token = text(
    process.env.THEOREM_HARNESS_API_TOKEN ??
      process.env.THEOREM_MCP_API_TOKEN ??
      process.env.THEOREM_HARNESS_BEARER ??
      process.env.THEOREM_MCP_BEARER ??
      process.env.THEOREM_API_TOKEN ??
      process.env.THEOREM_AGENT_API_TOKEN ??
      process.env.RUSTYRED_AGENT_BEARER ??
      process.env.HARNESS_API_KEY,
  );
  return token
    ? { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }
    : { 'Content-Type': 'application/json' };
}

function sourceLabel(endpoint: string): string {
  try {
    const url = new URL(endpoint);
    if (url.hostname === '127.0.0.1' || url.hostname === 'localhost') return 'local MCP';
    if (url.hostname.includes('railway.app')) return 'hosted MCP';
    return `${url.hostname}${url.pathname}`;
  } catch {
    return 'configured MCP';
  }
}

/* Narrow JSON helpers (kept local so this module has no runtime deps). */

export function asRecord(value: unknown): Record<string, unknown> | undefined {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

export function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

export function text(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function nonNullable<T>(value: T | null | undefined): value is T {
  return value !== null && value !== undefined;
}
