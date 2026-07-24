// SOURCING: none. Pure logic, no upstream component applies.
// The console's object-seam env contract (HANDOFF-CONSOLE-ROUND-2 R2.1): one
// server-side base plus key, mirroring the web proxy pattern but console
// owned so the two services stay independent. The key never reaches the
// browser; the browser talks only to these same-origin routes.
//
// HANDOFF-PRINCIPAL-CREDENTIALS: forward() resolves a credential per
// principal. Auto-issuance (D4) runs for signed-in principals. Gate 2 remains
// only as a named refusal when issuance cannot cover a non-matching tenant.

import {
  configuredServiceTenantMatches,
  principalTenantHeaders,
  resolveHarnessPrincipal,
} from '@/lib/server/harness-principal';
import {
  credentialHeaders,
  credentialRefusalResponse,
  isServicePrincipal,
  resolveUpstreamCredential,
  serviceUpstreamKey,
} from '@/lib/server/upstream-credential';

export function upstreamBase(): string {
  return (
    process.env.CONSOLE_DATA_API_URL ??
    process.env.THEOREM_OBJECTS_URL ??
    'http://localhost:50090'
  ).replace(/\/$/, '');
}

/** @deprecated Prefer resolveUpstreamCredential; kept for callers that only
 *  need the process-wide service key during the migration window. */
export function upstreamKey(): string {
  return serviceUpstreamKey();
}

/** Forward a JSON body to the upstream object seam, passing the status
 *  through verbatim so the client can distinguish identity refusal
 *  (401 unauthenticated or 403 unauthorized) from a down transport. */
export async function forward(path: string, init: RequestInit): Promise<Response> {
  const resolution = await resolveHarnessPrincipal();
  if (!resolution.ok) return resolution.response;

  const credential = await resolveUpstreamCredential(resolution.principal);
  if (!credential.ok) {
    if (
      !isServicePrincipal(resolution.principal) &&
      !configuredServiceTenantMatches(resolution.principal)
    ) {
      return Response.json(
        {
          error: 'tenant_object_credential_unavailable',
          message: 'This signed-in tenant does not yet have a matching object-seam credential.',
        },
        { status: 403 },
      );
    }
    return credentialRefusalResponse(credential.refusal);
  }

  let upstream: Response;
  try {
    upstream = await fetch(`${upstreamBase()}${path}`, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        ...credentialHeaders(credential.credential),
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
