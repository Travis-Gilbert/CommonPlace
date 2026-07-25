'use client';

// SOURCING: jotai/utils atomFamily. Per view-instance block state keyed by the
// block-view view-instance id. Layout wiring consumes this in B6/B10.

import { atom } from 'jotai';
import { atomFamily } from 'jotai/utils';

export interface ViewInstanceBlockState {
  readonly scrollTop: number;
  readonly collapsed: boolean;
  readonly lastFocusedAtMs: number | null;
}

const DEFAULT_VIEW_INSTANCE_STATE: ViewInstanceBlockState = {
  scrollTop: 0,
  collapsed: false,
  lastFocusedAtMs: null,
};

export const viewInstanceStateFamily = atomFamily((viewInstanceId: string) =>
  atom<ViewInstanceBlockState>({ ...DEFAULT_VIEW_INSTANCE_STATE, lastFocusedAtMs: null }),
);

export function resetViewInstanceStateFamily(): void {
  viewInstanceStateFamily.setShouldRemove(() => true);
}
