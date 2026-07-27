// SOURCING: none. Same-origin mutation adapter for schema proposal drafts.

import { proposeSchemaChange } from '@/lib/server/observed-model-harness';

export const dynamic = 'force-dynamic';

export async function POST(request: Request): Promise<Response> {
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  const topicId = typeof body?.topicId === 'string' ? body.topicId.trim() : '';
  const proposalRequest = typeof body?.request === 'string' ? body.request.trim() : '';
  if (!topicId || !proposalRequest) {
    return Response.json({ error: 'invalid_schema_proposal_request' }, { status: 400 });
  }
  const result = await proposeSchemaChange(topicId, proposalRequest);
  if (!result.ok) return Response.json({ error: result.error }, { status: result.status });
  return Response.json({ draft: result.draft });
}
