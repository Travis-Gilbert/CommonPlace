import { afterEach, describe, expect, it, vi } from 'vitest';
import type { HarnessPrincipal } from '@/lib/harness-principal-core';
import {
  credentialHeaders,
  isServicePrincipal,
  lookupPrincipalToken,
  principalTokenMapFromEnv,
  resolveUpstreamCredential,
  serviceUpstreamKey,
} from './upstream-credential';

const servicePrincipal: HarnessPrincipal = {
  tenant: 'Travis-Gilbert',
  githubLogin: 'Travis-Gilbert',
  harnessIdentity: 'service:commonplace-console:Travis-Gilbert',
};

const sessionPrincipal: HarnessPrincipal = {
  tenant: 'Travis-Gilbert',
  githubLogin: 'Travis-Gilbert',
  harnessIdentity: 'github:123',
  controlIdentity: {
    principal: {
      id: '00000000-0000-0000-0000-000000000001',
      kind: 'human',
      display_name: 'Travis Gilbert',
    },
    kind: 'github',
    tenant: {
      id: '00000000-0000-0000-0000-000000000002',
      slug: 'Travis-Gilbert',
    },
    scopes: ['graph:read'],
  },
};

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
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

  it('does not borrow the deployment service key when durable issuance fails', async () => {
    const previousTokens = process.env.CONSOLE_PRINCIPAL_TOKENS_JSON;
    const previousTenant = process.env.CONSOLE_HARNESS_TENANT;
    const previousKey = process.env.CONSOLE_DATA_API_KEY;
    delete process.env.CONSOLE_PRINCIPAL_TOKENS_JSON;
    process.env.CONSOLE_HARNESS_TENANT = 'Travis-Gilbert';
    process.env.CONSOLE_DATA_API_KEY = 'owner-service-key';
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
