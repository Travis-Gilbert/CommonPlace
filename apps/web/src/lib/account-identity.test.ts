import { describe, expect, it } from 'vitest';
import { githubHarnessIdentity, isOwnerGithubLogin } from './account-identity';

describe('CommonPlace account identity', () => {
  it('keeps owner authorization separate from ordinary sign-in', () => {
    expect(isOwnerGithubLogin('Travis-Gilbert')).toBe(true);
    expect(isOwnerGithubLogin('new-harness-user')).toBe(false);
  });

  it('builds a stable Harness identity from the provider account id', () => {
    expect(githubHarnessIdentity('123456')).toBe('github:123456');
    expect(githubHarnessIdentity('')).toBeUndefined();
  });
});
