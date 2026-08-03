import { createHmac } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import {
  ACTIVE_WORKSPACE_TTL_SECONDS,
  decodeActiveWorkspaceClaims,
  encodeActiveWorkspaceClaims,
  resolveActiveWorkspaceSecret,
  workspaceSessionScope,
} from './active-workspace';

const SECRET = 'active-workspace-test-secret-longer-than-thirty-two-characters';
const NOW = Date.parse('2026-07-27T12:00:00.000Z');
const claims = {
  subject: 'github:42',
  workspaceId: 'workspace-42',
  workspaceSlug: 'research',
  tenant: 'Travis-Gilbert',
  scopeRef: 'workspace:workspace-42',
  scope: 'collaborator',
} as const;

describe('active workspace claims', () => {
  it('round-trips exact tenant casing and graph scope', () => {
    const encoded = encodeActiveWorkspaceClaims(claims, SECRET, NOW);
    expect(decodeActiveWorkspaceClaims(encoded, SECRET, NOW)).toEqual({
      version: 1,
      ...claims,
      expiresAt: Math.floor(NOW / 1000) + ACTIVE_WORKSPACE_TTL_SECONDS,
    });
  });

  it('refuses tampering, another secret, and expiry', () => {
    const encoded = encodeActiveWorkspaceClaims(claims, SECRET, NOW);
    expect(
      decodeActiveWorkspaceClaims(
        `${encoded.slice(0, -1)}${encoded.endsWith('a') ? 'b' : 'a'}`,
        SECRET,
        NOW,
      ),
    ).toBeNull();
    expect(
      decodeActiveWorkspaceClaims(
        encoded,
        'different-active-workspace-secret-longer-than-thirty-two',
        NOW,
      ),
    ).toBeNull();
    expect(
      decodeActiveWorkspaceClaims(
        encoded,
        SECRET,
        NOW + ACTIVE_WORKSPACE_TTL_SECONDS * 1000,
      ),
    ).toBeNull();
  });

  it('reads a cookie signed before scopes existed as a collaborator', () => {
    // The migration case. An old cookie carries no scope, and the daemon
    // granted every console session collaborator before the field existed, so
    // that is what it must keep meaning. Reading it as owner would hand every
    // in-flight cookie the token-minting and workspace-deletion routes.
    const { scope: _omitted, ...withoutScope } = claims;
    const payload = Buffer.from(JSON.stringify({
      version: 1,
      ...withoutScope,
      expiresAt: Math.floor(NOW / 1000) + ACTIVE_WORKSPACE_TTL_SECONDS,
    })).toString('base64url');
    const signature = createHmac('sha256', SECRET)
      .update('commonplace-active-workspace-v1\0')
      .update(payload)
      .digest('base64url');

    expect(decodeActiveWorkspaceClaims(`${payload}.${signature}`, SECRET, NOW)?.scope)
      .toBe('collaborator');
  });

  it('refuses a scope outside the daemon vocabulary', () => {
    // Not a fallback: a console signing a value this side does not know is a
    // deployment mismatch, and silently downgrading it would hide that.
    const payload = Buffer.from(JSON.stringify({
      version: 1,
      ...claims,
      scope: 'superuser',
      expiresAt: Math.floor(NOW / 1000) + ACTIVE_WORKSPACE_TTL_SECONDS,
    })).toString('base64url');
    const signature = createHmac('sha256', SECRET)
      .update('commonplace-active-workspace-v1\0')
      .update(payload)
      .digest('base64url');

    expect(decodeActiveWorkspaceClaims(`${payload}.${signature}`, SECRET, NOW)).toBeNull();
  });

  it('admits only a non-placeholder signing secret', () => {
    expect(resolveActiveWorkspaceSecret({})).toBeNull();
    expect(resolveActiveWorkspaceSecret({
      COMMONPLACE_ACTIVE_WORKSPACE_SECRET: 'change-me',
    })).toBeNull();
    expect(resolveActiveWorkspaceSecret({
      COMMONPLACE_ACTIVE_WORKSPACE_SECRET: SECRET,
    })).toBe(SECRET);
  });
});

describe('workspaceSessionScope', () => {
  it('gives owner to the permissions the daemon gates behind owner', () => {
    // Token minting, workspace deletion, and runtime upgrades are what the
    // daemon's host routes protect, and these are this app's names for them.
    expect(workspaceSessionScope(['workspace.manage'])).toBe('owner');
    expect(workspaceSessionScope(['members.manage'])).toBe('owner');
    expect(workspaceSessionScope(['keys.manage'])).toBe('owner');
  });

  it('gives collaborator to a member who can write content', () => {
    expect(workspaceSessionScope(['content.write'])).toBe('collaborator');
  });

  it('gives viewer to a read-only member', () => {
    // The case that had no representation at all: before the scope was signed
    // this member reached the daemon as a collaborator and could write.
    expect(workspaceSessionScope([])).toBe('viewer');
    expect(workspaceSessionScope(['content.read'])).toBe('viewer');
  });

  it('takes the highest scope the permission set earns', () => {
    expect(workspaceSessionScope(['content.write', 'keys.manage'])).toBe('owner');
  });

  it('ignores permissions it does not recognize', () => {
    // A permission added upstream must not become a daemon privilege by
    // accident. It reads as no privilege until this mapping names it.
    expect(workspaceSessionScope(['billing.manage', 'analytics.read'])).toBe('viewer');
  });
});
