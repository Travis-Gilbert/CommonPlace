// SOURCING: none — Next.js route handler that lists harness memory documents via
// the graphql_query MCP tool (the `memory` field) and projects them into the lean
// file shape. Pure logic (transport reuse + data projection); no upstream component applies.
/**
 * GET /api/theorem/harness/memory-files
 *
 * Lists RustyRed harness memory documents as OKF-style files for the Files view.
 *
 * Uses graphql_query { memory(...) } (the same path the harness summary route
 * uses) rather than memory_documents_dump: the dump carries the full per-doc nlp
 * payload, so a single doc already exceeds the harness MCP boundary budget
 * (~16 KB). Even the `memory` field must keep the WHOLE response under that
 * budget or the harness truncates it and the client sees zero rows, so the field
 * set is deliberately minimal (no variable-length `gist`/`summary`) and the limit
 * is capped low. This yields a title-level listing (kind, title, status, date);
 * a per-file content preview and an exhaustive listing beyond the budget cap are
 * follow-ups (they need budget-envelope paging or a lighter server-side dump).
 *
 * Same-origin proxy: the browser calls this route; the route calls the harness
 * MCP server-side. On an unavailable harness it returns source="unavailable"
 * with an empty list, so the Files view renders an honest empty section.
 */
import {
  asArray,
  asRecord,
  callHarnessMcpTool,
  text,
} from '@/lib/theorem-harness-mcp';
import type {
  HarnessMemoryFile,
  HarnessMemoryFilesResponse,
} from '@/lib/harness-memory-files';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Kept low on purpose: the whole response must fit the ~16 KB harness MCP budget.
// With the minimal field set below, ~50 rows land near 7 KB. Adding a
// variable-length field (gist/summary) or raising the limit risks truncation.
const MEMORY_LIMIT = 50;
const MAX_LIMIT = 60;

// The `memory` field is ranked recall, so a neutral multi-kind query plus
// includeLowFitness surfaces a representative spread of the tenant's documents.
const LISTING_QUERY = 'memory note decision plan reference spec solution handoff';

const MEMORY_GQL = `
  query MemoryFiles($q: String!, $n: Int!) {
    memory(query: $q, limit: $n, includeLowFitness: true, contentPreviewChars: 0) {
      id
      kind
      title
      status
      updatedAt
    }
  }
`;

export async function GET(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const limit = clampLimit(url.searchParams.get('limit'));

  const res = await callHarnessMcpTool('graphql_query', {
    query: MEMORY_GQL,
    variables: { q: LISTING_QUERY, n: limit },
  });

  if (!res.ok || !res.data) {
    return json({
      source: 'unavailable',
      files: [],
      count: 0,
      attempts: res.attempts.slice(0, 3),
    });
  }

  // graphql_query returns the GraphQL envelope `{ data: { memory: [...] } }`.
  // Tolerate the memory field also arriving at the top level.
  const gqlData = asRecord(res.data.data) ?? res.data;
  const files = asArray(gqlData.memory).map(toMemoryFile).filter(nonNullable);
  return json({ source: 'live', files, count: files.length });
}

function toMemoryFile(value: unknown): HarnessMemoryFile | undefined {
  const doc = asRecord(value);
  if (!doc) return undefined;
  const rawId = text(doc.id) ?? text(doc.doc_id);
  if (!rawId) return undefined;

  // Normalize "mem:doc:<tenant>:doc-<hash>" (and "mem:<id>") down to the doc id.
  const docId = rawId.replace(/^mem:doc:[^:]+:/, '').replace(/^mem:/, '') || rawId;
  const updatedAtMs = parseMs(doc.updatedAt);
  return {
    docId,
    kind: text(doc.kind) ?? 'memory',
    title: text(doc.title) ?? docId,
    summary: '',
    gist: '',
    content: '',
    tags: [],
    status: text(doc.status) ?? null,
    originSurface: null,
    sourcePath: null,
    createdAtMs: updatedAtMs,
    updatedAtMs,
  };
}

/** Memory timestamps arrive as ISO or "unix_ms:<n>"; also tolerate raw numbers. */
function parseMs(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  const raw = text(value);
  if (!raw) return 0;
  const unix = raw.match(/^unix_ms:(\d+)$/);
  if (unix) return Number(unix[1]);
  if (/^\d+$/.test(raw)) return Number(raw);
  const parsed = Date.parse(raw);
  return Number.isNaN(parsed) ? 0 : parsed;
}

function clampLimit(raw: string | null): number {
  const n = raw ? Number(raw) : MEMORY_LIMIT;
  if (!Number.isFinite(n) || n <= 0) return MEMORY_LIMIT;
  return Math.min(Math.trunc(n), MAX_LIMIT);
}

function json(body: HarnessMemoryFilesResponse): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

function nonNullable<T>(value: T | null | undefined): value is T {
  return value !== null && value !== undefined;
}
