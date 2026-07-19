// SOURCING: none. Same-origin, authenticated projection read. The browser
// receives a render-ready graph only, never a tenant string or harness secret.

import { readProactivityGraph } from '@/lib/server/proactivity-harness';

export const dynamic = 'force-dynamic';

export async function GET(): Promise<Response> {
  const result = await readProactivityGraph();
  if (!result.ok) return Response.json({ error: result.error }, { status: result.status });
  return Response.json({ graph: result.graph });
}
