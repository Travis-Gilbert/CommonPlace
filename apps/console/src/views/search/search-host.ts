'use client';

import type {
  BlockHost,
  ObjectActionReceipt,
} from '@commonplace/block-view/types';
import type {
  ConstellationNode,
  SessionOrigin,
} from '@commonplace/search-stack';

export const SEARCH_SESSION_ORIGIN_TYPE = 'search-session-origin';

let originSequence = 0;

export async function openSearchPageInWebEdition(
  url: string,
  _node: ConstellationNode,
): Promise<void> {
  const opened = window.open(url, '_blank', 'noopener,noreferrer');
  if (!opened) throw new Error('The browser blocked the search result page.');
}

export async function recordSearchSessionOrigin(
  host: BlockHost,
  sessionId: string,
  origin: SessionOrigin,
  now: () => number = Date.now,
): Promise<ObjectActionReceipt> {
  const id = `${SEARCH_SESSION_ORIGIN_TYPE}:${sessionId}:${now()}:${originSequence++}`;
  const result = await host.emit({
    kind: 'create',
    type: SEARCH_SESSION_ORIGIN_TYPE,
    props: {
      id,
      title: `Search origin for ${origin.query}`,
      session_id: sessionId,
      origin_kind: origin.kind,
      subgraph_ref: origin.subgraphRef,
      query: origin.query,
      node_id: origin.nodeId,
      persistence_kind: 'search-session-origin-v1',
    },
  });
  if (!result.ok || !result.value) {
    throw new Error(result.error ?? 'Search session origin was not recorded.');
  }
  return result.value;
}
