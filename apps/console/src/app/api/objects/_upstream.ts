// SOURCING: none. Pure logic, no upstream component applies.
// The console's object-seam env contract (HANDOFF-CONSOLE-ROUND-2 R2.1): one
// server-side base plus key, mirroring the web proxy pattern but console
// owned so the two services stay independent. The key never reaches the
// browser; the browser talks only to these same-origin routes.

import {
  configuredServiceTenantMatches,
  principalTenantHeaders,
  resolveHarnessPrincipal,
} from '@/lib/server/harness-principal';

export function upstreamBase(): string {
  return (
    process.env.CONSOLE_DATA_API_URL ??
    process.env.THEOREM_OBJECTS_URL ??
    'http://localhost:50090'
  ).replace(/\/$/, '');
}

export function upstreamKey(): string {
  return process.env.CONSOLE_DATA_API_KEY ?? process.env.THEOREM_API_KEY ?? 'dev-key';
}

/** Forward a JSON body to the upstream object seam, passing the status
 *  through verbatim so the client can distinguish identity refusal
 *  (401 unauthenticated or 403 unauthorized) from a down transport. */
export async function forward(path: string, init: RequestInit): Promise<Response> {
  const resolution = await resolveHarnessPrincipal();
  if (!resolution.ok) return resolution.response;
  // The object API authorizes only by shared API key and does not scope by
  // tenant headers yet. Refuse any signed-in principal that does not match
  // the configured service tenant until tenant-scoped object credentials exist.
  if (!configuredServiceTenantMatches(resolution.principal)) {
    return Response.json(
      {
        error: 'tenant_object_credential_unavailable',
        message: 'This signed-in tenant does not yet have a matching object-seam credential.',
      },
      { status: 403 },
    );
  }
  let upstream: Response;
  try {
    upstream = await fetch(`${upstreamBase()}${path}`, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': upstreamKey(),
        ...principalTenantHeaders(resolution.principal),
      },
      cache: 'no-store',
    });
  } catch {
    return Response.json(
      { error: 'console_data_api_unreachable', upstream: upstreamBase() },
      { status: 502 },
    );
  }
  const body = await upstream.text();
  return new Response(body, {
    status: upstream.status,
    headers: { 'Content-Type': upstream.headers.get('Content-Type') ?? 'application/json' },
  });
}
