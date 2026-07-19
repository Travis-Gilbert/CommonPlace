// SOURCING: zustand. The server projection is the source of graph state. Live
// overlays are separate ephemeral state, so a why-trace never overwrites an
// editable projection value.

import { create } from 'zustand';
import type { ProactivityGraph } from './types';

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

export const useProactivityStore = create<ProactivityState>((set) => ({
  graph: null,
  status: 'loading',
  error: null,
  highlightedNodeIds: new Set(),
  hydrate: (graph) => set({ graph, status: 'ready', error: null }),
  fail: (error) => set({ graph: null, status: 'unavailable', error }),
  highlight: (nodeIds) => set({ highlightedNodeIds: new Set(nodeIds) }),
  clearHighlight: () => set({ highlightedNodeIds: new Set() }),
}));
