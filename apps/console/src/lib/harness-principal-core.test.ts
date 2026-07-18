import { describe, expect, it } from 'vitest';
import type { Session } from 'next-auth';
import { legacyServicePrincipal, principalFromSession } from './harness-principal-core';

function session(githubLogin?: string, harnessIdentity?: string): Session {
  return {
    user: {
      githubLogin,
      harnessIdentity,
    },
    expires: '2099-01-01T00:00:00.000Z',
  };
}

describe('Harness principal resolution', () => {
  it('derives the tenant from verified GitHub session claims', () => {
    expect(principalFromSession(session('Travis-Gilbert', 'github:123'))).toEqual({
      tenant: 'Travis-Gilbert',
      githubLogin: 'Travis-Gilbert',
      harnessIdentity: 'github:123',
    });
  });

  it('refuses incomplete, anonymous, and reserved identities', () => {
    expect(principalFromSession(null)).toBeNull();
    expect(principalFromSession(session('Travis-Gilbert'))).toBeNull();
    expect(principalFromSession(session('default', 'github:123'))).toBeNull();
  });

  it('keeps the explicit legacy tenant only until GitHub auth is ready', () => {
    expect(legacyServicePrincipal('Travis-Gilbert', false)).toEqual({
      tenant: 'Travis-Gilbert',
      githubLogin: 'Travis-Gilbert',
      harnessIdentity: 'service:commonplace-console:Travis-Gilbert',
    });
    expect(legacyServicePrincipal('default', false)).toBeNull();
    expect(legacyServicePrincipal('Travis-Gilbert', true)).toBeNull();
  });
});
