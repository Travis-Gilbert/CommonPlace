// SOURCING: none. Pure query state for the three model lenses.

import type { ObjectSet } from '@commonplace/block-view/types';
import type { ScopeRef } from '@commonplace/data-model-contracts';

export type ModelLens = 'diagram' | 'fields' | 'records';

export type ModelSelection =
  | { readonly kind: 'observed-type'; readonly key: string }
  | { readonly kind: 'observed-field'; readonly key: string }
  | { readonly kind: 'observed-edge'; readonly key: string }
  | { readonly kind: 'declared-type'; readonly key: string }
  | { readonly kind: 'declared-field'; readonly key: string }
  | { readonly kind: 'declared-relation'; readonly key: string };

export interface ModelQueryState {
  readonly scope: ScopeRef;
  readonly selection: ModelSelection | null;
  readonly pendingPins: readonly string[];
  readonly lens: ModelLens;
}

export type ModelQueryAction =
  | { readonly type: 'switch-lens'; readonly lens: ModelLens }
  | { readonly type: 'select'; readonly selection: ModelSelection | null }
  | { readonly type: 'pin-start'; readonly observedKey: string }
  | { readonly type: 'pin-finish'; readonly observedKey: string }
  | { readonly type: 'set-scope'; readonly scope: ScopeRef };

export function createModelQueryState(scope: ScopeRef): ModelQueryState {
  return {
    scope,
    selection: null,
    pendingPins: [],
    lens: 'diagram',
  };
}

export function reduceModelQuery(
  state: ModelQueryState,
  action: ModelQueryAction,
): ModelQueryState {
  switch (action.type) {
    case 'switch-lens':
      return { ...state, lens: action.lens };
    case 'select':
      return { ...state, selection: action.selection };
    case 'pin-start':
      return state.pendingPins.includes(action.observedKey)
        ? state
        : { ...state, pendingPins: [...state.pendingPins, action.observedKey] };
    case 'pin-finish':
      return {
        ...state,
        pendingPins: state.pendingPins.filter((key) => key !== action.observedKey),
      };
    case 'set-scope':
      return action.scope.kind === 'topic'
        && state.scope.kind === 'topic'
        && action.scope.topicId === state.scope.topicId
        ? { ...state, scope: action.scope }
        : createModelQueryState(action.scope);
  }
}

export function modelScopeFromSet(set: ObjectSet): ScopeRef | null {
  const scope = set.objects.find((object) => object.type === 'model-scope');
  if (!scope) return null;
  const topicId = scope.properties.topic_id;
  if (typeof topicId !== 'string' || !topicId.trim()) return null;
  const tenant = scope.properties.tenant;
  return {
    kind: 'topic',
    topicId,
    ...(typeof tenant === 'string' && tenant ? { tenant } : {}),
  };
}
