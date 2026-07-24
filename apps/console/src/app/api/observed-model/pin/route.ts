// SOURCING: none. Same-origin mutation adapter for observed metadata promotion.

import type { PinKind, PinRequest } from '@commonplace/data-model-contracts';
import { pinObserved } from '@/lib/server/observed-model-harness';

export const dynamic = 'force-dynamic';

function isPinKind(value: unknown): value is PinKind {
  return value === 'type' || value === 'field' || value === 'edge';
}

export async function POST(request: Request): Promise<Response> {
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  const scope = body?.scope as Record<string, unknown> | undefined;
  const topicId = scope?.kind === 'topic' && typeof scope.topicId === 'string'
    ? scope.topicId.trim()
    : '';
  const observedKey = typeof body?.observedKey === 'string' ? body.observedKey.trim() : '';
  if (!topicId || !observedKey || !isPinKind(body?.kind)) {
    return Response.json({ error: 'invalid_pin_request' }, { status: 400 });
  }
  const pinRequest: PinRequest = {
    scope: { kind: 'topic', topicId },
    observedKey,
    kind: body.kind,
    ...(typeof body.parentObservedKey === 'string' && body.parentObservedKey.trim()
      ? { parentObservedKey: body.parentObservedKey.trim() }
      : {}),
  };
  const result = await pinObserved(pinRequest);
  if (!result.ok) return Response.json({ error: result.error }, { status: result.status });
  return Response.json({ receipt: result.receipt, declared: result.declared });
}
