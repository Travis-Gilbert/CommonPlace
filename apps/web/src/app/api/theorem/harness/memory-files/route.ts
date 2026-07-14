// SOURCING: none — Next.js route handler that calls the harness `memory_documents_dump`
// MCP tool and projects raw MemoryDocument rows into the lean file shape. Pure
// logic (transport reuse + data projection); no upstream component applies.
/**
 * GET /api/theorem/harness/memory-files
 *
 * Lists the RustyRed harness memory documents as OKF-style files for the Files
 * view. Uses `memory_documents_dump` (the harness's purpose-built listing
 * primitive: pages MemoryDocument nodes by updated_at) rather than the recall
 * path, so the result is an exhaustive listing, not a query-ranked subset.
 *
 * Same-origin proxy: the browser calls this route; the route calls the harness
 * MCP server-side with the server bearer, keeping credentials out of the client.
 * On an unavailable harness it returns source="unavailable" with an empty list,
 * so the Files view renders an honest empty section (no fixtures, no mock rows).
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

const DEFAULT_LIMIT = 500;
const MAX_LIMIT = 1000;

export async function GET(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const limit = clampLimit(url.searchParams.get('limit'));

  const result = await callHarnessMcpTool('memory_documents_dump', {
    limit,
    include_inactive: false,
  });

  if (!result.ok || !result.data) {
    return json({
      source: 'unavailable',
      files: [],
      count: 0,
      attempts: result.attempts.slice(0, 3),
    });
  }

  const files = asArray(result.data.docs).map(toMemoryFile).filter(nonNullable);
  return json({ source: 'live', files, count: files.length });
}

function toMemoryFile(value: unknown): HarnessMemoryFile | undefined {
  const doc = asRecord(value);
  if (!doc) return undefined;
  const docId = text(doc.doc_id) ?? text(doc.docId) ?? text(doc.id);
  if (!docId) return undefined;

  const metadata = asRecord(doc.metadata) ?? {};
  return {
    docId,
    kind: text(doc.kind) ?? 'memory',
    title: text(doc.title) ?? docId,
    summary: text(doc.summary) ?? '',
    gist: text(doc.gist) ?? '',
    content: text(doc.content) ?? text(doc.summary) ?? '',
    tags: asArray(doc.tags)
      .map((tag) => text(tag))
      .filter(nonNullable),
    status: text(doc.status) ?? null,
    originSurface: text(doc.origin_surface) ?? null,
    sourcePath: text(metadata.source_path) ?? text(metadata.okf_resource) ?? null,
    createdAtMs: parseMs(doc.created_at),
    updatedAtMs: parseMs(doc.updated_at),
  };
}

/** Memory timestamps arrive as "unix_ms:<n>"; also tolerate raw numbers and ISO. */
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
  const n = raw ? Number(raw) : DEFAULT_LIMIT;
  if (!Number.isFinite(n) || n <= 0) return DEFAULT_LIMIT;
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
