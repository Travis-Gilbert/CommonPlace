import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import type { HarnessPrincipal } from '@/lib/harness-principal-core';
import {
  acpAuthTokenFromCredential,
  credentialHeaders,
  isServicePrincipal,
  lookupPrincipalToken,
  principalTokenMapFromEnv,
  resolveUpstreamCredential,
  serviceUpstreamKey,
} from './upstream-credential';
import {
  bodyContentHash,
  canonicalSigningString,
  keyIdForPublicKeyHex,
  loadCheckedInSignedRequestVectors,
  publicKeyHexFromSeed,
  seedFromHex,
  signRequest,
} from './signed-request';

const servicePrincipal: HarnessPrincipal = {
  tenant: 'Travis-Gilbert',
  githubLogin: 'Travis-Gilbert',
  harnessIdentity: 'service:commonplace-console:Travis-Gilbert',
};

const sessionPrincipal: HarnessPrincipal = {
  tenant: 'Travis-Gilbert',
  githubLogin: 'Travis-Gilbert',
  harnessIdentity: 'github:123',
};

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  delete process.env.CONSOLE_SIGNED_REQUEST_SECRET_KEY_HEX;
  delete process.env.CONSOLE_SIGNED_REQUEST_SEEDS_JSON;
  delete process.env.CONSOLE_HARNESS_TENANT;
});

describe('upstream credential resolution', () => {
  it('detects service principals by harness identity prefix', () => {
    expect(isServicePrincipal(servicePrincipal)).toBe(true);
    expect(isServicePrincipal(sessionPrincipal)).toBe(false);
  });

  it('resolves a service_key for service principals', async () => {
    const previous = process.env.CONSOLE_DATA_API_KEY;
    process.env.CONSOLE_DATA_API_KEY = 'service-test-key';
    try {
      const resolution = await resolveUpstreamCredential(servicePrincipal);
      expect(resolution).toEqual({
        ok: true,
        credential: { kind: 'service_key', key: 'service-test-key' },
      });
      if (resolution.ok) {
        expect(credentialHeaders(resolution.credential)).toEqual({
          'x-api-key': 'service-test-key',
        });
      }
    } finally {
      if (previous === undefined) delete process.env.CONSOLE_DATA_API_KEY;
      else process.env.CONSOLE_DATA_API_KEY = previous;
    }
  });

  it('returns a named refusal when a session principal has no token', async () => {
    const previousTokens = process.env.CONSOLE_PRINCIPAL_TOKENS_JSON;
    const previousTenant = process.env.CONSOLE_HARNESS_TENANT;
    delete process.env.CONSOLE_PRINCIPAL_TOKENS_JSON;
    delete process.env.CONSOLE_HARNESS_TENANT;
    delete process.env.CONSOLE_SIGNED_REQUEST_SECRET_KEY_HEX;
    const fetchMock = vi.fn(async () =>
      Response.json({ error: 'not_found' }, { status: 404 }),
    );
    vi.stubGlobal('fetch', fetchMock);
    try {
      const resolution = await resolveUpstreamCredential(sessionPrincipal);
      expect(resolution.ok).toBe(false);
      if (!resolution.ok) {
        expect(resolution.refusal.reason).toBe('principal_credential_unavailable');
      }
      expect(fetchMock).toHaveBeenCalled();
    } finally {
      if (previousTokens === undefined) delete process.env.CONSOLE_PRINCIPAL_TOKENS_JSON;
      else process.env.CONSOLE_PRINCIPAL_TOKENS_JSON = previousTokens;
      if (previousTenant === undefined) delete process.env.CONSOLE_HARNESS_TENANT;
      else process.env.CONSOLE_HARNESS_TENANT = previousTenant;
    }
  });

  it('falls back to the service key for the matching deployment tenant', async () => {
    const previousTokens = process.env.CONSOLE_PRINCIPAL_TOKENS_JSON;
    const previousTenant = process.env.CONSOLE_HARNESS_TENANT;
    const previousKey = process.env.CONSOLE_DATA_API_KEY;
    delete process.env.CONSOLE_PRINCIPAL_TOKENS_JSON;
    delete process.env.CONSOLE_SIGNED_REQUEST_SECRET_KEY_HEX;
    process.env.CONSOLE_HARNESS_TENANT = 'Travis-Gilbert';
    process.env.CONSOLE_DATA_API_KEY = 'owner-service-key';
    const fetchMock = vi.fn(async () =>
      Response.json({ error: 'not_found' }, { status: 404 }),
    );
    vi.stubGlobal('fetch', fetchMock);
    try {
      const resolution = await resolveUpstreamCredential(sessionPrincipal);
      expect(resolution).toEqual({
        ok: true,
        credential: { kind: 'service_key', key: 'owner-service-key' },
      });
    } finally {
      if (previousTokens === undefined) delete process.env.CONSOLE_PRINCIPAL_TOKENS_JSON;
      else process.env.CONSOLE_PRINCIPAL_TOKENS_JSON = previousTokens;
      if (previousTenant === undefined) delete process.env.CONSOLE_HARNESS_TENANT;
      else process.env.CONSOLE_HARNESS_TENANT = previousTenant;
      if (previousKey === undefined) delete process.env.CONSOLE_DATA_API_KEY;
      else process.env.CONSOLE_DATA_API_KEY = previousKey;
    }
  });

  it('resolves a principal_token from the env map', async () => {
    const previous = process.env.CONSOLE_PRINCIPAL_TOKENS_JSON;
    delete process.env.CONSOLE_SIGNED_REQUEST_SECRET_KEY_HEX;
    process.env.CONSOLE_PRINCIPAL_TOKENS_JSON = JSON.stringify({
      'Travis-Gilbert': 'tok_owner_1',
    });
    try {
      const resolution = await resolveUpstreamCredential(sessionPrincipal);
      expect(resolution).toEqual({
        ok: true,
        credential: {
          kind: 'principal_token',
          token: 'tok_owner_1',
          tenant: 'Travis-Gilbert',
        },
      });
      if (resolution.ok) {
        expect(credentialHeaders(resolution.credential)).toEqual({
          'x-api-key': 'tok_owner_1',
          'x-theorem-credential-kind': 'principal_token',
        });
      }
    } finally {
      if (previous === undefined) delete process.env.CONSOLE_PRINCIPAL_TOKENS_JSON;
      else process.env.CONSOLE_PRINCIPAL_TOKENS_JSON = previous;
    }
  });

  it('prefers signed_request when a per-principal seed is mapped', async () => {
    const vector = loadCheckedInSignedRequestVectors()[0];
    process.env.CONSOLE_SIGNED_REQUEST_SEEDS_JSON = JSON.stringify({
      [sessionPrincipal.harnessIdentity]: vector.secret_key_hex,
    });
    const resolution = await resolveUpstreamCredential(sessionPrincipal);
    expect(resolution).toEqual({
      ok: true,
      credential: { kind: 'signed_request', keyId: vector.key_id },
    });
    if (!resolution.ok) throw new Error('expected ok');
    expect(acpAuthTokenFromCredential(resolution.credential)).toBeNull();
    const body = Buffer.from(vector.body_hex, 'hex');
    const headers = credentialHeaders(resolution.credential, {
      method: vector.method,
      path: vector.path,
      body,
      nowMs: vector.timestamp_ms,
      nonce: vector.nonce,
    });
    expect(headers['x-theorem-key-id']).toBe(vector.key_id);
    expect(headers['x-theorem-timestamp']).toBe(String(vector.timestamp_ms));
    expect(headers['x-theorem-nonce']).toBe(vector.nonce);
    expect(headers['x-theorem-signature']).toBe(vector.signature_hex);
    expect(headers['x-theorem-credential-kind']).toBe('signed_request');
    expect(headers['x-api-key']).toBeUndefined();
  });

  it('uses the global seed only for the matching CONSOLE_HARNESS_TENANT owner', async () => {
    const vector = loadCheckedInSignedRequestVectors()[0];
    const previousTokens = process.env.CONSOLE_PRINCIPAL_TOKENS_JSON;
    process.env.CONSOLE_SIGNED_REQUEST_SECRET_KEY_HEX = vector.secret_key_hex;
    process.env.CONSOLE_HARNESS_TENANT = 'Travis-Gilbert';
    try {
      const owner = await resolveUpstreamCredential(sessionPrincipal);
      expect(owner).toEqual({
        ok: true,
        credential: { kind: 'signed_request', keyId: vector.key_id },
      });

      const other: HarnessPrincipal = {
        tenant: 'Other-Tenant',
        githubLogin: 'other',
        harnessIdentity: 'github:999',
      };
      process.env.CONSOLE_PRINCIPAL_TOKENS_JSON = JSON.stringify({
        'Other-Tenant': 'tok_other',
      });
      const resolution = await resolveUpstreamCredential(other);
      expect(resolution).toEqual({
        ok: true,
        credential: {
          kind: 'principal_token',
          token: 'tok_other',
          tenant: 'Other-Tenant',
        },
      });
    } finally {
      if (previousTokens === undefined) delete process.env.CONSOLE_PRINCIPAL_TOKENS_JSON;
      else process.env.CONSOLE_PRINCIPAL_TOKENS_JSON = previousTokens;
    }
  });

  it('parses the principal token map and looks up case-insensitively', () => {
    expect(principalTokenMapFromEnv('{"Travis-Gilbert":"tok"}')).toEqual({
      'Travis-Gilbert': 'tok',
    });
    expect(principalTokenMapFromEnv('not-json')).toEqual({});
    expect(
      lookupPrincipalToken(sessionPrincipal, { 'travis-gilbert': 'tok_lower' }),
    ).toBe('tok_lower');
  });

  it('keeps the default service key identical to the prior forward() helper', () => {
    const previousData = process.env.CONSOLE_DATA_API_KEY;
    const previousTheorem = process.env.THEOREM_API_KEY;
    delete process.env.CONSOLE_DATA_API_KEY;
    delete process.env.THEOREM_API_KEY;
    try {
      expect(serviceUpstreamKey()).toBe('dev-key');
    } finally {
      if (previousData === undefined) delete process.env.CONSOLE_DATA_API_KEY;
      else process.env.CONSOLE_DATA_API_KEY = previousData;
      if (previousTheorem === undefined) delete process.env.THEOREM_API_KEY;
      else process.env.THEOREM_API_KEY = previousTheorem;
    }
  });
});

describe('signed request vectors (SI D2/D3)', () => {
  it('matches the Rust checked-in vectors for canon, key id, and signature', () => {
    for (const vector of loadCheckedInSignedRequestVectors()) {
      const body = Buffer.from(vector.body_hex, 'hex');
      const seed = seedFromHex(vector.secret_key_hex);
      expect(publicKeyHexFromSeed(seed)).toBe(vector.public_key_hex);
      expect(keyIdForPublicKeyHex(vector.public_key_hex)).toBe(vector.key_id);
      expect(bodyContentHash(body)).toBe(
        vector.canonical_string.split('\n')[3],
      );
      const canonical = canonicalSigningString({
        method: vector.method,
        path: vector.path,
        body,
        keyId: vector.key_id,
        timestampMs: vector.timestamp_ms,
        nonce: vector.nonce,
      });
      expect(canonical).toBe(vector.canonical_string);
      expect(
        signRequest({
          secretKeyHex: vector.secret_key_hex,
          method: vector.method,
          path: vector.path,
          body,
          keyId: vector.key_id,
          timestampMs: vector.timestamp_ms,
          nonce: vector.nonce,
        }),
      ).toBe(vector.signature_hex);
    }
  });
});
