// SOURCING: none. Pure page contract regressions.

import { describe, expect, it } from 'vitest';
import {
  AdminOverviewSchema,
  DocumentIngestReceiptSchema,
  IdentitySessionSchema,
  IdentityWorkspaceSchema,
  InviteSchema,
} from './contracts';
import { workspaceSlugFromName } from '@/components/fork/OnboardingPage';
import { safeCallback } from '@/components/fork/LoginPage';

const workspace = {
  id: 'workspace-1',
  tenant: 'Travis-Gilbert',
  slug: 'research',
  scopeRef: 'workspace:workspace-1',
  name: 'Research',
  role: {
    key: 'owner',
    name: 'Owner',
    permissions: ['workspace.read'],
  },
};

describe('fork identity page contracts', () => {
  it('keeps tenant casing and scope reference in every workspace projection', () => {
    expect(IdentityWorkspaceSchema.parse(workspace)).toEqual(workspace);
    expect(
      IdentitySessionSchema.parse({
        user: {
          id: 'user-1',
          username: 'Travis-Gilbert',
          displayName: null,
          email: null,
          status: 'ACTIVE',
        },
        workspaces: [workspace],
        onboardingComplete: true,
      }).workspaces[0]?.tenant,
    ).toBe('Travis-Gilbert');
  });

  it('requires invitation expiry and one admitted workspace role', () => {
    expect(
      InviteSchema.safeParse({
        id: 'invite-1',
        workspace,
        role: { id: 'role-1', key: 'member', name: 'Member' },
        email: null,
        status: 'PENDING',
        expiresAt: '2026-08-01T00:00:00.000Z',
      }).success,
    ).toBe(true);
  });

  it('preserves inactive user status in the admin roster', () => {
    expect(
      AdminOverviewSchema.parse({
        users: [{
          id: 'user-2',
          username: 'suspended-user',
          displayName: null,
          email: null,
          status: 'SUSPENDED',
        }],
        workspaces: [],
        pendingInvites: [],
      }).users[0]?.status,
    ).toBe('SUSPENDED');
  });

  it('derives only an admitted lowercase workspace slug', () => {
    expect(workspaceSlugFromName('  Graph Native Research  ')).toBe('graph-native-research');
    expect(workspaceSlugFromName('---')).toBe('');
  });

  it('keeps login callbacks on same-origin paths', () => {
    expect(safeCallback('/workspace/research/chat')).toBe(
      '/workspace/research/chat',
    );
    expect(safeCallback('//attacker.example/path')).toBe('/chat');
    expect(safeCallback('/\\attacker.example/path')).toBe('/chat');
    expect(safeCallback('https://attacker.example/path')).toBe('/chat');
  });

  it('requires a scope-bound receipt for every successful document upload', () => {
    expect(
      DocumentIngestReceiptSchema.safeParse({
        correlationId: 'express-document-request-0001',
        idempotencyKey: 'collector:sha256:batch',
        scopeRef: 'workspace:workspace-1',
        receipts: [{
          item: { id: 'item-1', collections: ['collection-auto'] },
          correlationId: 'express-document-request-0001',
          idempotencyKey: 'collector:sha256:batch',
          documentIndex: 0,
          documentDigest: 'sha256:document',
        }],
      }).success,
    ).toBe(true);
    expect(
      DocumentIngestReceiptSchema.safeParse({
        correlationId: 'express-document-request-0001',
        idempotencyKey: 'collector:sha256:batch',
        scopeRef: 'workspace:workspace-1',
        receipts: [],
      }).success,
    ).toBe(false);
  });
});
