/**
 * Same-origin proxy to the Theorem `evidence_bundle` MCP tool (HANDOFF-CARRY
 * C1.2). The browser posts a session's cited records here; this handler forwards
 * an MCP `tools/call` to the harness so the bundle's wire shape is the existing
 * cited packet (records + trace + degraded). Anchors and connection explanations
 * ride in each record's metadata, which evidence_bundle passes through.
 *
 * When the harness is unreachable, the route returns the packet assembled from
 * the posted records marked `degraded: true`. This is not a mock: the records
 * are the caller's real bundle, and evidence_bundle itself only echoes records +
 * trace, so the degraded shape is the same shape, honestly flagged.
 */

import { THEOREM_HARNESS_MCP_URL } from '@/lib/theorem-hosted';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const LOCAL_MCP_URL = 'http://127.0.0.1:17888/mcp';
const REQUEST_TIMEOUT_MS = 12_000;

interface CitedRecordInput {
  id: string;
  kind: string;
  content: string;
  metadata?: Record<string, unknown>;
}

interface CitedPacket {
  records: CitedRecordInput[];
  trace: unknown[];
  degraded: boolean;
  sessionId?: string;
  note?: string;
}

export async function POST(req: Request) {
  let body: { sessionId?: string; records?: CitedRecordInput[] };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return json({ error: 'invalid JSON body' }, 400);
  }
  const records = Array.isArray(body.records) ? body.records : [];
  const sessionId = typeof body.sessionId === 'string' ? body.sessionId : undefined;

  for (const endpoint of mcpCandidates()) {
    try {
      const payload = await callEvidenceBundle(endpoint, records, sessionId);
      return json(normalizePacket(payload, records, sessionId, false), 200);
    } catch {
      // Try the next candidate; fall through to the honest degraded packet.
    }
  }

  // Harness unreachable: echo the real posted records as a degraded packet.
  return json(
    {
      records,
      trace: [],
      degraded: true,
      sessionId,
      note: 'evidence_bundle harness unreachable; bundle assembled locally from posted records',
    } satisfies CitedPacket,
    200,
  );
}

function mcpCandidates(): string[] {
  const configured = process.env.THEOREM_HARNESS_MCP_URL?.trim();
  const seen = new Set<string>();
  const out: string[] = [];
  for (const url of [configured, LOCAL_MCP_URL, THEOREM_HARNESS_MCP_URL]) {
    const value = url?.trim();
    if (value && !seen.has(value)) {
      seen.add(value);
      out.push(value);
    }
  }
  return out;
}

function mcpHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'application/json, text/event-stream',
  };
  const bearer =
    process.env.THEOREM_HARNESS_BEARER?.trim() || process.env.THEOREM_HARNESS_API_TOKEN?.trim();
  if (bearer) headers.Authorization = `Bearer ${bearer}`;
  const tenant = process.env.THEOREM_HARNESS_TENANT?.trim();
  if (tenant) headers['x-theorem-tenant'] = tenant;
  return headers;
}

async function callEvidenceBundle(
  endpoint: string,
  records: CitedRecordInput[],
  sessionId: string | undefined,
): Promise<Record<string, unknown>> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: mcpHeaders(),
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: `evidence_bundle-${Date.now()}`,
        method: 'tools/call',
        params: {
          name: 'evidence_bundle',
          arguments: { records, session_id: sessionId },
        },
      }),
      cache: 'no-store',
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`MCP returned ${response.status}`);
    const rpc = asRecord(await response.json());
    if (asRecord(rpc?.error)) throw new Error('MCP tool error');
    return normalizeMcpResult(rpc?.result);
  } finally {
    clearTimeout(timer);
  }
}

function normalizeMcpResult(result: unknown): Record<string, unknown> {
  const record = asRecord(result);
  if (!record) throw new Error('invalid MCP result');
  if (record.isError === true) throw new Error('MCP tool returned an error');
  const structured = asRecord(record.structuredContent);
  if (structured && Object.keys(structured).length > 0) return structured;
  for (const item of asArray(record.content)) {
    const value = asRecord(item)?.text;
    if (typeof value === 'string') {
      const parsed = asRecord(JSON.parse(value));
      if (parsed) return parsed;
    }
  }
  throw new Error('MCP result had no structured payload');
}

/** Merge the tool payload with the posted records: the tool's records win when
 *  present, else we keep the caller's records so metadata is never lost. */
function normalizePacket(
  payload: Record<string, unknown>,
  records: CitedRecordInput[],
  sessionId: string | undefined,
  degraded: boolean,
): CitedPacket {
  const toolRecords = asArray(payload.records);
  return {
    records: toolRecords.length > 0 ? (toolRecords as unknown as CitedRecordInput[]) : records,
    trace: asArray(payload.trace),
    degraded: payload.degraded === true || degraded,
    sessionId,
  };
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function json(payload: unknown, status: number): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
