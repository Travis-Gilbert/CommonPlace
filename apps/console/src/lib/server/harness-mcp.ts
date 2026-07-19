import {
  principalTenantHeaders,
  resolveHarnessPrincipal,
  type HarnessPrincipal,
} from '@/lib/server/harness-principal';
import { identityBoundArguments } from '@/lib/harness-mcp-core';
import { startHarnessRequestTimeout } from '@/lib/server/harness-timeout';

export type HarnessMcpResult =
  | { ok: true; data: Record<string, unknown>; principal: HarnessPrincipal }
  | { ok: false; response: Response };

export async function callHarnessMcp(
  name: string,
  argumentsValue: Record<string, unknown>,
): Promise<HarnessMcpResult> {
  const resolution = await resolveHarnessPrincipal();
  if (!resolution.ok) return { ok: false, response: resolution.response };
  const base = process.env.CONSOLE_HARNESS_URL;
  if (!base) {
    return {
      ok: false,
      response: Response.json({ error: 'console_harness_unconfigured' }, { status: 404 }),
    };
  }
  const endpoint = `${base.replace(/\/(?:mcp)?\/?$/, '')}/mcp`;
  const timeout = startHarnessRequestTimeout();
  try {
    const upstream = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...principalTenantHeaders(resolution.principal),
        ...(process.env.CONSOLE_HARNESS_TOKEN
          ? { Authorization: `Bearer ${process.env.CONSOLE_HARNESS_TOKEN}` }
          : {}),
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: `${name}-${Date.now()}`,
        method: 'tools/call',
        params: {
          name,
          arguments: identityBoundArguments(argumentsValue, resolution.principal),
        },
      }),
      cache: 'no-store',
      signal: timeout.signal,
    });
    const payload = (await upstream.json().catch(() => null)) as Record<string, unknown> | null;
    if (!upstream.ok) {
      return {
        ok: false,
        response: Response.json(
          { error: 'harness_mcp_failed', status: upstream.status },
          { status: upstream.status },
        ),
      };
    }
    const rpcError = record(payload?.error);
    if (rpcError) {
      return {
        ok: false,
        response: Response.json(
          { error: 'harness_mcp_refused', detail: rpcError.message },
          { status: 502 },
        ),
      };
    }
    const data = normalizeResult(payload?.result);
    if (!data) {
      return {
        ok: false,
        response: Response.json({ error: 'harness_mcp_invalid_result' }, { status: 502 }),
      };
    }
    return { ok: true, data, principal: resolution.principal };
  } catch {
    return {
      ok: false,
      response: Response.json(
        { error: timeout.didTimeout() ? 'harness_mcp_timeout' : 'harness_mcp_unreachable' },
        { status: timeout.didTimeout() ? 504 : 502 },
      ),
    };
  } finally {
    timeout.clear();
  }
}

function normalizeResult(value: unknown): Record<string, unknown> | null {
  const result = record(value);
  if (!result || result.isError === true) return null;
  const structured = record(result.structuredContent);
  if (structured && Object.keys(structured).length > 0) return structured;
  const content = Array.isArray(result.content) ? result.content : [];
  for (const entry of content) {
    const text = record(entry)?.text;
    if (typeof text !== 'string') continue;
    try {
      const parsed = record(JSON.parse(text));
      if (parsed) return parsed;
    } catch {
      return null;
    }
  }
  return null;
}

function record(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}
