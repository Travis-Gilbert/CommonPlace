// SOURCING: none. Same-origin adapter for the identity-bound schema_declare tool.

import type { SchemaDeclareInput } from '@commonplace/data-model-contracts';
import { declareSchema } from '@/lib/server/observed-model-harness';

export async function POST(request: Request): Promise<Response> {
  const body = await request.json().catch(() => null) as {
    topicId?: unknown;
    input?: unknown;
  } | null;
  const topicId = typeof body?.topicId === 'string' ? body.topicId.trim() : '';
  if (!topicId || !body?.input || typeof body.input !== 'object' || Array.isArray(body.input)) {
    return Response.json({ error: 'topicId and schema input are required' }, { status: 400 });
  }
  const result = await declareSchema(topicId, body.input as SchemaDeclareInput);
  if (!result.ok) {
    return Response.json({ error: result.error }, { status: result.status });
  }
  return Response.json({
    receipt: result.receipt,
    declared: result.declared,
  });
}
