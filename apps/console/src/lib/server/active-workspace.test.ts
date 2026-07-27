import { describe, expect, it } from 'vitest';
import {
  ACTIVE_WORKSPACE_TTL_SECONDS,
  decodeActiveWorkspaceClaims,
  encodeActiveWorkspaceClaims,
  resolveActiveWorkspaceSecret,
} from './active-workspace';

const SECRET = 'active-workspace-test-secret-longer-than-thirty-two-characters';
const NOW = Date.parse('2026-07-27T12:00:00.000Z');
const claims = {
  subject: 'github:42',
  workspaceId: 'workspace-42',
  workspaceSlug: 'research',
  tenant: 'Travis-Gilbert',
  scopeRef: 'workspace:workspace-42',
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
