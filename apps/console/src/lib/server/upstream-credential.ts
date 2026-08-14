// SOURCING: none. Pure credential resolution for the object seam.
// HANDOFF-PRINCIPAL-CREDENTIALS D1 + HANDOFF-SIGNED-PRINCIPAL-IDENTITY D3.

import type { HarnessPrincipal } from '@/lib/harness-principal-core';
import { configuredServiceTenantMatches } from '@/lib/harness-principal-core';
import { ensurePrincipalCredential } from '@/lib/server/principal-credential-store';
import {
  loadSigningCustodyForKeyId,
  resolveSigningCustodyForPrincipal,
} from '@/lib/server/signed-request-custody';
import { newRequestNonce, signRequest } from '@/lib/server/signed-request';

export type UpstreamCredential =
  | { readonly kind: 'service_key'; readonly key: string }
  | { readonly kind: 'principal_token'; readonly token: string; readonly tenant: string }
  | { readonly kind: 'signed_request'; readonly keyId: string };

export type CredentialRefusal = {
  readonly reason: 'principal_credential_unavailable';
  readonly message: string;
};

export type CredentialResolution =
  | { readonly ok: true; readonly credential: UpstreamCredential }
  | { readonly ok: false; readonly refusal: CredentialRefusal };

export type CredentialRequestContext = {
  readonly method: string;
  readonly path: string;
  readonly body: string | Uint8Array;
  readonly nowMs?: number;
  readonly nonce?: string;
};

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

export function credentialHeaders(
  credential: UpstreamCredential,
  context?: CredentialRequestContext,
): Record<string, string> {
  switch (credential.kind) {
    case 'service_key':
      return { 'x-api-key': credential.key };
    case 'principal_token':
      return {
        'x-api-key': credential.token,
        'x-theorem-credential-kind': 'principal_token',
      };
    case 'signed_request': {
      if (!context) {
        throw new Error('signed_request credentials require method, path, and body context');
      }
      const custody = loadSigningCustodyForKeyId(credential.keyId);
      if (!custody) {
        throw new Error('signed_request custody is unavailable for this key id');
      }
      const timestampMs = context.nowMs ?? Date.now();
      const nonce = context.nonce ?? newRequestNonce();
      const signature = signRequest({
        secretKeyHex: custody.secretKeyHex,
        method: context.method,
        path: context.path,
        body: context.body,
        keyId: credential.keyId,
        timestampMs,
        nonce,
      });
      return {
        'x-theorem-key-id': credential.keyId,
        'x-theorem-timestamp': String(timestampMs),
        'x-theorem-nonce': nonce,
        'x-theorem-signature': signature,
        'x-theorem-credential-kind': 'signed_request',
      };
    }
    default: {
      const _exhaustive: never = credential;
      return _exhaustive;
    }
  }
}

/** Bearer material for ACP / non-HTTP bridges that cannot carry signature headers. */
export function acpAuthTokenFromCredential(credential: UpstreamCredential): string | null {
  switch (credential.kind) {
    case 'service_key':
      return credential.key;
    case 'principal_token':
      return credential.token;
    case 'signed_request':
      return null;
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

  const custody = resolveSigningCustodyForPrincipal(principal);
  if (custody) {
    return {
      ok: true,
      credential: { kind: 'signed_request', keyId: custody.keyId },
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

  // Matching owner tenant: keep the deployment service key until the object
  // API exposes a working /credentials/issue route for principal tokens.
  if (configuredServiceTenantMatches(principal, process.env.CONSOLE_HARNESS_TENANT)) {
    return {
      ok: true,
      credential: { kind: 'service_key', key: serviceUpstreamKey() },
    };
  }

  return {
    ok: false,
    refusal: {
      reason: 'principal_credential_unavailable',
      message:
        'This principal has no object-seam credential yet. Map a seed in CONSOLE_SIGNED_REQUEST_SEEDS_JSON (or set CONSOLE_SIGNED_REQUEST_SECRET_KEY_HEX for the matching CONSOLE_HARNESS_TENANT owner), register the public key upstream, open Account to issue a token, or ensure the upstream service key may mint for this tenant.',
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

export function requestBodyBytes(body: BodyInit | null | undefined): string | Uint8Array {
  if (body == null) return '';
  if (typeof body === 'string') return body;
  if (body instanceof Uint8Array) return body;
  if (body instanceof ArrayBuffer) return new Uint8Array(body);
  if (typeof Buffer !== 'undefined' && Buffer.isBuffer(body)) return body;
  throw new Error('upstream body must be a string or byte buffer for signed_request');
}
