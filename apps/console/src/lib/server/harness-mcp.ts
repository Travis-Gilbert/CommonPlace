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

const MCP_PROTOCOL_VERSION = '2025-06-18';
const MCP_TEARDOWN_TIMEOUT_MS = 2_000;

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
  const headers = {
    Accept: 'application/json, text/event-stream',
    'Content-Type': 'application/json',
    'MCP-Protocol-Version': MCP_PROTOCOL_VERSION,
    ...principalTenantHeaders(resolution.principal),
    ...(process.env.CONSOLE_HARNESS_TOKEN
      ? { Authorization: `Bearer ${process.env.CONSOLE_HARNESS_TOKEN}` }
      : {}),
  };
  let sessionId: string | null = null;
  try {
    const initialized = await fetch(endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: `initialize-${Date.now()}`,
        method: 'initialize',
        params: {
          protocolVersion: MCP_PROTOCOL_VERSION,
          capabilities: {},
          clientInfo: { name: 'commonplace-console', version: '1' },
        },
      }),
      cache: 'no-store',
      signal: timeout.signal,
    });
    const initializePayload = await readMcpPayload(initialized);
    sessionId = initialized.headers.get('mcp-session-id')?.trim() || null;
    if (!initialized.ok || !sessionId || !record(initializePayload?.result)) {
      return {
        ok: false,
        response: Response.json(
          { error: 'harness_mcp_initialization_failed', status: initialized.status },
          { status: initialized.ok ? 502 : initialized.status },
        ),
      };
    }

    const sessionHeaders = { ...headers, 'MCP-Session-Id': sessionId };
    const ready = await fetch(endpoint, {
      method: 'POST',
      headers: sessionHeaders,
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'notifications/initialized',
      }),
      cache: 'no-store',
      signal: timeout.signal,
    });
    if (!ready.ok) {
      return {
        ok: false,
        response: Response.json(
          { error: 'harness_mcp_initialization_failed', status: ready.status },
          { status: ready.status },
        ),
      };
    }
    await ready.arrayBuffer();

    const upstream = await fetch(endpoint, {
      method: 'POST',
      headers: sessionHeaders,
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
    const payload = await readMcpPayload(upstream);
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
    if (sessionId) {
      await fetch(endpoint, {
        method: 'DELETE',
        headers: {
          ...headers,
          'MCP-Session-Id': sessionId,
        },
        cache: 'no-store',
        signal: AbortSignal.timeout(MCP_TEARDOWN_TIMEOUT_MS),
      }).catch(() => null);
    }
    timeout.clear();
  }
}

async function readMcpPayload(response: Response): Promise<Record<string, unknown> | null> {
  if (response.headers.get('content-type')?.includes('application/json')) {
    return await response.json().catch(() => null) as Record<string, unknown> | null;
  }
  const reader = response.body?.getReader();
  if (!reader) return null;

  const decoder = new TextDecoder();
  let buffer = '';
  let dataLines: string[] = [];
  try {
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) return parseMcpEvent(dataLines);
      buffer += decoder.decode(chunk.value, { stream: true });
      const lines = buffer.split(/\r?\n/);
      buffer = lines.pop() ?? '';
      for (const line of lines) {
        if (line === '') {
          if (dataLines.length === 0) continue;
          const payload = parseMcpEvent(dataLines);
          dataLines = [];
          return payload;
        }
        if (!line.startsWith('data:')) continue;
        dataLines.push(line.slice('data:'.length).replace(/^ /, ''));
      }
    }
  } finally {
    await reader.cancel().catch(() => undefined);
  }
}

function parseMcpEvent(dataLines: readonly string[]): Record<string, unknown> | null {
  if (dataLines.length === 0) return null;
  try {
    return record(JSON.parse(dataLines.join('\n')));
  } catch {
    return null;
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
