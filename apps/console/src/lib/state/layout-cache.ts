'use client';

// SOURCING: jotai/utils atomWithStorage. Per-session layout cache in front of
// the server truth (B6). ConsoleBlockHost write-through keeps /objects as
// authority; this atom is the fast path for sync queryLayout and offline degrade.

import { getDefaultStore } from 'jotai';
import { atomWithStorage } from 'jotai/utils';
import type { ObjectRef } from '@commonplace/block-view/types';

/** Full arrangement graph cached for sync shell reads. */
export type LayoutCacheSnapshot = {
  readonly updatedAtMs: number;
  readonly objects: readonly ObjectRef[];
};

const LAYOUT_CACHE_KEY = 'commonplace.console.layout-cache.v1';
/** Legacy key from pre-B6 local-only layout. Migrated once into the atom. */
const LEGACY_SURFACE_KEY = 'commonplace.console.surface.v1';

export const layoutCacheAtom = atomWithStorage<LayoutCacheSnapshot | null>(LAYOUT_CACHE_KEY, null);

const layoutStore = getDefaultStore();

function readLegacySurface(): ObjectRef[] | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(LEGACY_SURFACE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ObjectRef[];
    if (!Array.isArray(parsed) || parsed.length === 0) return null;
    return parsed;
  } catch {
    return null;
  }
}

/** Sync read of the layout cache (seed / hydrate / shell). */
export function readLayoutCache(): readonly ObjectRef[] | null {
  const snapshot = layoutStore.get(layoutCacheAtom);
  if (snapshot?.objects?.length) return snapshot.objects;
  // atomWithStorage may still be on its initial null before the first
  // subscriber hydrates. Read localStorage directly so ConsoleBlockHost can
  // restore the active surface on the first client paint.
  const fromStorage = readLayoutCacheFromLocalStorage();
  if (fromStorage?.objects?.length) {
    layoutStore.set(layoutCacheAtom, fromStorage);
    return fromStorage.objects;
  }
  const legacy = readLegacySurface();
  if (legacy) {
    writeLayoutCache(legacy);
    if (typeof window !== 'undefined') {
      try {
        window.localStorage.removeItem(LEGACY_SURFACE_KEY);
      } catch {
        // Ignore storage failures; the atom already holds the migration.
      }
    }
    return legacy;
  }
  return null;
}

function readLayoutCacheFromLocalStorage(): LayoutCacheSnapshot | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(LAYOUT_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as LayoutCacheSnapshot;
    if (!parsed || !Array.isArray(parsed.objects) || parsed.objects.length === 0) return null;
    return parsed;
  } catch {
    return null;
  }
}

/** Persist the arrangement as the fast path in front of server truth. */
export function writeLayoutCache(objects: readonly ObjectRef[]): void {
  layoutStore.set(layoutCacheAtom, {
    updatedAtMs: Date.now(),
    objects: objects.map((object) => ({
      id: object.id,
      type: object.type,
      properties: { ...object.properties },
      relations: object.relations ? { ...object.relations } : undefined,
      axes: object.axes,
    })),
  });
}

/** Drop the cache (reset to seed). */
export function clearLayoutCache(): void {
  layoutStore.set(layoutCacheAtom, null);
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(LAYOUT_CACHE_KEY);
    window.localStorage.removeItem(LEGACY_SURFACE_KEY);
  } catch {
    // Storage unavailable: in-memory atom clear still applies.
  }
}
