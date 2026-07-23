'use client';

// SOURCING: jotai. The server projection is the source of graph state. Live
// overlays are separate ephemeral state, so a why-trace never overwrites an
// editable projection value.

import { atom, getDefaultStore } from 'jotai';
import type { ProactivityGraph } from '../proactivity/types';
import { createAtomStoreFacade } from './store-facade';

export type ProactivityStatus = 'loading' | 'ready' | 'unavailable';

interface ProactivityState {
  readonly graph: ProactivityGraph | null;
  readonly status: ProactivityStatus;
  readonly error: string | null;
  readonly highlightedNodeIds: ReadonlySet<string>;
  hydrate(graph: ProactivityGraph): void;
  fail(error: string): void;
  highlight(nodeIds: Iterable<string>): void;
  clearHighlight(): void;
}

export const proactivityGraphAtom = atom<ProactivityGraph | null>(null);
export const proactivityStatusAtom = atom<ProactivityStatus>('loading');
export const proactivityErrorAtom = atom<string | null>(null);
export const proactivityHighlightedNodeIdsAtom = atom<ReadonlySet<string>>(new Set<string>());

const proactivitySliceAtoms = {
  graph: proactivityGraphAtom,
  status: proactivityStatusAtom,
  error: proactivityErrorAtom,
  highlightedNodeIds: proactivityHighlightedNodeIdsAtom,
};

type ProactivityActions = Pick<
  ProactivityState,
  'hydrate' | 'fail' | 'highlight' | 'clearHighlight'
>;

const proactivityStore = getDefaultStore();

const proactivityActions: ProactivityActions = {
  hydrate: (graph) => {
    proactivityStore.set(proactivityGraphAtom, graph);
    proactivityStore.set(proactivityStatusAtom, 'ready');
    proactivityStore.set(proactivityErrorAtom, null);
  },
  fail: (error) => {
    proactivityStore.set(proactivityGraphAtom, null);
    proactivityStore.set(proactivityStatusAtom, 'unavailable');
    proactivityStore.set(proactivityErrorAtom, error);
  },
  highlight: (nodeIds) => proactivityStore.set(proactivityHighlightedNodeIdsAtom, new Set(nodeIds)),
  clearHighlight: () => proactivityStore.set(proactivityHighlightedNodeIdsAtom, new Set()),
};

const { useStore: useProactivityStore } =
  createAtomStoreFacade<ProactivityState>(proactivitySliceAtoms, proactivityActions);

export { useProactivityStore };
