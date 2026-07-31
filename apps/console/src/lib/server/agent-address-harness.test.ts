import { beforeEach, describe, expect, it, vi } from 'vitest';

const { callHarnessGraphqlMock } = vi.hoisted(() => ({
  callHarnessGraphqlMock: vi.fn(),
}));

vi.mock('server-only', () => ({}));
vi.mock('@/lib/server/harness-graphql', () => ({
  callHarnessGraphql: callHarnessGraphqlMock,
}));

import { mintAgentAlias, revokeAgentAlias } from './agent-address-harness';

const principal = {
  tenant: 'Travis-Gilbert',
  githubLogin: 'Travis-Gilbert',
  harnessIdentity: 'github:owner',
};

const alias = {
  alias: 'acme',
  userSlug: 'travis',
  counterparty: 'acme',
  createdAt: '2026-07-30T00:00:00Z',
  status: 'active',
  address: 'acme@example.com',
};

beforeEach(() => {
  callHarnessGraphqlMock.mockReset();
});

describe('agent address Harness mutations', () => {
  it('routes alias minting through graphql_mutate', async () => {
    const input = {
      alias: alias.alias,
      userSlug: alias.userSlug,
      counterparty: alias.counterparty,
    };
    callHarnessGraphqlMock.mockResolvedValue({
      ok: true,
      data: { mintAgentAlias: alias },
      principal,
    });

    await expect(mintAgentAlias(input)).resolves.toEqual({ ok: true, alias });

    expect(callHarnessGraphqlMock).toHaveBeenCalledWith(
      expect.stringContaining('mutation MintAlias'),
      input,
      'mutate',
    );
  });

  it('routes alias revocation through graphql_mutate', async () => {
    callHarnessGraphqlMock.mockResolvedValue({
      ok: true,
      data: { revokeAgentAlias: { ...alias, status: 'revoked' } },
      principal,
    });

    await expect(revokeAgentAlias(alias.alias)).resolves.toMatchObject({
      ok: true,
      alias: { alias: alias.alias, status: 'revoked' },
    });

    expect(callHarnessGraphqlMock).toHaveBeenCalledWith(
      expect.stringContaining('mutation RevokeAlias'),
      { alias: alias.alias },
      'mutate',
    );
  });
});
