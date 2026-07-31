// SOURCING: none. Same-origin adapter for the identity-bound registry restore.

import { restoreDeclaredModel } from '@/lib/server/observed-model-harness';

export async function POST(request: Request): Promise<Response> {
  const body = await request.json().catch(() => null) as {
    topicId?: unknown;
    versionId?: unknown;
  } | null;
  const topicId = typeof body?.topicId === 'string' ? body.topicId.trim() : '';
  const versionId = typeof body?.versionId === 'string' ? body.versionId.trim() : '';
  if (!topicId || !versionId) {
    return Response.json({ error: 'topicId and versionId are required' }, { status: 400 });
  }
  const result = await restoreDeclaredModel(topicId, versionId);
  if (!result.ok) {
    return Response.json({ error: result.error }, { status: result.status });
  }
  return Response.json({
    receipt: result.receipt,
    declared: result.declared,
  });
}
