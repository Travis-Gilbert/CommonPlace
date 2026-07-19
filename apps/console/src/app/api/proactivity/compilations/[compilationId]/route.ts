// SOURCING: zod. A browser can act only on the opaque pending compilation ID
// it was shown. Tenant and candidate payloads remain server-side throughout.

import { z } from 'zod';
import {
  commitProactivityCompilation,
  discardProactivityCompilation,
} from '@/lib/server/proactivity-harness';

export const dynamic = 'force-dynamic';

const bodySchema = z.object({ action: z.enum(['commit', 'discard']) }).strict();
const paramsSchema = z.object({ compilationId: z.string().trim().min(1).max(128) }).strict();

export async function POST(
  request: Request,
  context: { params: Promise<{ compilationId: string }> },
): Promise<Response> {
  const [body, params] = await Promise.all([
    request.json().catch(() => null),
    context.params,
  ]);
  const parsedBody = bodySchema.safeParse(body);
  const parsedParams = paramsSchema.safeParse(params);
  if (!parsedBody.success || !parsedParams.success) {
    return Response.json({ error: 'invalid_proactivity_compilation_action' }, { status: 400 });
  }
  if (parsedBody.data.action === 'discard') {
    const discarded = await discardProactivityCompilation(parsedParams.data.compilationId);
    if (!discarded.ok) return Response.json({ error: discarded.error }, { status: discarded.status });
    return Response.json({ discarded: true });
  }
  const committed = await commitProactivityCompilation(parsedParams.data.compilationId);
  if (!committed.ok) return Response.json({ error: committed.error }, { status: committed.status });
  return Response.json({ receipt: committed.receipt, graph: committed.graph });
}
