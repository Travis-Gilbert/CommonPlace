import { beforeEach, describe, expect, it, vi } from 'vitest';

const { callHarnessMcpMock } = vi.hoisted(() => ({
  callHarnessMcpMock: vi.fn(),
}));

vi.mock('server-only', () => ({}));
vi.mock('@/lib/server/harness-mcp', () => ({
  callHarnessMcp: callHarnessMcpMock,
}));

import { callHarnessGraphql } from './harness-graphql';
import { sentenceForCode } from '@/lib/degradation';

const principal = {
  tenant: 'Travis-Gilbert',
  githubLogin: 'Travis-Gilbert',
  harnessIdentity: 'github:owner',
};

beforeEach(() => {
  callHarnessMcpMock.mockReset();
});

describe('callHarnessGraphql', () => {
  it('carries query documents through the deployed graphql_query MCP tool', async () => {
    callHarnessMcpMock.mockResolvedValue({
      ok: true,
      data: { data: { status: { ok: true } }, errors: [] },
      principal,
    });

    const result = await callHarnessGraphql(
      'query ConsoleStatus($scope: JSON!) { status(scope: $scope) }',
      { scope: { kind: 'global' } },
    );

    expect(callHarnessMcpMock).toHaveBeenCalledWith('graphql_query', {
      query: 'query ConsoleStatus($scope: JSON!) { status(scope: $scope) }',
      variables: { scope: { kind: 'global' } },
    });
    expect(result).toEqual({
      ok: true,
      data: { status: { ok: true } },
      principal,
    });
  });

  it('uses the write-gated graphql_mutate tool for mutation documents', async () => {
    callHarnessMcpMock.mockResolvedValue({
      ok: true,
      data: { data: { pinObserved: { status: 'applied' } } },
      principal,
    });

    await callHarnessGraphql(
      'mutation ConsolePin($input: JSON!) { pinObserved(input: $input) }',
      { input: { kind: 'type' } },
      'mutate',
    );

    expect(callHarnessMcpMock).toHaveBeenCalledWith('graphql_mutate', {
      query: 'mutation ConsolePin($input: JSON!) { pinObserved(input: $input) }',
      variables: { input: { kind: 'type' } },
    });
  });

  it('preserves GraphQL errors carried inside MCP structured content', async () => {
    callHarnessMcpMock.mockResolvedValue({
      ok: true,
      data: { data: null, errors: [{ message: 'Unknown field status' }] },
      principal,
    });

    await expect(callHarnessGraphql('query { status }')).resolves.toEqual({
      ok: false,
      status: 502,
      error: 'Unknown field status',
    });
  });

  it('maps MCP transport failures into the GraphQL degradation vocabulary', async () => {
    callHarnessMcpMock.mockResolvedValue({
      ok: false,
      response: Response.json({ error: 'harness_mcp_timeout' }, { status: 504 }),
    });

    await expect(callHarnessGraphql('query { status }')).resolves.toEqual({
      ok: false,
      status: 504,
      error: 'harness_graphql_timeout',
    });
  });

  it.each([
    [401, 'mcp_authentication_failed'],
    [404, 'mcp_session_uninitialized'],
    [406, 'mcp_not_acceptable'],
  ])('preserves named MCP failure %s through the GraphQL adapter', async (status, error) => {
    const response = Response.json({ error }, { status });
    callHarnessMcpMock.mockResolvedValue({ ok: false, response });

    const result = await callHarnessGraphql('query { status }');

    expect(result).toMatchObject({ ok: false, status, error });
    expect(sentenceForCode(result.ok ? '' : result.error)).not.toBe(
      'This surface cannot render right now.',
    );
    if (status === 401 && !result.ok) {
      expect(result.response).toBe(response);
    }
  });
});
