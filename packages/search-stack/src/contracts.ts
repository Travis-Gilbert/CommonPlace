// SOURCING: extracted from the CommonPlace search stack. Pure contracts only.

export {
  COMMONPLACE_SEARCH_STACK_CONTRACT_VERSION,
  FIND_SCOPE_ORDER,
  MAX_ASPECTS,
  MAX_CONSTELLATION_MEMORY_NODES,
  MAX_CONSTELLATION_RESULT_NODES,
} from '@commonplace/block-view-contracts/search-stack';

export type {
  AspectEdge,
  AspectId,
  AspectNode,
  ByteRange,
  ConstellationEdge,
  ConstellationEdgeReason,
  ConstellationMemoryNode,
  ConstellationNode,
  ConstellationPayload,
  ConstellationQueryMeta,
  ConstellationState,
  EdgeReasonType,
  EdgeRef,
  FindHit,
  FindLane,
  FindRequest,
  FindResponse,
  FindResult,
  FindScope,
  FindScopeKind,
  GraphRelation,
  LaneReceipt,
  SaveUrlReceipt,
  ScatterResponse,
  SceneRef,
} from '@commonplace/block-view-contracts/search-stack';

import {
  FIND_SCOPE_ORDER,
  type FindLane,
  type FindScope,
  type FindScopeKind,
} from '@commonplace/block-view-contracts/search-stack';

export type LaneChip = 'exact' | 'semantic' | 'graph';

export const LANE_CHIPS: readonly LaneChip[] = ['exact', 'semantic', 'graph'];

export const LANE_CHIP_LABEL: Readonly<Record<LaneChip, string>> = {
  exact: 'Exact',
  semantic: 'Semantic',
  graph: 'Graph',
};

export const LANES_FOR_CHIP: Readonly<Record<LaneChip, readonly FindLane[]>> = {
  exact: ['EXACT', 'LEXICAL'],
  semantic: ['SEMANTIC'],
  graph: ['STRUCTURAL'],
};

export const SCOPE_LABEL: Readonly<Record<FindScopeKind, string>> = {
  PAGE: 'Page',
  SESSION: 'Session',
  CORPUS: 'Corpus',
  WEB: 'Web',
};

export function widenScope(current: FindScopeKind): FindScopeKind {
  const index = FIND_SCOPE_ORDER.indexOf(current);
  if (index < 0) return FIND_SCOPE_ORDER[0];
  return FIND_SCOPE_ORDER[Math.min(index + 1, FIND_SCOPE_ORDER.length - 1)];
}

export function scopesUpTo(
  kind: FindScopeKind,
  context: {
    readonly pageNodeId?: string | null;
    readonly sessionNodeIds?: readonly string[];
  },
): FindScope[] {
  const rank = FIND_SCOPE_ORDER.indexOf(kind);
  const through = FIND_SCOPE_ORDER.slice(0, Math.max(0, rank) + 1);
  return through.flatMap<FindScope>((scopeKind) => {
    switch (scopeKind) {
      case 'PAGE':
        return context.pageNodeId
          ? [{ kind: 'PAGE', nodeId: context.pageNodeId }]
          : [];
      case 'SESSION':
        return [{ kind: 'SESSION', nodeIds: context.sessionNodeIds ?? [] }];
      case 'CORPUS':
        return [{ kind: 'CORPUS' }];
      case 'WEB':
        return [{ kind: 'WEB' }];
    }
  });
}

export function lanesForChips(chips: readonly LaneChip[]): FindLane[] {
  return chips.flatMap((chip) => [...LANES_FOR_CHIP[chip]]);
}

export function chipForLane(lane: FindLane): LaneChip {
  if (lane === 'SEMANTIC') return 'semantic';
  if (lane === 'STRUCTURAL') return 'graph';
  return 'exact';
}

export type AsyncState<T> =
  | { readonly status: 'empty' }
  | { readonly status: 'loading' }
  | { readonly status: 'error'; readonly message: string }
  | { readonly status: 'success'; readonly data: T };

export const asyncState = {
  empty<T>(): AsyncState<T> {
    return { status: 'empty' };
  },
  loading<T>(): AsyncState<T> {
    return { status: 'loading' };
  },
  error<T>(message: string): AsyncState<T> {
    return { status: 'error', message };
  },
  success<T>(data: T): AsyncState<T> {
    return { status: 'success', data };
  },
} as const;
