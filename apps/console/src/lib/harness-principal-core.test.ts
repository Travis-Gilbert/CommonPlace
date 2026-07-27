import { describe, expect, it } from 'vitest';
import type { Session } from 'next-auth';
import {
  configuredServiceTenantMatches,
  filterRunsForTenant,
  legacyServicePrincipal,
  principalFromSession,
  principalScopeHeaders,
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

  it('keeps the explicit legacy tenant only until GitHub auth is ready', () => {
    expect(legacyServicePrincipal('Travis-Gilbert', false)).toEqual({
      tenant: 'Travis-Gilbert',
      githubLogin: 'Travis-Gilbert',
      harnessIdentity: 'service:commonplace-console:Travis-Gilbert',
    });
    expect(legacyServicePrincipal('default', false)).toBeNull();
    expect(legacyServicePrincipal('Travis-Gilbert', true)).toBeNull();
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

  it('adds workspace and ScopeRef headers only for an active membership', () => {
    expect(principalScopeHeaders({
      tenant: 'Travis-Gilbert',
      githubLogin: 'second-user',
      harnessIdentity: 'github:2',
      workspaceId: 'workspace-42',
      workspaceSlug: 'research',
      scopeRef: 'workspace:workspace-42',
    })).toEqual({
      'x-theorem-tenant': 'Travis-Gilbert',
      'x-tenant-id': 'Travis-Gilbert',
      'x-theorem-principal': 'github:2',
      'x-commonplace-workspace': 'workspace-42',
      'x-commonplace-scope-ref': 'workspace:workspace-42',
    });
    expect(principalScopeHeaders({
      tenant: 'Travis-Gilbert',
      githubLogin: 'Travis-Gilbert',
      harnessIdentity: 'github:1',
    })).not.toHaveProperty('x-commonplace-scope-ref');
  });
});
