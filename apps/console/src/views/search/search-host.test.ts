// @vitest-environment jsdom

import { describe, expect, it, vi } from 'vitest';
import type {
  BlockHost,
  ObjectAction,
} from '@commonplace/block-view/types';
import type { ConstellationNode, SessionOrigin } from '@commonplace/search-stack';
import {
  openSearchPageInWebEdition,
  recordSearchSessionOrigin,
} from './search-host';

const NODE: ConstellationNode = {
  id: 'result-1',
  url: 'https://example.com/result',
  title: 'Result',
  admittedRank: 1,
  relation: 'KNOWN',
};

const ORIGIN: SessionOrigin = {
  kind: 'constellation',
  subgraphRef: 'subgraph-1',
  query: 'durable search',
  nodeId: NODE.id,
};

function hostWithEmit(
  emit: BlockHost['emit'],
): BlockHost {
  return {
    emit,
    query: vi.fn(),
    viewsFor: vi.fn(() => []),
    tokens: { color: {}, space: {}, typography: {}, radius: {} },
  };
}

describe('search host adapter', () => {
  it('records the session origin through the object seam', async () => {
    let action: ObjectAction | null = null;
    const emit: BlockHost['emit'] = vi.fn(async (next) => {
      action = next;
      return {
        ok: true,
        value: {
          action_kind: next.kind,
          status: 'applied' as const,
          target_ids: ['origin-1'],
        },
      };
    });
    const host = hostWithEmit(emit);

    await recordSearchSessionOrigin(host, 'session-1', ORIGIN, () => 42);
    expect(action).toMatchObject({
      kind: 'create',
      type: 'search-session-origin',
      props: {
        session_id: 'session-1',
        subgraph_ref: 'subgraph-1',
        node_id: 'result-1',
        persistence_kind: 'search-session-origin-v1',
      },
    });
  });

  it('refuses to turn a failed durable write into success', async () => {
    const host = hostWithEmit(vi.fn(async () => ({
      ok: false,
      error: 'identity refused',
    })));
    await expect(
      recordSearchSessionOrigin(host, 'session-1', ORIGIN),
    ).rejects.toThrow('identity refused');
  });

  it('opens a result in the web edition and reports popup refusal', async () => {
    const open = vi.spyOn(window, 'open');
    open.mockReturnValue(window);
    await expect(openSearchPageInWebEdition(NODE.url, NODE)).resolves.toBeUndefined();
    expect(open).toHaveBeenCalledWith(NODE.url, '_blank', 'noopener,noreferrer');

    open.mockReturnValue(null);
    await expect(openSearchPageInWebEdition(NODE.url, NODE)).rejects.toThrow(
      'blocked',
    );
  });
});
