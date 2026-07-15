// SOURCING: none — Next.js route handler that lists harness memory documents from
// the harness REST API (lib/theorem-harness-api) and shapes them into the lean
// OKF file listing the Files surfaces render. Pure logic (fetch delegation plus
// projection); no upstream component applies.
/**
 * GET /api/theorem/harness/memory-files
 *
 * Lists the tenant's harness memory documents as OKF-style FILES: title-level
 * metadata, a pinned projection path (keyed on doc_id), the server's content
 * hash, and timestamps. NO body: the reader hydrates each document on select
 * through /api/theorem/harness/memory-doc/[id]. Stripping the body here is what
 * keeps a tree render off the whole corpus (SPEC-HARNESS-MEMORY-PROJECTION D2 +
 * the browser half of D3).
 *
 * Reads the harness REST API directly (/v1/tenants/{tenant}/memory/docs), which
 * enumerates by updated_at (not recall), so the listing is exhaustive and
 * unranked. Three honest sources: `tenant-unset` (env unset, no request issued),
 * `unavailable` (harness error), `live`.
 */
import { fetchHarnessMemoryDocs } from '@/lib/theorem-harness-api';
import {
  mintProjectionPath,
  type HarnessMemoryFile,
  type HarnessMemoryFilesResponse,
} from '@/lib/harness-memory-files';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(): Promise<Response> {
  const result = await fetchHarnessMemoryDocs();

  if (!result.ok) {
    return json({
      source: result.reason === 'tenant-unset' ? 'tenant-unset' : 'unavailable',
      files: [],
      count: 0,
      graphVersion: null,
    });
  }

  const files: HarnessMemoryFile[] = result.docs.map((doc) => ({
    docId: doc.docId,
    kind: doc.kind,
    title: doc.title,
    projectionPath: mintProjectionPath(doc.kind, doc.docId),
    bodyHash: doc.bodyHash,
    status: doc.status,
    createdAtMs: doc.createdAtMs,
    updatedAtMs: doc.updatedAtMs,
  }));

  return json({ source: 'live', files, count: files.length, graphVersion: result.maxUpdatedAt });
}

function json(body: HarnessMemoryFilesResponse): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}
