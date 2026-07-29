// SOURCING: none. Pure credential resolution for the object seam.
// HANDOFF-PRINCIPAL-CREDENTIALS D1: resolve a credential per principal.
// The signed_request kind is added by HANDOFF-SIGNED-PRINCIPAL-IDENTITY.

import type { HarnessPrincipal } from '@/lib/harness-principal-core';
import { ensurePrincipalCredential } from '@/lib/server/principal-credential-store';

export type UpstreamCredential =
  | { readonly kind: 'service_key'; readonly key: string }
  | { readonly kind: 'principal_token'; readonly token: string; readonly tenant: string };

export type CredentialRefusal = {
  readonly reason: 'principal_credential_unavailable';
  readonly message: string;
};

export type CredentialResolution =
  | { readonly ok: true; readonly credential: UpstreamCredential }
  | { readonly ok: false; readonly refusal: CredentialRefusal };

export function isServicePrincipal(principal: HarnessPrincipal): boolean {
  return principal.harnessIdentity.startsWith('service:');
}

export function serviceUpstreamKey(): string {
  return process.env.CONSOLE_DATA_API_KEY ?? process.env.THEOREM_API_KEY ?? 'dev-key';
}

/**
 * Interim principal-token map until D4 issuance owns the store.
 * Shape: JSON object of tenant slug -> opaque token string.
 * Private keys and signing material never belong here.
 */
export function principalTokenMapFromEnv(
  raw: string | undefined = process.env.CONSOLE_PRINCIPAL_TOKENS_JSON,
): Readonly<Record<string, string>> {
  if (!raw || raw.trim() === '') return {};
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    const out: Record<string, string> = {};
    for (const [tenant, token] of Object.entries(parsed as Record<string, unknown>)) {
      if (typeof token === 'string' && token.trim() !== '' && tenant.trim() !== '') {
        out[tenant] = token;
      }
    }
    return out;
  } catch {
    return {};
  }
}

export function lookupPrincipalToken(
  principal: HarnessPrincipal,
  map: Readonly<Record<string, string>> = principalTokenMapFromEnv(),
): string | null {
  const direct = map[principal.tenant];
  if (typeof direct === 'string' && direct.trim() !== '') return direct;
  const matched = Object.entries(map).find(
    ([tenant]) => tenant.toLowerCase() === principal.tenant.toLowerCase(),
  );
  return matched?.[1] ?? null;
}

export function credentialHeaders(credential: UpstreamCredential): Record<string, string> {
  switch (credential.kind) {
    case 'service_key':
      return { 'x-api-key': credential.key };
    case 'principal_token':
      return {
        'x-api-key': credential.token,
        'x-theorem-credential-kind': 'principal_token',
      };
    default: {
      const _exhaustive: never = credential;
      return _exhaustive;
    }
  }
}

export async function resolveUpstreamCredential(
  principal: HarnessPrincipal,
): Promise<CredentialResolution> {
  if (isServicePrincipal(principal)) {
    return {
      ok: true,
      credential: { kind: 'service_key', key: serviceUpstreamKey() },
    };
  }

  const fromEnv = lookupPrincipalToken(principal);
  if (fromEnv) {
    return {
      ok: true,
      credential: {
        kind: 'principal_token',
        token: fromEnv,
        tenant: principal.tenant,
      },
    };
  }

  const issued = await ensurePrincipalCredential(principal);
  if (issued) {
    return {
      ok: true,
      credential: {
        kind: 'principal_token',
        token: issued.token,
        tenant: issued.tenant,
      },
    };
  }

  return {
    ok: false,
    refusal: {
      reason: 'principal_credential_unavailable',
      message:
        'This principal has no object-seam credential yet. Open Account to issue one, or ensure the upstream service key may mint for this tenant.',
    },
  };
}

export function credentialRefusalResponse(refusal: CredentialRefusal): Response {
  return Response.json(
    {
      error: refusal.reason,
      message: refusal.message,
    },
    { status: 403 },
  );
}
