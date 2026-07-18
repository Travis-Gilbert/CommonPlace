import { describe, expect, it } from 'vitest';
import {
  githubHarnessIdentity,
  githubTenantSlug,
  isOwnerGithubLogin,
} from './account-identity';

describe('CommonPlace Console account identity', () => {
  it('keeps owner authorization separate from ordinary sign-in', () => {
    expect(isOwnerGithubLogin('Travis-Gilbert')).toBe(true);
    expect(isOwnerGithubLogin('new-harness-user')).toBe(false);
  });

  it('builds a stable Harness identity from the provider account id', () => {
    expect(githubHarnessIdentity('123456')).toBe('github:123456');
    expect(githubHarnessIdentity('')).toBeUndefined();
  });

  it('uses the verified GitHub login as the case-preserving tenant', () => {
    expect(githubTenantSlug('Travis-Gilbert')).toBe('Travis-Gilbert');
    expect(githubTenantSlug(' Ada Lovelace ')).toBe('Ada-Lovelace');
  });

  it('never resolves a missing or default identity to a tenant', () => {
    expect(githubTenantSlug('')).toBeUndefined();
    expect(githubTenantSlug(' DEFAULT ')).toBeUndefined();
  });
});
