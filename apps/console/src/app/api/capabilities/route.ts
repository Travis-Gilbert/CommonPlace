// SOURCING: commonplace-api /capabilities through the Console's authenticated
// server-side proxy. This gives browser UI only the safe boolean it needs.

import { loadInstanceCapabilities } from '@/lib/server/instance-capabilities';
import { resolveHarnessPrincipal } from '@/lib/server/harness-principal';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(): Promise<Response> {
  const resolution = await resolveHarnessPrincipal();
  if (!resolution.ok) return resolution.response;
  const result = await loadInstanceCapabilities(resolution.principal);
  if (!result.ok) return result.response;
  return Response.json(
    { web_search: result.capabilities.webSearch },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
