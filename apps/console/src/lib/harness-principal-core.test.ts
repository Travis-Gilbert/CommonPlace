import { describe, expect, it } from 'vitest';
import type { Session } from 'next-auth';
import {
  configuredServiceTenantMatches,
  filterRunsForTenant,
  principalFromSession,
} from './harness-principal-core';

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

  it('admits only the configured service tenant to shared object credentials', () => {
    const owner = {
      tenant: 'Travis-Gilbert',
      githubLogin: 'Travis-Gilbert',
      harnessIdentity: 'github:1',
    };
    const other = {
      tenant: 'someone-else',
      githubLogin: 'someone-else',
      harnessIdentity: 'github:2',
    };
    expect(configuredServiceTenantMatches(owner, 'Travis-Gilbert')).toBe(true);
    expect(configuredServiceTenantMatches(other, 'Travis-Gilbert')).toBe(false);
    expect(configuredServiceTenantMatches(owner, undefined)).toBe(false);
  });

  it('preserves run ledger entries without nested scope', () => {
    const tenant = 'Travis-Gilbert';
    expect(filterRunsForTenant([
      { run_id: 'a', status: 'running' },
      { run_id: 'b', status: 'done', scope: { tenant } },
      { run_id: 'c', status: 'done', scope: { tenant: 'other' } },
      null,
    ], tenant)).toEqual([
      { run_id: 'a', status: 'running' },
      { run_id: 'b', status: 'done', scope: { tenant } },
    ]);
  });
});
