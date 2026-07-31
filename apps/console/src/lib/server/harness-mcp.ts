import 'server-only';

import { createHash } from 'node:crypto';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import {
  StreamableHTTPClientTransport,
  StreamableHTTPError,
} from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { McpError } from '@modelcontextprotocol/sdk/types.js';
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

type HarnessMcpClient = {
  client: Client;
  transport: StreamableHTTPClientTransport;
};

type CachedHarnessMcpClient = {
  pending: Promise<HarnessMcpClient>;
  lastUsedAt: number;
};

const MCP_CLIENT_IDLE_TTL_MS = 5 * 60_000;
const MCP_CLIENT_CACHE_MAX_ENTRIES = 64;
const clientByCredential = new Map<string, CachedHarnessMcpClient>();

class MissingMcpSessionError extends Error {
  constructor() {
    super('MCP initialize completed without a session id');
  }
}

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
  const credential = process.env.CONSOLE_HARNESS_TOKEN?.trim() ?? '';
  const cacheKey = credentialCacheKey(
    endpoint,
    credential,
    resolution.principal.tenant,
    resolution.principal.harnessIdentity,
  );
  const timeout = startHarnessRequestTimeout();
  let activeClient: HarnessMcpClient | undefined;
  try {
    const result = await callToolWithSessionRetry({
      endpoint,
      credential,
      cacheKey,
      principal: resolution.principal,
      name,
      argumentsValue,
      signal: timeout.signal,
      onConnection(connection) {
        activeClient = connection;
      },
    });
    const data = normalizeResult(result);
    if (!data) {
      return {
        ok: false,
        response: Response.json({ error: 'harness_mcp_invalid_result' }, { status: 502 }),
      };
    }
    return { ok: true, data, principal: resolution.principal };
  } catch (error) {
    if (timeout.didTimeout() && activeClient) {
      void evictClient(cacheKey, activeClient);
    }
    return {
      ok: false,
      response: transportFailureResponse(error, timeout.didTimeout(), activeClient),
    };
  } finally {
    timeout.clear();
  }
}

async function callToolWithSessionRetry(input: {
  endpoint: string;
  credential: string;
  cacheKey: string;
  principal: HarnessPrincipal;
  name: string;
  argumentsValue: Record<string, unknown>;
  signal: AbortSignal;
  onConnection?: (connection: HarnessMcpClient) => void;
}): Promise<unknown> {
  let connection = await clientForCredential(input);
  input.onConnection?.(connection);
  try {
    return await callTool(connection, input);
  } catch (error) {
    if (!isSessionError(error, connection)) throw error;
    await evictClient(input.cacheKey, connection);
    connection = await clientForCredential(input);
    input.onConnection?.(connection);
    try {
      return await callTool(connection, input);
    } catch (retryError) {
      if (isSessionError(retryError, connection)) {
        await evictClient(input.cacheKey, connection);
      }
      throw retryError;
    }
  }
}

async function callTool(
  connection: HarnessMcpClient,
  input: {
    name: string;
    argumentsValue: Record<string, unknown>;
    principal: HarnessPrincipal;
    signal: AbortSignal;
  },
): Promise<unknown> {
  return connection.client.callTool(
    {
      name: input.name,
      arguments: identityBoundArguments(input.argumentsValue, input.principal),
    },
    undefined,
    { signal: input.signal },
  );
}

async function clientForCredential(input: {
  endpoint: string;
  credential: string;
  cacheKey: string;
  principal: HarnessPrincipal;
  signal: AbortSignal;
}): Promise<HarnessMcpClient> {
  await evictIdleClients();
  const cached = clientByCredential.get(input.cacheKey);
  if (cached) {
    cached.lastUsedAt = Date.now();
    return cached.pending;
  }

  const pending = createClient(input);
  const entry = { pending, lastUsedAt: Date.now() };
  clientByCredential.set(input.cacheKey, entry);
  void pending.catch(() => {
    if (clientByCredential.get(input.cacheKey) === entry) {
      clientByCredential.delete(input.cacheKey);
    }
  });
  await evictOverflowClients(input.cacheKey);
  return pending;
}

async function createClient(input: {
  endpoint: string;
  credential: string;
  principal: HarnessPrincipal;
  signal: AbortSignal;
}): Promise<HarnessMcpClient> {
  const transport = new StreamableHTTPClientTransport(new URL(input.endpoint), {
    requestInit: {
      cache: 'no-store',
      headers: {
        ...principalTenantHeaders(input.principal),
        ...(input.credential
          ? { Authorization: `Bearer ${input.credential}` }
          : {}),
      },
    },
  });
  const client = new Client(
    { name: 'commonplace-console', version: '1' },
    { capabilities: {} },
  );
  try {
    await client.connect(transport, { signal: input.signal });
    if (!transport.sessionId) throw new MissingMcpSessionError();
    return { client, transport };
  } catch (error) {
    await client.close().catch(() => undefined);
    throw error;
  }
}

async function evictClient(
  cacheKey: string,
  expected?: HarnessMcpClient,
  expectedEntry?: CachedHarnessMcpClient,
): Promise<void> {
  const entry = clientByCredential.get(cacheKey);
  if (!entry || (expectedEntry && entry !== expectedEntry)) return;
  const connection = await entry.pending.catch(() => null);
  if (expected && connection !== expected) return;
  if (clientByCredential.get(cacheKey) === entry) {
    clientByCredential.delete(cacheKey);
  }
  await connection?.transport.terminateSession().catch(() => undefined);
  await connection?.client.close().catch(() => undefined);
}

async function evictIdleClients(): Promise<void> {
  const staleBefore = Date.now() - MCP_CLIENT_IDLE_TTL_MS;
  const stale = [...clientByCredential.entries()].filter(
    ([, entry]) => entry.lastUsedAt <= staleBefore,
  );
  for (const [cacheKey, entry] of stale) {
    await evictClient(cacheKey, undefined, entry);
  }
}

async function evictOverflowClients(activeCacheKey: string): Promise<void> {
  if (clientByCredential.size <= MCP_CLIENT_CACHE_MAX_ENTRIES) return;
  const oldest = [...clientByCredential.entries()]
    .filter(([cacheKey]) => cacheKey !== activeCacheKey)
    .sort((left, right) => left[1].lastUsedAt - right[1].lastUsedAt);
  for (const [cacheKey, entry] of oldest) {
    if (clientByCredential.size <= MCP_CLIENT_CACHE_MAX_ENTRIES) break;
    await evictClient(cacheKey, undefined, entry);
  }
}

function credentialCacheKey(
  endpoint: string,
  credential: string,
  tenant: string,
  principalIdentity: string,
): string {
  return createHash('sha256')
    .update(endpoint)
    .update('\0')
    .update(credential)
    .update('\0')
    .update(tenant)
    .update('\0')
    .update(principalIdentity)
    .digest('hex');
}

function isSessionError(
  error: unknown,
  connection?: HarnessMcpClient,
): boolean {
  if (
    error instanceof StreamableHTTPError
    && error.code === 404
    && connection?.transport.sessionId
  ) {
    return true;
  }
  const message = error instanceof Error ? error.message : String(error);
  return /mcp_session_uninitialized|session(?: id)?(?: is)? (?:expired|invalid|missing|not found|uninitialized)/i
    .test(message);
}

function transportFailureResponse(
  error: unknown,
  didTimeout: boolean,
  connection?: HarnessMcpClient,
): Response {
  const upstreamStatus =
    error instanceof StreamableHTTPError
    && typeof error.code === 'number'
    && error.code >= 400
    && error.code <= 599
      ? error.code
      : null;
  const status = didTimeout ? 504 : upstreamStatus ?? 502;
  let code = 'harness_mcp_unreachable';
  if (didTimeout) {
    code = 'harness_mcp_timeout';
  } else if (isSessionError(error, connection)) {
    code = 'mcp_session_uninitialized';
  } else if (upstreamStatus === 401 || upstreamStatus === 403) {
    code = 'mcp_authentication_failed';
  } else if (upstreamStatus === 406) {
    code = 'mcp_not_acceptable';
  } else if (error instanceof MissingMcpSessionError) {
    code = 'harness_mcp_initialization_failed';
  } else if (error instanceof McpError) {
    code = 'harness_mcp_refused';
  }
  return Response.json(
    {
      error: code,
      ...(upstreamStatus ? { status: upstreamStatus } : {}),
    },
    { status },
  );
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
