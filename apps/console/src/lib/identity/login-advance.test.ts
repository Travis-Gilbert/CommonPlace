import { describe, expect, it, vi } from 'vitest';
import { advanceAuthenticatedLogin, workspaceIdFromCallback } from './login-advance';

const workspaces = [
  { id: 'workspace-1', slug: 'research' },
  { id: 'workspace-2', slug: 'theorem' },
];

describe('login advance', () => {
  it('reads a workspace id or slug from the callback path', () => {
    expect(workspaceIdFromCallback('/workspace/workspace-2/chat', workspaces)).toBe(
      'workspace-2',
    );
    expect(workspaceIdFromCallback('/workspace/research/chat', workspaces)).toBe(
      'workspace-1',
    );
    expect(workspaceIdFromCallback('/chat', workspaces)).toBeNull();
  });

  it('sends incomplete identities to onboarding without selecting a workspace', async () => {
    const select = vi.fn();
    const assign = vi.fn();
    await advanceAuthenticatedLogin({
      onboardingComplete: false,
      workspaces: [],
      callbackUrl: '/chat',
      select,
      assign,
    });
    expect(select).not.toHaveBeenCalled();
    expect(assign).toHaveBeenCalledWith('/onboarding');
  });

  it('selects a workspace before opening chat so the active claim exists', async () => {
    const select = vi.fn(async () => undefined);
    const assign = vi.fn();
    await advanceAuthenticatedLogin({
      onboardingComplete: true,
      workspaces,
      callbackUrl: '/chat',
      select,
      assign,
    });
    expect(select).toHaveBeenCalledWith('workspace-1');
    expect(assign).toHaveBeenCalledWith('/workspace/workspace-1/chat');
  });
});
