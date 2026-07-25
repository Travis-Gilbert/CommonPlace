// SOURCING: none. Same-origin mutation adapter for declared metadata removal.

import { unpinDeclared } from '@/lib/server/observed-model-harness';

export const dynamic = 'force-dynamic';

export async function POST(request: Request): Promise<Response> {
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  const topicId = typeof body?.topicId === 'string' ? body.topicId.trim() : '';
  const declaredId = typeof body?.declaredId === 'string' ? body.declaredId.trim() : '';
  if (!topicId || !declaredId) {
    return Response.json({ error: 'invalid_unpin_request' }, { status: 400 });
  }
  const result = await unpinDeclared(topicId, declaredId);
  if (!result.ok) return Response.json({ error: result.error }, { status: result.status });
  return Response.json({ receipt: result.receipt, declared: result.declared });
}
