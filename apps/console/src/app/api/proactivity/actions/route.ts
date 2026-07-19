// SOURCING: zod. Same-origin named mutation adapter. The parsed body contains
// only an action from the narrow vocabulary, never tenant identity or a raw
// arbitrary patch.

import { proactivityActionSchema } from '@/lib/proactivity/actions';
import { runProactivityAction } from '@/lib/server/proactivity-harness';

export const dynamic = 'force-dynamic';

export async function POST(request: Request): Promise<Response> {
  const parsed = proactivityActionSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: 'invalid_proactivity_action', issues: parsed.error.issues }, { status: 400 });
  }
  const result = await runProactivityAction(parsed.data);
  if (!result.ok) return Response.json({ error: result.error }, { status: result.status });
  return Response.json({ receipt: result.receipt, graph: result.graph });
}
