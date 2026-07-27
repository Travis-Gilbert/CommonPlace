import { afterEach, describe, expect, it, vi } from 'vitest';

const callHarnessGraphqlMock = vi.hoisted(() => vi.fn());

vi.mock('server-only', () => ({}));
vi.mock('@/lib/server/harness-graphql', () => ({
  callHarnessGraphql: callHarnessGraphqlMock,
}));

import { mutateConsolePlugin, readConsoleSnapshot } from './server';

function projection(
  receiptId: string,
  nextCursor: string | null,
  total: number,
): Record<string, unknown> {
  return {
    consoleOverview: {
      countsByType: [{ nodeType: 'receipt', count: total }],
      generation: 1,
      readiness: [],
    },
    consoleEntities: [],
    consoleReceipts: {
      receipts: [{
        id: receiptId,
        kind: 'ingest',
        subjectId: 'golden:1',
        actor: 'fixture',
        occurredAtMs: 1,
        summary: receiptId,
        evidence: {},
      }],
      nextCursor,
      total,
    },
    consoleNeighborhood: {
      root: 'node:1',
      depth: 1,
      nodes: [{ id: 'node:1', nodeType: 'record', label: 'One' }],
      edges: [],
    },
    standingQueries: [],
    standingFirings: [],
  };
}

afterEach(() => {
  callHarnessGraphqlMock.mockReset();
});

describe('console snapshot pagination', () => {
  it('follows receipt cursors until the reported total is complete', async () => {
    callHarnessGraphqlMock
      .mockResolvedValueOnce({
        ok: true,
        data: projection('receipt:1', 'cursor:2', 2),
        principal: {},
      })
      .mockResolvedValueOnce({
        ok: true,
        data: projection('receipt:2', null, 2),
        principal: {},
      });

    const result = await readConsoleSnapshot();

    expect(result).toMatchObject({
      ok: true,
      snapshot: {
        receipts: [{ id: 'receipt:1' }, { id: 'receipt:2' }],
      },
    });
    expect(callHarnessGraphqlMock).toHaveBeenNthCalledWith(
      1,
      expect.any(String),
      expect.objectContaining({ receiptCursor: null }),
    );
    expect(callHarnessGraphqlMock).toHaveBeenNthCalledWith(
      2,
      expect.any(String),
      expect.objectContaining({ receiptCursor: 'cursor:2' }),
    );
  });

  it('refuses a cursor loop', async () => {
    callHarnessGraphqlMock
      .mockResolvedValueOnce({
        ok: true,
        data: projection('receipt:1', 'cursor:2', 3),
        principal: {},
      })
      .mockResolvedValueOnce({
        ok: true,
        data: projection('receipt:2', 'cursor:2', 3),
        principal: {},
      });

    await expect(readConsoleSnapshot()).resolves.toEqual({
      ok: false,
      status: 502,
      error: 'console_graphql_receipt_cursor_loop',
    });
  });
});

describe('console plugin lifecycle', () => {
  it('dispatches lifecycle operations through the Harness mutation tool', async () => {
    callHarnessGraphqlMock.mockResolvedValue({
      ok: true,
      data: {},
      principal: {},
    });

    await expect(mutateConsolePlugin('deny')).resolves.toEqual({
      ok: true,
      plugin: { state: 'denied', grants: [], contributions: [] },
    });
    expect(callHarnessGraphqlMock).toHaveBeenCalledWith(
      expect.stringContaining('mutation'),
      { appId: 'commonplace.console' },
      'mutate',
    );
  });
});
