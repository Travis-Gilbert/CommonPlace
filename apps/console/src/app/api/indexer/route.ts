// SOURCING: none. Same-origin adapter for Indexer topic/capture objects.
// The browser never reaches Theorem GraphQL directly.

import { readIndexerObjects } from '@/lib/server/indexer-harness';

export const dynamic = 'force-dynamic';

export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const topicId = url.searchParams.get('topicId')?.trim() || undefined;
  const includeCapturesParam = url.searchParams.get('includeCaptures');
  const includeCaptures =
    includeCapturesParam === null
      ? undefined
      : includeCapturesParam === '1' || includeCapturesParam === 'true';
  const result = await readIndexerObjects({ topicId, includeCaptures });
  if (!result.ok) return Response.json({ error: result.error }, { status: result.status });
  return Response.json({
    tenant: result.tenant,
    objects: result.objects,
  });
}
