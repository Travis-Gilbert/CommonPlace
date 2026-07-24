'use client';

// SOURCING: jotai (client state). The Files projection and Galley tabs share
// one normalized memory set, hydrated by GraphQL and updated by Item deltas.

import { atom, getDefaultStore } from 'jotai';
import type { JsonValue, ObjectRef } from '@commonplace/block-view/types';
import { createAtomStoreFacade } from './store-facade';

export interface HarnessMemoryItem {
  readonly id: string;
  readonly kind: 'memory';
  readonly title: string;
  readonly source: string;
  readonly createdAtMs: number;
  readonly updatedAtMs: number;
  readonly extra: Record<string, JsonValue>;
}

type MemoryProjectionStatus = 'idle' | 'loading' | 'ready' | 'unavailable' | 'refused';

interface MemoryProjectionState {
  readonly tenant: string | null;
  readonly items: readonly HarnessMemoryItem[];
  readonly status: MemoryProjectionStatus;
  readonly error: string | null;
  begin(): void;
  hydrate(tenant: string, items: readonly HarnessMemoryItem[]): void;
  fail(status: Extract<MemoryProjectionStatus, 'unavailable' | 'refused'>, error: string): void;
  apply(delta: HarnessMemoryDelta): void;
}

export interface HarnessMemoryDelta {
  readonly change: 'upserted' | 'deleted';
  readonly id: string;
  readonly tenant: string;
  readonly item?: HarnessMemoryItem;
}

export const memoryTenantAtom = atom<string | null>(null);
export const memoryItemsAtom = atom<readonly HarnessMemoryItem[]>([]);
export const memoryStatusAtom = atom<MemoryProjectionStatus>('idle');
export const memoryErrorAtom = atom<string | null>(null);

const memorySliceAtoms = {
  tenant: memoryTenantAtom,
  items: memoryItemsAtom,
  status: memoryStatusAtom,
  error: memoryErrorAtom,
};

type MemoryProjectionActions = Pick<
  MemoryProjectionState,
  'begin' | 'hydrate' | 'fail' | 'apply'
>;

const memoryStore = getDefaultStore();

const memoryActions: MemoryProjectionActions = {
  begin: () => {
    memoryStore.set(memoryStatusAtom, 'loading');
    memoryStore.set(memoryErrorAtom, null);
  },
  hydrate: (tenant, items) => {
    memoryStore.set(memoryTenantAtom, tenant);
    memoryStore.set(memoryItemsAtom, items);
    memoryStore.set(memoryStatusAtom, 'ready');
    memoryStore.set(memoryErrorAtom, null);
  },
  fail: (status, error) => {
    memoryStore.set(memoryStatusAtom, status);
    memoryStore.set(memoryErrorAtom, error);
    memoryStore.set(memoryItemsAtom, []);
  },
  apply: (delta) => {
    const tenant = memoryStore.get(memoryTenantAtom);
    if (tenant && delta.tenant !== tenant) return;
    if (delta.change === 'deleted') {
      memoryStore.set(memoryItemsAtom, (items) => items.filter((item) => item.id !== delta.id));
      return;
    }
    if (!delta.item || delta.item.kind !== 'memory') return;
    memoryStore.set(memoryItemsAtom, (items) => {
      const index = items.findIndex((item) => item.id === delta.id);
      if (index < 0) return [...items, delta.item!];
      const next = [...items];
      next[index] = delta.item!;
      return next;
    });
  },
};

const { useStore: useMemoryProjectionStore } =
  createAtomStoreFacade<MemoryProjectionState>(memorySliceAtoms, memoryActions);

export { useMemoryProjectionStore };

export function projectionPathOf(item: HarnessMemoryItem): string | null {
  const value = item.extra.projection_path;
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

export function memoryObject(item: HarnessMemoryItem): ObjectRef {
  const markdown = [item.extra.markdown, item.extra.content, item.extra.body, item.extra.text]
    .find((value): value is string => typeof value === 'string') ?? '';
  return {
    id: item.id,
    type: 'memory',
    properties: {
      object_id: item.id,
      title: item.title,
      markdown,
      projection_path: projectionPathOf(item),
      source: item.source,
      updated: item.updatedAtMs,
      read_only_reason: 'MemoryPatch is not available on the connected engine.',
    },
  };
}

export function memoryObjects(): ObjectRef[] {
  return useMemoryProjectionStore.getState().items.map(memoryObject);
}

function errorName(payload: unknown): string {
  if (payload && typeof payload === 'object' && 'error' in payload) return String(payload.error);
  return 'memory_projection_unavailable';
}

/** Shared hydrate for Files and Context. Safe across remounts: concurrent
 *  callers share one in-flight fetch, and ready projections short-circuit. */
let hydrateInFlight: Promise<void> | null = null;

export function ensureMemoryProjection(): Promise<void> {
  const projection = useMemoryProjectionStore.getState();
  if (projection.status === 'ready') return Promise.resolve();
  if (projection.status === 'loading' && hydrateInFlight) return hydrateInFlight;
  if (hydrateInFlight) return hydrateInFlight;

  projection.begin();
  hydrateInFlight = fetch('/api/harness/memory', { cache: 'no-store' })
    .then(async (response) => {
      const payload = (await response.json()) as {
        tenant?: string;
        items?: HarnessMemoryItem[];
        error?: string;
      };
      if (!response.ok || !payload.tenant || !Array.isArray(payload.items)) {
        const refused = response.status === 400 || response.status === 401 || response.status === 403;
        useMemoryProjectionStore.getState().fail(refused ? 'refused' : 'unavailable', errorName(payload));
        return;
      }
      useMemoryProjectionStore.getState().hydrate(payload.tenant, payload.items);
    })
    .catch(() => {
      useMemoryProjectionStore.getState().fail('unavailable', 'harness_graphql_unreachable');
    })
    .finally(() => {
      hydrateInFlight = null;
    });
  return hydrateInFlight;
}
