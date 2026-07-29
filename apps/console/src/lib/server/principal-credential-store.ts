// SOURCING: none. Server-only principal credential cache and issuance client.
// HANDOFF-PRINCIPAL-CREDENTIALS D4: mint, hold, and never re-render the secret.

import type { HarnessPrincipal } from '@/lib/harness-principal-core';

function issueUpstreamBase(): string {
  return (
    process.env.CONSOLE_DATA_API_URL ??
    process.env.THEOREM_OBJECTS_URL ??
    'http://localhost:50090'
  ).replace(/\/$/, '');
}

function serviceKeyForIssuance(): string {
  return process.env.CONSOLE_DATA_API_KEY ?? process.env.THEOREM_API_KEY ?? 'dev-key';
}

export type IssuedPrincipalCredential = {
  readonly token: string;
  readonly tenant: string;
  readonly principalId: string;
  readonly keyId: string;
  readonly expiresAtMs: number | null;
};

const cache = new Map<string, IssuedPrincipalCredential>();

function cacheKey(principal: HarnessPrincipal): string {
  return `${principal.tenant}::${principal.controlIdentity?.principal.id ?? principal.harnessIdentity}`;
}

export function rememberIssuedCredential(
  principal: HarnessPrincipal,
  credential: IssuedPrincipalCredential,
): void {
  cache.set(cacheKey(principal), credential);
}

export function forgetIssuedCredential(principal: HarnessPrincipal): void {
  cache.delete(cacheKey(principal));
}

export function cachedPrincipalCredential(
  principal: HarnessPrincipal,
  nowMs: number = Date.now(),
): IssuedPrincipalCredential | null {
  const hit = cache.get(cacheKey(principal));
  if (!hit) return null;
  if (hit.expiresAtMs !== null && nowMs >= hit.expiresAtMs) {
    cache.delete(cacheKey(principal));
    return null;
  }
  return hit;
}

/** Default TTL: thirty days in milliseconds (named constant, not invented in prose). */
export const PRINCIPAL_TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000;

export async function issuePrincipalCredential(
  principal: HarnessPrincipal,
): Promise<IssuedPrincipalCredential | null> {
  const principalId = principal.controlIdentity?.principal.id;
  if (!principalId) return null;
  let response: Response;
  try {
    response = await fetch(`${issueUpstreamBase()}/credentials/issue`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': serviceKeyForIssuance(),
      },
      body: JSON.stringify({
        principal_id: principalId,
        tenant: principal.tenant,
        ttl_ms: PRINCIPAL_TOKEN_TTL_MS,
      }),
      cache: 'no-store',
      signal: AbortSignal.timeout(8_000),
    });
  } catch {
    return null;
  }
  if (!response.ok) return null;
  let body: {
    token?: string;
    key_id?: string;
    expires_at_ms?: number | null;
    tenant?: string;
    principal_id?: string;
  };
  try {
    body = (await response.json()) as {
      token?: string;
      key_id?: string;
      expires_at_ms?: number | null;
      tenant?: string;
      principal_id?: string;
    };
  } catch {
    return null;
  }
  if (typeof body.token !== 'string' || typeof body.key_id !== 'string') return null;
  const issued: IssuedPrincipalCredential = {
    token: body.token,
    keyId: body.key_id,
    tenant: typeof body.tenant === 'string' ? body.tenant : principal.tenant,
    principalId:
      typeof body.principal_id === 'string' ? body.principal_id : principalId,
    expiresAtMs: typeof body.expires_at_ms === 'number' ? body.expires_at_ms : null,
  };
  rememberIssuedCredential(principal, issued);
  return issued;
}

export async function ensurePrincipalCredential(
  principal: HarnessPrincipal,
): Promise<IssuedPrincipalCredential | null> {
  return cachedPrincipalCredential(principal) ?? issuePrincipalCredential(principal);
}

export function listCachedCredentialMeta(principal: HarnessPrincipal): {
  readonly keyId: string;
  readonly tenant: string;
  readonly expiresAtMs: number | null;
} | null {
  const hit = cachedPrincipalCredential(principal);
  if (!hit) return null;
  return {
    keyId: hit.keyId,
    tenant: hit.tenant,
    expiresAtMs: hit.expiresAtMs,
  };
}
