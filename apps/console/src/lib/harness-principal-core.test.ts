import { describe, expect, it } from 'vitest';
import type { Session } from 'next-auth';
import {
  filterRunsForTenant,
  legacyServicePrincipal,
  principalFromSession,
  principalRequiresScopedObjectConsumer,
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

const controlIdentity = {
  principal: {
    id: '00000000-0000-0000-0000-000000000001',
    kind: 'human' as const,
    display_name: 'Travis Gilbert',
  },
  kind: 'github' as const,
  tenant: {
    id: '00000000-0000-0000-0000-000000000002',
    slug: 'Travis-Gilbert',
  },
  scopes: ['graph:read'],
};

describe('Harness principal resolution', () => {
  it('uses the canonical control identity instead of reconstructing the tenant', () => {
    expect(
      principalFromSession(
        session('renamed-login', 'github:123'),
        controlIdentity,
      ),
    ).toEqual({
      tenant: 'Travis-Gilbert',
      githubLogin: 'renamed-login',
      harnessIdentity: 'github:123',
      controlIdentity,
    });
  });

  it('refuses incomplete, anonymous, and non-GitHub control identities', () => {
    expect(principalFromSession(null)).toBeNull();
    expect(principalFromSession(session('Travis-Gilbert'))).toBeNull();
    expect(
      principalFromSession(session('Travis-Gilbert', 'github:123')),
    ).toBeNull();
    expect(
      principalFromSession(
        session('Travis-Gilbert', 'github:123'),
        { ...controlIdentity, kind: 'session' },
      ),
    ).toBeNull();
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

  it('requires an enforcing consumer for every workspace-bearing principal', () => {
    expect(principalRequiresScopedObjectConsumer({
      tenant: 'Travis-Gilbert',
      githubLogin: 'second-user',
      harnessIdentity: 'github:2',
      workspaceId: 'workspace-42',
      scopeRef: 'workspace:workspace-42',
    })).toBe(true);
    expect(principalRequiresScopedObjectConsumer({
      tenant: 'Travis-Gilbert',
      githubLogin: 'Travis-Gilbert',
      harnessIdentity: 'service:commonplace-console:Travis-Gilbert',
    })).toBe(false);
  });
});
