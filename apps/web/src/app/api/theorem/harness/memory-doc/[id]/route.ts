// SOURCING: none — Next.js dynamic route that hydrates one harness memory
// document for the reader (hydrate-on-select). Pure fetch delegation plus a
// projection to the reader's document shape; no upstream component applies.
/**
 * GET /api/theorem/harness/memory-doc/:id
 *
 * Returns one memory document with its full body, fetched on select so the
 * listing never carries bodies (SPEC-HARNESS-MEMORY-PROJECTION D4). There is no
 * budget ceiling on this path: a 200 KB document renders in full.
 *
 * `gist`, `confidence`, and `derivationRef` are null here because the deployed
 * memory_docs_list json! block does not emit them yet (a 3-field Rust addition);
 * the reader renders each only when present, never a fabricated empty value.
 */
import { fetchHarnessMemoryDoc } from '@/lib/theorem-harness-api';
import type { HarnessMemoryDoc, HarnessMemoryDocResponse } from '@/lib/harness-memory-files';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await params;
  const result = await fetchHarnessMemoryDoc(decodeURIComponent(id));

  if (!result.ok) {
    const source = result.reason;
    return json({ source, doc: null, error: result.error }, source === 'not-found' ? 404 : 200);
  }

  const doc: HarnessMemoryDoc = {
    docId: result.doc.docId,
    kind: result.doc.kind,
    title: result.doc.title,
    content: result.doc.content,
    summary: result.doc.summary || null,
    gist: null,
    tags: result.doc.tags,
    status: result.doc.status,
    confidence: null,
    derivationRef: null,
    bodyHash: result.doc.bodyHash,
    sourcePath: result.doc.sourcePath,
    createdAtMs: result.doc.createdAtMs,
    updatedAtMs: result.doc.updatedAtMs,
  };

  return json({ source: 'live', doc }, 200);
}

function json(body: HarnessMemoryDocResponse, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
