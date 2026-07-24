import { describe, expect, it } from 'vitest';
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
};

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
    const previous = process.env.CONSOLE_PRINCIPAL_TOKENS_JSON;
    delete process.env.CONSOLE_PRINCIPAL_TOKENS_JSON;
    try {
      const resolution = await resolveUpstreamCredential(sessionPrincipal);
      expect(resolution.ok).toBe(false);
      if (!resolution.ok) {
        expect(resolution.refusal.reason).toBe('principal_credential_unavailable');
      }
    } finally {
      if (previous === undefined) delete process.env.CONSOLE_PRINCIPAL_TOKENS_JSON;
      else process.env.CONSOLE_PRINCIPAL_TOKENS_JSON = previous;
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
