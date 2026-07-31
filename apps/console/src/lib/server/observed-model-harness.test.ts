import { beforeEach, describe, expect, it, vi } from 'vitest';

const { callHarnessGraphqlMock } = vi.hoisted(() => ({
  callHarnessGraphqlMock: vi.fn(),
}));

vi.mock('server-only', () => ({}));
vi.mock('@/lib/server/harness-graphql', () => ({
  callHarnessGraphql: callHarnessGraphqlMock,
}));

import { compileDeclaredModel } from './observed-model-harness';

beforeEach(() => {
  callHarnessGraphqlMock.mockReset();
});

describe('declared model compilation', () => {
  it('keeps compileDeclaredModel on the schema-defined Query root', async () => {
    callHarnessGraphqlMock.mockResolvedValue({
      ok: true,
      data: { compileDeclaredModel: { artifactId: 'compiled-model' } },
      principal: {
        tenant: 'Travis-Gilbert',
        githubLogin: 'Travis-Gilbert',
        harnessIdentity: 'github:owner',
      },
    });

    await expect(compileDeclaredModel('topic-1')).resolves.toEqual({
      ok: true,
      tenant: 'Travis-Gilbert',
      value: { artifactId: 'compiled-model' },
    });

    expect(callHarnessGraphqlMock).toHaveBeenCalledWith(
      expect.stringContaining('query ConsoleCompileDeclaredModel'),
      { topicId: 'topic-1' },
      'query',
    );
  });
});
