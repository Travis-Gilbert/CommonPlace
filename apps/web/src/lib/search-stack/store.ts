// SOURCING: zustand (+ zustand/middleware persist) -- session store and the per-user lambda.

/**
 * The search stack's session store (SPEC F2, F3, F5, HANDOFF D4).
 *
 * The constellation is a breadcrumb, not a view: opening an aspect list, then a
 * page, then coming back must find the same graph. That is why this state lives
 * in a zustand store outside the React tree instead of in a component. Nothing
 * unmounts it.
 *
 * Three rules the shape encodes:
 *
 * 1. ONE BACKEND REQUEST PER ASPECT SELECTION. `aspectResults` is a cache keyed
 *    by aspect id. `selectAspect` issues a request only when that key is empty,
 *    and both the layer-two scene and the F5 list read the same cached
 *    `FindResponse`. Reselecting a visited aspect issues nothing.
 * 2. EXPAND REPLACES ONLY THE EXPANDED REGION. `expandAspect` splices the
 *    returned aspects in place of the one that was expanded and leaves every
 *    other `AspectNode` reference-identical, so the renderer's layout pins the
 *    untouched nodes and re-solves only the new ones.
 * 3. LAMBDA IS THE PERSON'S, NOT THE SESSION'S. The persist middleware writes
 *    only `lambda` to localStorage, so the dial survives an app restart while
 *    results, selections and visit history do not.
 */

import { create, type StoreApi, type UseBoundStore } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import {
  MAX_ASPECTS,
  type AspectId,
  type ConstellationNode,
  type FindResponse,
  type ScatterResponse,
} from '@commonplace/block-view-contracts/search-stack';
import { viewState, type ViewState } from '@/lib/commonplace-view-state';
import { setBundleOrigin } from '@/lib/carry/bundle-store';
import { runExpand, runFind, runScatter } from './client';
import { constellationFromFind, constellationFromScatter } from './constellation-projection';

/** Convergence at rest: enough spread to separate aspects, enough to stay legible. */
export const DEFAULT_LAMBDA = 0.5;
/** Result budget for an aspect's find. */
export const ASPECT_RESULT_K = 20;

export const LAMBDA_STORAGE_KEY = 'commonplace-search-stack';

/** Where the person is in the two-layer surface. */
export type SerpLayer = 'scatter' | 'aspect';

export interface StagePage {
  readonly nodeId: string;
  readonly url: string;
  readonly title: string;
}

/** What the stage needs to actually open a page, injected by the host surface. */
export interface OpenNodeContext {
  /** The co-browse session the opening belongs to, for the bundle origin. */
  readonly sessionId: string | null;
  /** Real navigation into the co-browse stage. Throwing is surfaced, not swallowed. */
  readonly open: (url: string, node: ConstellationNode) => Promise<void>;
}

export interface SearchStackState {
  // F3
  lambda: number;
  setLambda: (lambda: number) => void;

  // F2 layer one
  query: string;
  scatter: ViewState<ScatterResponse>;
  submit: (query: string) => Promise<void>;

  // F2 layer two plus F5
  layer: SerpLayer;
  selectedAspect: AspectId | null;
  aspectResults: Record<AspectId, ViewState<FindResponse>>;
  selectAspect: (aspect: AspectId) => Promise<void>;
  backToScatter: () => void;

  expanding: AspectId | null;
  expandAspect: (aspect: AspectId) => Promise<void>;

  // D4
  stage: StagePage | null;
  visited: string[];
  docked: boolean;
  openNode: (node: ConstellationNode, context: OpenNodeContext) => Promise<void>;
  /** Reopen the docked map full size. The session and its history continue. */
  reopenMap: () => void;
  dockMap: () => void;

  error: string | null;
  reset: () => void;
}

type SearchStackStore = UseBoundStore<StoreApi<SearchStackState>>;

/**
 * Build a store instance. The app uses the singleton below; tests build their
 * own so one test's constellation cannot leak into the next.
 */
export function createSearchStackStore(storageKey = LAMBDA_STORAGE_KEY): SearchStackStore {
  return create<SearchStackState>()(
    persist(
      (set, get) => ({
        lambda: DEFAULT_LAMBDA,
        setLambda: (lambda) => set({ lambda: clampLambda(lambda) }),

        query: '',
        scatter: viewState.empty(),

        async submit(query) {
          const trimmed = query.trim();
          if (!trimmed) return;
          // A new question is a new constellation: the old aspect cache and the
          // old visit history belong to a question nobody is asking any more.
          set({
            query: trimmed,
            scatter: viewState.loading(),
            layer: 'scatter',
            selectedAspect: null,
            aspectResults: {},
            stage: null,
            visited: [],
            docked: false,
            error: null,
          });
          try {
            const response = await runScatter({
              query: trimmed,
              k: MAX_ASPECTS,
              lambda: get().lambda,
            });
            // A later submit may have superseded this one while it was in flight.
            if (get().query !== trimmed) return;
            set({
              scatter:
                response.aspects.length > 0 ? viewState.success(response) : viewState.empty(),
            });
          } catch (cause) {
            if (get().query !== trimmed) return;
            set({ scatter: viewState.error(String(cause)), error: String(cause) });
          }
        },

        layer: 'scatter',
        selectedAspect: null,
        aspectResults: {},

        async selectAspect(aspect) {
          const state = get();
          const known = state.aspectResults[aspect];
          // Layer two opens immediately either way; the request is what is
          // conditional. This is the single-request contract: a cached aspect
          // renders both its scene and its list with no retrieval at all.
          set({ layer: 'aspect', selectedAspect: aspect });
          if (known && known.status !== 'error') return;

          const node = aspectNode(state.scatter, aspect);
          if (!node) return;
          const query = aspectQuery(state.query, node.label);
          set({ aspectResults: { ...get().aspectResults, [aspect]: viewState.loading() } });
          try {
            const response = await runFind({
              query,
              scopes: [{ kind: 'corpus' }, { kind: 'web' }],
              lanes: ['exact', 'lexical', 'semantic', 'structural'],
              k: ASPECT_RESULT_K,
              lambda: state.lambda,
            });
            set({
              aspectResults: {
                ...get().aspectResults,
                [aspect]:
                  response.results.length > 0 ? viewState.success(response) : viewState.empty(),
              },
            });
          } catch (cause) {
            set({
              aspectResults: {
                ...get().aspectResults,
                [aspect]: viewState.error(String(cause)),
              },
              error: String(cause),
            });
          }
        },

        backToScatter: () => set({ layer: 'scatter', selectedAspect: null }),

        expanding: null,

        async expandAspect(aspect) {
          const state = get();
          const current = state.scatter;
          if (current.status !== 'success' && current.status !== 'partial') return;
          const response = current.data;
          set({ expanding: aspect, error: null });
          try {
            const expansion = await runExpand({
              retrievalRef: response.retrievalRef,
              aspect,
              k: MAX_ASPECTS,
              lambda: state.lambda,
            });
            const next = get().scatter;
            if (next.status !== 'success' && next.status !== 'partial') return;
            set({
              scatter: viewState.success(spliceExpansion(next.data, aspect, expansion)),
              expanding: null,
              // The expanded aspect's cached list was seeded by an aspect that
              // no longer exists, so it is dropped rather than left stale.
              aspectResults: withoutKey(get().aspectResults, aspect),
              selectedAspect: get().selectedAspect === aspect ? null : get().selectedAspect,
              layer: get().selectedAspect === aspect ? 'scatter' : get().layer,
            });
          } catch (cause) {
            set({ expanding: null, error: String(cause) });
          }
        },

        stage: null,
        visited: [],
        docked: false,

        async openNode(node, context) {
          const state = get();
          // Visit history is a set in list clothing: the docked map marks a node
          // visited once, however many times it is opened.
          const visited = state.visited.includes(node.id)
            ? state.visited
            : [...state.visited, node.id];
          set({
            visited,
            docked: true,
            stage: { nodeId: node.id, url: node.url, title: node.title },
            error: null,
          });

          const origin = currentSubgraphRef(state);
          if (context.sessionId && origin) {
            await setBundleOrigin(context.sessionId, {
              kind: 'constellation',
              subgraphRef: origin,
              query: state.query,
              nodeId: node.id,
            }).catch(() => undefined);
          }

          try {
            await context.open(node.url, node);
          } catch (cause) {
            set({ error: String(cause) });
          }
        },

        reopenMap: () => set({ docked: false }),
        dockMap: () => set({ docked: true }),

        error: null,

        reset: () =>
          set({
            query: '',
            scatter: viewState.empty(),
            layer: 'scatter',
            selectedAspect: null,
            aspectResults: {},
            expanding: null,
            stage: null,
            visited: [],
            docked: false,
            error: null,
          }),
      }),
      {
        name: storageKey,
        storage: createJSONStorage(() => localStorage),
        // Only the dial is the person's. Results are the session's and are not
        // written to disk, so a restart never resurrects a stale constellation.
        partialize: (state) => ({ lambda: state.lambda }),
      },
    ),
  );
}

export const useSearchStack = createSearchStackStore();

// ---------------------------------------------------------------------------
// Selectors: pure, so the surfaces and the tests read the same derivations.
// ---------------------------------------------------------------------------

/** The scatter response the surface currently holds, if any. */
export function scatterOf(state: SearchStackState): ScatterResponse | undefined {
  return state.scatter.status === 'success' || state.scatter.status === 'partial'
    ? state.scatter.data
    : undefined;
}

/** The selected aspect's find response, if it has arrived. */
export function selectedFindOf(state: SearchStackState): FindResponse | undefined {
  const aspect = state.selectedAspect;
  if (!aspect) return undefined;
  const entry = state.aspectResults[aspect];
  if (!entry) return undefined;
  return entry.status === 'success' || entry.status === 'partial' ? entry.data : undefined;
}

/**
 * The subgraph reference the current view stands on: the aspect's retrieval
 * when one is open, the scatter's otherwise. This is what D4 records as the
 * session's origin.
 */
export function currentSubgraphRef(state: SearchStackState): string | undefined {
  return selectedFindOf(state)?.retrievalRef ?? scatterOf(state)?.retrievalRef;
}

/**
 * The constellation state the renderer draws, for whichever layer is open. Both
 * layers project from responses the store already holds, so switching layers
 * and toggling the plain list never reach the network.
 */
export function constellationStateOf(state: SearchStackState) {
  if (state.layer === 'aspect' && state.selectedAspect) {
    const entry = state.aspectResults[state.selectedAspect];
    if (!entry || entry.status === 'loading') return { kind: 'loading' as const };
    if (entry.status === 'error') return { kind: 'error' as const, cause: entry.message };
    if (entry.status === 'empty') {
      return {
        kind: 'empty' as const,
        reason: 'Nothing was admitted for this aspect.',
      };
    }
    return { kind: 'success' as const, payload: constellationFromFind(entry.data) };
  }

  const scatter = state.scatter;
  if (scatter.status === 'loading') return { kind: 'loading' as const };
  if (scatter.status === 'error') return { kind: 'error' as const, cause: scatter.message };
  if (scatter.status === 'empty') {
    return {
      kind: 'empty' as const,
      reason: state.query
        ? 'No aspect was admitted for this query.'
        : 'Ask a question to scatter it into aspects.',
    };
  }
  return { kind: 'success' as const, payload: constellationFromScatter(scatter.data) };
}

// ---------------------------------------------------------------------------
// Pure helpers
// ---------------------------------------------------------------------------

export function clampLambda(value: number): number {
  if (!Number.isFinite(value)) return DEFAULT_LAMBDA;
  return Math.min(1, Math.max(0, Math.round(value * 100) / 100));
}

/**
 * Replace one aspect with the aspects the expansion returned, leaving every
 * other aspect reference-identical. When the expansion would push the scene
 * past `MAX_ASPECTS`, the EXPANSION is trimmed, never the untouched region:
 * the gesture expands one node, it does not evict its neighbours.
 */
export function spliceExpansion(
  base: ScatterResponse,
  aspect: AspectId,
  expansion: ScatterResponse,
): ScatterResponse {
  const index = base.aspects.findIndex((candidate) => candidate.id === aspect);
  if (index < 0) return base;

  const kept = base.aspects.filter((candidate) => candidate.id !== aspect);
  const room = Math.max(0, MAX_ASPECTS - kept.length);
  const incoming = expansion.aspects
    .filter((candidate) => !kept.some((existing) => existing.id === candidate.id))
    .slice(0, room);

  const aspects = [...base.aspects.slice(0, index), ...incoming, ...base.aspects.slice(index + 1)];
  return {
    ...base,
    aspects,
    lambda: expansion.lambda,
    expandedFrom: aspect,
    retrievalRef: expansion.retrievalRef,
  };
}

/** The aspect query: the question plus the aspect that narrowed it. */
export function aspectQuery(query: string, label: string): string {
  return query ? `${query} ${label}` : label;
}

function aspectNode(scatter: ViewState<ScatterResponse>, aspect: AspectId) {
  if (scatter.status !== 'success' && scatter.status !== 'partial') return undefined;
  return scatter.data.aspects.find((candidate) => candidate.id === aspect);
}

function withoutKey<T>(record: Record<string, T>, key: string): Record<string, T> {
  if (!(key in record)) return record;
  const next = { ...record };
  delete next[key];
  return next;
}
