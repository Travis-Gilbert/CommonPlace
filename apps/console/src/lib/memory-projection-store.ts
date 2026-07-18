'use client';

// SOURCING: zustand (client state). The Files projection and Galley tabs share
// one normalized memory set, hydrated by GraphQL and updated by Item deltas.

import { create } from 'zustand';
import type { JsonValue, ObjectRef } from '@commonplace/block-view/types';

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

export const useMemoryProjectionStore = create<MemoryProjectionState>((set) => ({
  tenant: null,
  items: [],
  status: 'idle',
  error: null,
  begin: () => set({ status: 'loading', error: null }),
  hydrate: (tenant, items) => set({ tenant, items, status: 'ready', error: null }),
  fail: (status, error) => set({ status, error, items: [] }),
  apply: (delta) => set((state) => {
    if (state.tenant && delta.tenant !== state.tenant) return state;
    if (delta.change === 'deleted') {
      return { items: state.items.filter((item) => item.id !== delta.id) };
    }
    if (!delta.item || delta.item.kind !== 'memory') return state;
    const index = state.items.findIndex((item) => item.id === delta.id);
    if (index < 0) return { items: [...state.items, delta.item] };
    const items = [...state.items];
    items[index] = delta.item;
    return { items };
  }),
}));

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
