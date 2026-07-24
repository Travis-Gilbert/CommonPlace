// SOURCING: none. Same-origin read adapter for observed and declared metadata.

import { emptyObservedModel } from '@commonplace/data-model-contracts';
import { readObservedModels } from '@/lib/server/observed-model-harness';

export const dynamic = 'force-dynamic';

export async function GET(request: Request): Promise<Response> {
  const topicId = new URL(request.url).searchParams.get('topicId')?.trim() ?? '';
  if (!topicId) {
    return Response.json(
      {
        error: 'topic_id_required',
        observed: emptyObservedModel({ kind: 'topic', topicId: '' }),
        declared: {
          scope: { kind: 'topic', topicId: '' },
          objectTypes: [],
          fields: [],
          relations: [],
          views: [],
          versions: [],
        },
      },
      { status: 400 },
    );
  }
  const result = await readObservedModels(topicId);
  if (!result.ok) {
    return Response.json(
      { error: result.error, observed: result.observed, declared: result.declared },
      { status: result.status },
    );
  }
  return Response.json({ observed: result.observed, declared: result.declared });
}
