// SOURCING: none. Console server key custody for signed upstream requests.
// HANDOFF-SIGNED-PRINCIPAL-IDENTITY D3 named choice 5: the Next server holds
// the signing key; the browser never sees it. Private key material stays in
// this module and process env only.
//
// Binding (SI-R1): a seed is used only for the principal it is mapped to.
// A single global seed is allowed only for the matching CONSOLE_HARNESS_TENANT
// owner until D6 pairing replaces env seeds.

import 'server-only';

import type { HarnessPrincipal } from '@/lib/harness-principal-core';
import { configuredServiceTenantMatches } from '@/lib/harness-principal-core';
import {
  keyIdForPublicKeyHex,
  publicKeyHexFromSeed,
  seedFromHex,
} from '@/lib/server/signed-request';

export type ConsoleSigningCustody = {
  readonly secretKeyHex: string;
  readonly publicKeyHex: string;
  readonly keyId: string;
};

/**
 * Optional server-only seed (64 hex chars). When used alone, it applies only to
 * the matching CONSOLE_HARNESS_TENANT owner principal.
 */
export function consoleSignedRequestSecretHex(
  raw: string | undefined = process.env.CONSOLE_SIGNED_REQUEST_SECRET_KEY_HEX,
): string | null {
  if (!raw || raw.trim() === '') return null;
  try {
    seedFromHex(raw);
    return raw.trim().toLowerCase();
  } catch {
    return null;
  }
}

/**
 * Per-principal seeds until D6 pairing.
 * Shape: JSON object of harnessIdentity or tenant slug -> 64-char seed hex.
 */
export function signedRequestSeedMapFromEnv(
  raw: string | undefined = process.env.CONSOLE_SIGNED_REQUEST_SEEDS_JSON,
): Readonly<Record<string, string>> {
  if (!raw || raw.trim() === '') return {};
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    const out: Record<string, string> = {};
    for (const [key, value] of Object.entries(parsed as Record<string, unknown>)) {
      if (typeof value !== 'string' || key.trim() === '') continue;
      try {
        seedFromHex(value);
        out[key] = value.trim().toLowerCase();
      } catch {
        // Skip invalid seeds; fail closed per principal rather than crash resolve.
      }
    }
    return out;
  } catch {
    return {};
  }
}

export function lookupSignedRequestSeed(
  principal: HarnessPrincipal,
  map: Readonly<Record<string, string>> = signedRequestSeedMapFromEnv(),
): string | null {
  const byIdentity = map[principal.harnessIdentity];
  if (typeof byIdentity === 'string' && byIdentity !== '') return byIdentity;
  const byTenant = map[principal.tenant];
  if (typeof byTenant === 'string' && byTenant !== '') return byTenant;
  const matched = Object.entries(map).find(
    ([key]) => key.toLowerCase() === principal.tenant.toLowerCase(),
  );
  return matched?.[1] ?? null;
}

export function loadConsoleSigningCustody(
  secretHex: string | null = consoleSignedRequestSecretHex(),
): ConsoleSigningCustody | null {
  if (!secretHex) return null;
  const seed = seedFromHex(secretHex);
  const publicKeyHex = publicKeyHexFromSeed(seed);
  return {
    secretKeyHex: secretHex,
    publicKeyHex,
    keyId: keyIdForPublicKeyHex(publicKeyHex),
  };
}

/** Resolve signing custody for this principal only (never a shared default). */
export function resolveSigningCustodyForPrincipal(
  principal: HarnessPrincipal,
): ConsoleSigningCustody | null {
  const mapped = lookupSignedRequestSeed(principal);
  if (mapped) return loadConsoleSigningCustody(mapped);

  const globalSeed = consoleSignedRequestSecretHex();
  if (
    globalSeed
    && configuredServiceTenantMatches(principal, process.env.CONSOLE_HARNESS_TENANT)
  ) {
    return loadConsoleSigningCustody(globalSeed);
  }

  return null;
}

/** Find custody material for a key id among mapped seeds and the global seed. */
export function loadSigningCustodyForKeyId(keyId: string): ConsoleSigningCustody | null {
  const seeds = new Set<string>();
  for (const seed of Object.values(signedRequestSeedMapFromEnv())) {
    seeds.add(seed);
  }
  const globalSeed = consoleSignedRequestSecretHex();
  if (globalSeed) seeds.add(globalSeed);

  for (const seed of seeds) {
    const custody = loadConsoleSigningCustody(seed);
    if (custody && custody.keyId === keyId) return custody;
  }
  return null;
}
