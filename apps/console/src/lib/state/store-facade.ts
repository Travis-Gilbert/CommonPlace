'use client';

// SOURCING: jotai (client state). Shared zustand-compatible facade over the
// default Jotai store so migrated callers keep selector hooks, getState,
// setState, and subscribe without a Provider.

import { atom, getDefaultStore, type Atom, type WritableAtom } from 'jotai';
import { useSyncExternalStore } from 'react';

type SliceAtoms = Record<string, Atom<unknown> | WritableAtom<unknown, unknown[], unknown>>;

export interface AtomStoreFacade<TState extends object> {
  readonly useStore: {
    <U>(selector: (state: TState) => U): U;
    getState: () => TState;
    setState: (partial: Partial<TState>) => void;
    subscribe: (listener: (state: TState, prevState: TState) => void) => () => void;
  };
  readonly stateAtom: Atom<TState>;
  readonly store: ReturnType<typeof getDefaultStore>;
  readonly sliceAtoms: SliceAtoms;
}

export function createAtomStoreFacade<TState extends object>(
  sliceAtoms: SliceAtoms,
  actions: Partial<TState>,
): AtomStoreFacade<TState> {
  const store = getDefaultStore();
  const stateAtom = atom((get) => {
    const slices: Record<string, unknown> = {};
    for (const [key, sliceAtom] of Object.entries(sliceAtoms)) {
      slices[key] = get(sliceAtom);
    }
    return { ...slices, ...actions } as TState;
  });

  const getState = (): TState => store.get(stateAtom);

  const setState = (partial: Partial<TState>): void => {
    for (const [key, value] of Object.entries(partial)) {
      const sliceAtom = sliceAtoms[key];
      if (sliceAtom) store.set(sliceAtom as WritableAtom<unknown, [unknown], unknown>, value);
    }
  };

  const subscribeAll = (listener: () => void): (() => void) => {
    return store.sub(stateAtom, listener);
  };

  function useStore<U>(selector: (state: TState) => U): U {
    return useSyncExternalStore(
      subscribeAll,
      () => selector(getState()),
      () => selector(getState()),
    );
  }

  useStore.getState = getState;
  useStore.setState = setState;
  useStore.subscribe = (listener: (state: TState, prevState: TState) => void) => {
    let prev = getState();
    return store.sub(stateAtom, () => {
      const next = getState();
      listener(next, prev);
      prev = next;
    });
  };

  return { useStore, stateAtom, store, sliceAtoms };
}
