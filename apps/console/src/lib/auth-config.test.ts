import { describe, expect, it } from 'vitest';
import { githubAuthCredentials } from './auth-config';

describe('GitHub auth readiness', () => {
  it('enables GitHub only when both credentials are present', () => {
    expect(githubAuthCredentials({ AUTH_GITHUB_ID: 'client', AUTH_GITHUB_SECRET: 'secret' }))
      .toEqual({ clientId: 'client', clientSecret: 'secret' });
  });

  it('refuses a half-configured provider', () => {
    expect(githubAuthCredentials({ AUTH_GITHUB_ID: 'client' })).toBeNull();
    expect(githubAuthCredentials({ AUTH_GITHUB_SECRET: 'secret' })).toBeNull();
    expect(githubAuthCredentials({})).toBeNull();
  });
});
