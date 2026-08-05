// SOURCING: none. Thread chat routes render theorem.chat register.

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import type { ReactElement } from 'react';

const { redirect } = vi.hoisted(() => ({
  redirect: vi.fn((url: string) => {
    throw new Error(`REDIRECT:${url}`);
  }),
}));

vi.mock('next/navigation', () => ({
  redirect,
}));

vi.mock('@/lib/server/harness-principal', () => ({
  resolveHarnessPrincipal: vi.fn(),
}));

vi.mock('@/views/TheoremChatRegister', () => ({
  TheoremChatRegisterView: function TheoremChatRegisterView({
    reason,
  }: {
    readonly reason?: string;
  }) {
    return (
      <div data-register-impl="theorem.chat" data-theorem-chat-register>
        {reason}
      </div>
    );
  },
}));

import { resolveHarnessPrincipal } from '@/lib/server/harness-principal';
import ChatThreadPage from './page';

describe('ChatThreadPage', () => {
  beforeEach(() => {
    redirect.mockClear();
    vi.mocked(resolveHarnessPrincipal).mockReset();
  });

  it('renders theorem.chat register for a workspace-scoped principal', async () => {
    vi.mocked(resolveHarnessPrincipal).mockResolvedValue({
      ok: true,
      principal: {
        tenant: 'Travis-Gilbert',
        workspaceId: 'ws-1',
        scopeRef: 'scope-1',
      },
    } as never);

    const element = await ChatThreadPage({
      params: Promise.resolve({ threadId: 'thread-1' }),
    });
    const html = renderToStaticMarkup(element as ReactElement);
    expect(html).toContain('data-register-impl="theorem.chat"');
    expect(html).toContain('thread-1');
  });
});
