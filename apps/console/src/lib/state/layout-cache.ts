'use client';

// SOURCING: jotai/utils atomWithStorage. Per-route layout cache in front of
// the server truth (B6). Write-through to /objects is not wired yet; this
// module holds the storage atom only.

import { atomWithStorage } from 'jotai/utils';

/** Cached island arrangement keyed by App Router segment. */
export type LayoutCacheEntry = {
  readonly updatedAtMs: number;
  readonly viewInstanceIds: readonly string[];
};

export type LayoutCacheByRoute = Readonly<Record<string, LayoutCacheEntry>>;

const LAYOUT_CACHE_KEY = 'commonplace.console.layout-cache.v1';

export const layoutCacheAtom = atomWithStorage<LayoutCacheByRoute>(LAYOUT_CACHE_KEY, {});
