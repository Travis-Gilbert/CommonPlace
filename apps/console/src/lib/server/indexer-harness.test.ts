import { beforeEach, describe, expect, it, vi } from 'vitest';

const { callHarnessGraphqlMock } = vi.hoisted(() => ({
  callHarnessGraphqlMock: vi.fn(),
}));

vi.mock('server-only', () => ({}));
vi.mock('@/lib/server/harness-graphql', () => ({
  callHarnessGraphql: callHarnessGraphqlMock,
}));

import { readIndexerObjects, readIndexerPreviewAsset } from './indexer-harness';

const principal = {
  tenant: 'Travis-Gilbert',
  githubLogin: 'Travis-Gilbert',
  harnessIdentity: 'github:owner',
};

beforeEach(() => {
  callHarnessGraphqlMock.mockReset();
});

describe('Indexer Harness GraphQL transport', () => {
  it('reads Indexer objects through the shared MCP GraphQL door', async () => {
    callHarnessGraphqlMock.mockResolvedValue({
      ok: true,
      principal,
      data: {
        topicIndexerObjects: {
          objects: [{
            id: 'topic:one',
            type: 'topic',
            properties: { title: 'One' },
          }],
        },
      },
    });

    const result = await readIndexerObjects({ topicId: 'one' });

    expect(callHarnessGraphqlMock).toHaveBeenCalledWith(
      expect.stringContaining('topicIndexerObjects'),
      { topicId: 'one', includeCaptures: true },
    );
    expect(result).toEqual({
      ok: true,
      tenant: 'Travis-Gilbert',
      objects: [{
        id: 'topic:one',
        type: 'topic',
        properties: { title: 'One' },
      }],
    });
  });

  it('decodes an allowlisted preview returned through MCP GraphQL', async () => {
    callHarnessGraphqlMock.mockResolvedValue({
      ok: true,
      principal,
      data: {
        topicPreviewAsset: {
          content_type: 'image/png',
          bytes_base64: 'aGk=',
        },
      },
    });

    const result = await readIndexerPreviewAsset('0a');

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.contentType).toBe('image/png');
      expect([...result.bytes]).toEqual([104, 105]);
    }
  });

  it('maps shared transport failures to the Indexer vocabulary', async () => {
    callHarnessGraphqlMock.mockResolvedValue({
      ok: false,
      status: 504,
      error: 'harness_graphql_timeout',
    });

    await expect(readIndexerObjects({})).resolves.toEqual({
      ok: false,
      status: 504,
      error: 'indexer_graphql_timeout',
    });
  });
});
