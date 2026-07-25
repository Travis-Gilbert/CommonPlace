// SOURCING: none. Pure logic, no upstream component applies.
// SPEC-COMMONPLACE-CONSOLE-SHELL-1.0 CS6: views are durable surface objects
// with URLs. Dirty edits live in session state. Save writes a surface and routes.

import type { JsonValue, ObjectRef, UpsertRegionInput } from '@commonplace/block-view/types';
import { upsertCompleteViewAction } from '@commonplace/block-view/surface-actions';
import type { ConsoleBlockHost } from './console-host';

export const VIEW_STORAGE_DIRTY_KEY = 'commonplace.console.view-dirty.v1';
export const DELETED_SEED_VIEWS_KEY = 'commonplace.console.deleted-seed-views.v1';

export interface SurfaceViewSummary {
  readonly id: string;
  readonly slug: string;
  readonly name: string;
  readonly seeded: boolean;
  readonly order: number;
}

export function viewPath(slugOrId: string): string {
  return `/v/${encodeURIComponent(slugOrId)}`;
}

export function slugOf(surface: ObjectRef): string {
  const slug = surface.properties.slug;
  if (typeof slug === 'string' && slug.length > 0) return slug;
  return surface.id.replace(/^console-/, '').replace(/^view-/, '');
}

export function listSavedViews(host: ConsoleBlockHost): readonly SurfaceViewSummary[] {
  const set = host.queryLayout({
    types: ['surface'],
    live: true,
  });
  return set.objects
    .filter((object) => object.type === 'surface')
    .map((surface, index) => ({
      id: surface.id,
      slug: slugOf(surface),
      name: String(surface.properties.name ?? surface.id),
      seeded: surface.properties.seeded === true,
      order: typeof surface.properties.stripe_order === 'number'
        ? Number(surface.properties.stripe_order)
        : index,
    }))
    .sort((a, b) => a.order - b.order);
}

export function findViewByIdOrSlug(host: ConsoleBlockHost, viewId: string): ObjectRef | null {
  const set = host.queryLayout({ types: ['surface'], live: true });
  const decoded = decodeURIComponent(viewId);
  return set.objects.find((surface) => surface.id === decoded || slugOf(surface) === decoded) ?? null;
}

export function readDirtyViewId(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.sessionStorage.getItem(VIEW_STORAGE_DIRTY_KEY);
  } catch {
    return null;
  }
}

export function markViewDirty(viewId: string): void {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.setItem(VIEW_STORAGE_DIRTY_KEY, viewId);
  } catch {
    // Session storage can be unavailable; dirty is best-effort.
  }
}

export function clearViewDirty(): void {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.removeItem(VIEW_STORAGE_DIRTY_KEY);
  } catch {
    // ignore
  }
}

export function readDeletedSeedSlugs(): ReadonlySet<string> {
  if (typeof window === 'undefined') return new Set();
  try {
    const raw = window.localStorage.getItem(DELETED_SEED_VIEWS_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return new Set();
    return new Set(parsed.filter((item): item is string => typeof item === 'string'));
  } catch {
    return new Set();
  }
}

export function rememberDeletedSeedSlug(slug: string): void {
  if (typeof window === 'undefined') return;
  const next = new Set(readDeletedSeedSlugs());
  next.add(slug);
  try {
    window.localStorage.setItem(DELETED_SEED_VIEWS_KEY, JSON.stringify([...next]));
  } catch {
    // ignore
  }
}

export async function saveView(
  host: ConsoleBlockHost,
  viewId: string,
  regions?: readonly UpsertRegionInput[],
  props?: Readonly<Record<string, JsonValue>>,
): Promise<{ ok: boolean; error?: string }> {
  const result = await host.emit(
    upsertCompleteViewAction({
      id: viewId,
      props,
      regions,
    }),
  );
  if (!result.ok) return { ok: false, error: result.error };
  clearViewDirty();
  return { ok: true };
}

/** Leave-path autosave: persist the active view and clear dirty without a prompt. */
export async function autosaveViewOnLeave(
  host: ConsoleBlockHost,
  viewId: string,
): Promise<{ ok: boolean; error?: string }> {
  return saveView(host, viewId);
}

export async function saveViewAs(
  host: ConsoleBlockHost,
  sourceId: string,
  newId: string,
  name: string,
  regions: readonly UpsertRegionInput[],
): Promise<{ ok: boolean; error?: string; id?: string }> {
  const created = await host.emit({
    kind: 'create',
    type: 'surface',
    props: {
      id: newId,
      name,
      slug: newId.replace(/^view-/, ''),
      kind: 'custom',
      active: false,
      seeded: false,
    },
  });
  if (!created.ok) return { ok: false, error: created.error };
  const upsert = await host.emit(
    upsertCompleteViewAction({
      id: newId,
      props: { name, slug: newId.replace(/^view-/, ''), kind: 'custom', seeded: false },
      regions,
    }),
  );
  if (!upsert.ok) return { ok: false, error: upsert.error };
  clearViewDirty();
  void sourceId;
  return { ok: true, id: newId };
}
