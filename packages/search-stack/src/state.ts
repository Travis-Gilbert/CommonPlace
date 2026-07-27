// SOURCING: extracted search stack state. Framework-neutral observable controller.

import {
  MAX_ASPECTS,
  asyncState,
  type AspectId,
  type AsyncState,
  type ConstellationNode,
  type ConstellationState,
  type FindResponse,
  type ScatterResponse,
} from './contracts';
import type { SearchStackClient } from './client';
import {
  constellationFromFind,
  constellationFromScatter,
} from './projection';

export const DEFAULT_LAMBDA = 0.5;
export const ASPECT_RESULT_K = 20;
export const LAMBDA_PREFERENCE_KEY = 'commonplace.search.lambda';

export type SerpLayer = 'scatter' | 'aspect';

export interface SearchPreferenceStore {
  readonly read: (key: string) => string | null;
  readonly write: (key: string, value: string) => void;
}

export interface StagePage {
  readonly nodeId: string;
  readonly url: string;
  readonly title: string;
}

export interface SessionOrigin {
  readonly kind: 'constellation';
  readonly subgraphRef: string;
  readonly query: string;
  readonly nodeId: string;
}

export interface OpenNodeContext {
  readonly sessionId: string | null;
  readonly open: (
    url: string,
    node: ConstellationNode,
  ) => Promise<void>;
  readonly recordOrigin?: (
    sessionId: string,
    origin: SessionOrigin,
  ) => Promise<void>;
}

export interface SearchStackSnapshot {
  readonly lambda: number;
  readonly query: string;
  readonly scatter: AsyncState<ScatterResponse>;
  readonly layer: SerpLayer;
  readonly selectedAspect: AspectId | null;
  readonly aspectResults: Readonly<Record<AspectId, AsyncState<FindResponse>>>;
  readonly expanding: AspectId | null;
  readonly stage: StagePage | null;
  readonly visited: readonly string[];
  readonly docked: boolean;
  readonly error: string | null;
}

export interface SearchStackController {
  readonly getSnapshot: () => SearchStackSnapshot;
  readonly subscribe: (listener: () => void) => () => void;
  readonly setLambda: (lambda: number) => void;
  readonly submit: (query: string) => Promise<void>;
  readonly selectAspect: (aspect: AspectId) => Promise<void>;
  readonly backToScatter: () => void;
  readonly expandAspect: (aspect: AspectId) => Promise<void>;
  readonly openNode: (
    node: ConstellationNode,
    context: OpenNodeContext,
  ) => Promise<void>;
  readonly reopenMap: () => void;
  readonly dockMap: () => void;
  readonly reset: () => void;
}

export interface SearchStackControllerOptions {
  readonly client: SearchStackClient;
  readonly preferences?: SearchPreferenceStore;
  readonly preferenceKey?: string;
}

export function createSearchStackController(
  options: SearchStackControllerOptions,
): SearchStackController {
  const { client, preferences } = options;
  const preferenceKey = options.preferenceKey ?? LAMBDA_PREFERENCE_KEY;
  const listeners = new Set<() => void>();
  let submitGeneration = 0;
  let expansionGeneration = 0;
  let snapshot: SearchStackSnapshot = initialSnapshot(
    readLambda(preferences, preferenceKey),
  );

  function publish(patch: Partial<SearchStackSnapshot>): void {
    snapshot = { ...snapshot, ...patch };
    for (const listener of listeners) listener();
  }

  const controller: SearchStackController = {
    getSnapshot: () => snapshot,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    setLambda(value) {
      const lambda = clampLambda(value);
      publish({ lambda });
      preferences?.write(preferenceKey, String(lambda));
    },
    async submit(query) {
      const trimmed = query.trim();
      if (!trimmed) return;
      const generation = ++submitGeneration;
      expansionGeneration += 1;
      publish({
        query: trimmed,
        scatter: asyncState.loading(),
        layer: 'scatter',
        selectedAspect: null,
        aspectResults: {},
        expanding: null,
        stage: null,
        visited: [],
        docked: false,
        error: null,
      });
      try {
        const response = await client.scatter({
          query: trimmed,
          k: MAX_ASPECTS,
          lambda: snapshot.lambda,
        });
        if (generation !== submitGeneration || snapshot.query !== trimmed) return;
        publish({
          scatter: response.aspects.length
            ? asyncState.success(response)
            : asyncState.empty(),
        });
      } catch (error) {
        if (generation !== submitGeneration || snapshot.query !== trimmed) return;
        const message = errorMessage(error);
        publish({ scatter: asyncState.error(message), error: message });
      }
    },
    async selectAspect(aspect) {
      const known = snapshot.aspectResults[aspect];
      publish({ layer: 'aspect', selectedAspect: aspect });
      if (known?.status === 'success' || known?.status === 'loading') return;
      const node = scatterOf(snapshot)?.aspects.find(
        (candidate) => candidate.id === aspect,
      );
      if (!node) return;
      const rootQuery = snapshot.query;
      const lambda = snapshot.lambda;
      publish({
        aspectResults: {
          ...snapshot.aspectResults,
          [aspect]: asyncState.loading(),
        },
        error: null,
      });
      try {
        const response = await client.find({
          query: aspectQuery(rootQuery, node.label),
          scopes: [{ kind: 'CORPUS' }, { kind: 'WEB' }],
          lanes: ['EXACT', 'LEXICAL', 'SEMANTIC', 'STRUCTURAL'],
          k: ASPECT_RESULT_K,
          lambda,
        });
        if (snapshot.query !== rootQuery) return;
        publish({
          aspectResults: {
            ...snapshot.aspectResults,
            [aspect]: response.results.length
              ? asyncState.success(response)
              : asyncState.empty(),
          },
        });
      } catch (error) {
        if (snapshot.query !== rootQuery) return;
        const message = errorMessage(error);
        publish({
          aspectResults: {
            ...snapshot.aspectResults,
            [aspect]: asyncState.error(message),
          },
          error: message,
        });
      }
    },
    backToScatter() {
      publish({ layer: 'scatter', selectedAspect: null });
    },
    async expandAspect(aspect) {
      const current = scatterOf(snapshot);
      if (!current) return;
      const rootQuery = snapshot.query;
      const generation = ++expansionGeneration;
      publish({ expanding: aspect, error: null });
      try {
        const expansion = await client.expand({
          query: current.query,
          aspectId: aspect,
          scopes: [{ kind: 'CORPUS' }, { kind: 'WEB' }],
          k: MAX_ASPECTS,
          lambda: snapshot.lambda,
        });
        const live = scatterOf(snapshot);
        if (
          generation !== expansionGeneration
          || !live
          || snapshot.query !== rootQuery
        ) return;
        const selectedWasExpanded = snapshot.selectedAspect === aspect;
        publish({
          scatter: asyncState.success(
            spliceExpansion(live, aspect, expansion),
          ),
          expanding: null,
          aspectResults: withoutKey(snapshot.aspectResults, aspect),
          selectedAspect: selectedWasExpanded ? null : snapshot.selectedAspect,
          layer: selectedWasExpanded ? 'scatter' : snapshot.layer,
        });
      } catch (error) {
        if (
          generation !== expansionGeneration
          || snapshot.query !== rootQuery
        ) return;
        const message = errorMessage(error);
        publish({ expanding: null, error: message });
      }
    },
    async openNode(node, context) {
      const origin = currentSubgraphRef(snapshot);
      const visited = snapshot.visited.includes(node.id)
        ? snapshot.visited
        : [...snapshot.visited, node.id];
      publish({
        visited,
        docked: true,
        stage: { nodeId: node.id, url: node.url, title: node.title },
        error: null,
      });
      let openPromise: Promise<void>;
      try {
        // Invoke the opener while the browser still owns the click activation.
        // Durable origin persistence may perform network I/O in parallel.
        openPromise = context.open(node.url, node);
      } catch (error) {
        publish({ error: errorMessage(error) });
        return;
      }
      let originPromise: Promise<void> | null = null;
      if (context.sessionId && context.recordOrigin && origin) {
        originPromise = context.recordOrigin(context.sessionId, {
            kind: 'constellation',
            subgraphRef: origin,
            query: snapshot.query,
            nodeId: node.id,
          });
      }
      const [openResult, originResult] = await Promise.allSettled([
        openPromise,
        originPromise ?? Promise.resolve(),
      ]);
      if (openResult.status === 'rejected') {
        publish({ error: errorMessage(openResult.reason) });
        return;
      }
      if (originResult.status === 'rejected') {
        publish({
          error: `Page opened without a durable search origin: ${errorMessage(originResult.reason)}`,
        });
      }
    },
    reopenMap() {
      publish({ docked: false });
    },
    dockMap() {
      publish({ docked: true });
    },
    reset() {
      submitGeneration += 1;
      expansionGeneration += 1;
      snapshot = initialSnapshot(snapshot.lambda);
      for (const listener of listeners) listener();
    },
  };
  return controller;
}

export function scatterOf(
  state: SearchStackSnapshot,
): ScatterResponse | undefined {
  return state.scatter.status === 'success'
    ? state.scatter.data
    : undefined;
}

export function selectedFindOf(
  state: SearchStackSnapshot,
): FindResponse | undefined {
  if (!state.selectedAspect) return undefined;
  const result = state.aspectResults[state.selectedAspect];
  return result?.status === 'success' ? result.data : undefined;
}

export function currentSubgraphRef(
  state: SearchStackSnapshot,
): string | undefined {
  return selectedFindOf(state)?.retrievalRef ?? scatterOf(state)?.scatterRef;
}

export function constellationStateOf(
  state: SearchStackSnapshot,
): ConstellationState {
  if (state.layer === 'aspect' && state.selectedAspect) {
    const result = state.aspectResults[state.selectedAspect];
    if (!result || result.status === 'loading') return { kind: 'loading' };
    if (result.status === 'error') {
      return { kind: 'error', cause: result.message };
    }
    if (result.status === 'empty') {
      return {
        kind: 'empty',
        reason: 'Nothing was admitted for this aspect.',
      };
    }
    return {
      kind: 'success',
      payload: constellationFromFind(result.data),
    };
  }

  if (state.scatter.status === 'loading') return { kind: 'loading' };
  if (state.scatter.status === 'error') {
    return { kind: 'error', cause: state.scatter.message };
  }
  if (state.scatter.status === 'empty') {
    return {
      kind: 'empty',
      reason: state.query
        ? 'No aspect was admitted for this query.'
        : 'Ask a question to scatter it into aspects.',
    };
  }
  return {
    kind: 'success',
    payload: constellationFromScatter(state.scatter.data),
  };
}

export function clampLambda(value: number): number {
  if (!Number.isFinite(value)) return DEFAULT_LAMBDA;
  return Math.min(1, Math.max(0, Math.round(value * 100) / 100));
}

export function spliceExpansion(
  base: ScatterResponse,
  aspect: AspectId,
  expansion: ScatterResponse,
): ScatterResponse {
  const index = base.aspects.findIndex(
    (candidate) => candidate.id === aspect,
  );
  if (index < 0) return base;
  const kept = base.aspects.filter((candidate) => candidate.id !== aspect);
  const room = Math.max(0, MAX_ASPECTS - kept.length);
  const incoming = expansion.aspects
    .filter(
      (candidate) =>
        !kept.some((existing) => existing.id === candidate.id),
    )
    .slice(0, room);
  return {
    ...base,
    aspects: [
      ...base.aspects.slice(0, index),
      ...incoming,
      ...base.aspects.slice(index + 1),
    ],
    lambda: expansion.lambda,
    expandedFrom: aspect,
    scatterRef: expansion.scatterRef,
  };
}

export function aspectQuery(query: string, label: string): string {
  return query ? `${query} ${label}` : label;
}

function initialSnapshot(lambda: number): SearchStackSnapshot {
  return {
    lambda,
    query: '',
    scatter: asyncState.empty(),
    layer: 'scatter',
    selectedAspect: null,
    aspectResults: {},
    expanding: null,
    stage: null,
    visited: [],
    docked: false,
    error: null,
  };
}

function readLambda(
  preferences: SearchPreferenceStore | undefined,
  key: string,
): number {
  const stored = preferences?.read(key);
  return stored == null ? DEFAULT_LAMBDA : clampLambda(Number(stored));
}

function withoutKey<T>(
  record: Readonly<Record<string, T>>,
  key: string,
): Record<string, T> {
  if (!(key in record)) return { ...record };
  const next = { ...record };
  delete next[key];
  return next;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
