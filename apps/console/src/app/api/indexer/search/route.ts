// SOURCING: none. Same-origin adapter for Indexer live RustyWeb search.
// The browser never reaches RustyRed directly.

import { resolveHarnessPrincipal } from '@/lib/server/harness-principal';
import { searchIndexerLive } from '@/lib/server/indexer-search';

export const dynamic = 'force-dynamic';

export async function POST(request: Request): Promise<Response> {
  const resolution = await resolveHarnessPrincipal();
  if (!resolution.ok) return resolution.response;

  const body = await request.json().catch(() => null) as {
    query?: unknown;
    topicId?: unknown;
  } | null;
  const query = typeof body?.query === 'string' ? body.query : '';
  const topicId = typeof body?.topicId === 'string' ? body.topicId : '';

  const result = await searchIndexerLive(query, topicId, resolution.principal, request);
  if (!result.ok) {
    return Response.json(
      { error: result.error, message: result.message },
      { status: result.status },
    );
  }
  return Response.json({
    query: result.query,
    tenant: resolution.principal.tenant,
    captures: result.captures,
  });
}
