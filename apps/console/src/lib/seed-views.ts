// SOURCING: none. Pure logic, no upstream component applies.
// SPEC-COMMONPLACE-CONSOLE-SHELL-1.0 CS8: three seeded views, nothing else.
// Seeding is idempotent. A deleted seeded view stays deleted across restart.

import type { JsonValue, ObjectRef } from '@commonplace/block-view/types';
import { CONTAINS_EDGE } from '@commonplace/block-view/surface-tree';
import { readDeletedSeedSlugs } from './surface-object';

export const SEED_VIEW_CHAT = 'chat';
export const SEED_VIEW_INDEX = 'index';
export const SEED_VIEW_DATA_MODEL = 'data-model';

export const SEED_VIEW_SLUGS = [SEED_VIEW_CHAT, SEED_VIEW_INDEX, SEED_VIEW_DATA_MODEL] as const;
export type SeedViewSlug = (typeof SEED_VIEW_SLUGS)[number];

function layoutObject(
  id: string,
  type: string,
  properties: Record<string, JsonValue>,
  children?: readonly string[],
): ObjectRef {
  return {
    id,
    type,
    properties,
    relations: children ? { [CONTAINS_EDGE]: children } : undefined,
  };
}

/** Build the three seeded views. Caller filters deleted slugs. */
export function buildSeedViews(deleted: ReadonlySet<string> = readDeletedSeedSlugs()): ObjectRef[] {
  const out: ObjectRef[] = [];

  if (!deleted.has(SEED_VIEW_CHAT)) {
    out.push(
      layoutObject('view-chat', 'surface', {
        name: 'Chat',
        slug: SEED_VIEW_CHAT,
        kind: 'chat',
        role: 'surface',
        stripe_order: 0,
        active: true,
        seeded: true,
        seed_revision: 1,
      }, ['view-chat.well', 'view-chat.rail']),
      layoutObject('view-chat.well', 'region', {
        kind: 'editor',
        material: 'sunken',
        title: 'Well',
        open: true,
        empty_hint: 'Add a block from the sidebar. Sunken blocks land here.',
      }, []),
      layoutObject('view-chat.rail', 'region', {
        kind: 'tool-window',
        side: 'right',
        material: 'docked',
        title: 'Agent',
        icon: 'rail',
        size: 400,
        open: true,
        collapsed: false,
        role: 'surface',
      }, ['view-chat.rail.vi']),
      layoutObject('view-chat.rail.vi', 'view-instance', {
        descriptor_id: 'agent.rail',
        title: 'Agent',
        query: { types: ['thread'] } as unknown as JsonValue,
      }),
    );
  }

  if (!deleted.has(SEED_VIEW_INDEX)) {
    out.push(
      layoutObject('view-index', 'surface', {
        name: 'Index',
        slug: SEED_VIEW_INDEX,
        kind: 'index',
        role: 'surface',
        stripe_order: 1,
        active: false,
        seeded: true,
        seed_revision: 1,
      }, ['view-index.well', 'view-index.rail']),
      layoutObject('view-index.well', 'region', {
        kind: 'editor',
        material: 'sunken',
        title: 'Index',
        open: true,
      }, ['view-index.well.vi']),
      layoutObject('view-index.well.vi', 'view-instance', {
        descriptor_id: 'record.table',
        title: 'Index',
        query: { types: ['record'], live: true } as unknown as JsonValue,
      }),
      layoutObject('view-index.rail', 'region', {
        kind: 'tool-window',
        side: 'right',
        material: 'docked',
        title: 'Agent',
        icon: 'rail',
        size: 400,
        open: true,
        collapsed: true,
        role: 'companion',
      }, ['view-index.rail.vi']),
      layoutObject('view-index.rail.vi', 'view-instance', {
        descriptor_id: 'agent.rail',
        title: 'Agent',
        query: { types: ['thread'] } as unknown as JsonValue,
      }),
    );
  }

  if (!deleted.has(SEED_VIEW_DATA_MODEL)) {
    out.push(
      layoutObject('view-data-model', 'surface', {
        name: 'Data model',
        slug: SEED_VIEW_DATA_MODEL,
        kind: 'model',
        role: 'surface',
        stripe_order: 2,
        active: false,
        seeded: true,
        seed_revision: 1,
      }, ['view-data-model.well', 'view-data-model.inspector', 'view-data-model.rail']),
      layoutObject('view-data-model.well', 'region', {
        kind: 'editor',
        material: 'sunken',
        title: 'Data model',
        open: true,
      }, ['view-data-model.well.vi']),
      layoutObject('view-data-model.well.vi', 'view-instance', {
        descriptor_id: 'index.rail',
        title: 'Data model',
        query: { types: ['index-rail'] } as unknown as JsonValue,
      }),
      layoutObject('view-data-model.inspector', 'region', {
        kind: 'tool-window',
        side: 'left',
        material: 'sunken',
        title: 'Inspector',
        icon: 'records',
        size: 28,
        open: true,
        role: 'surface',
      }, ['view-data-model.inspector.vi']),
      layoutObject('view-data-model.inspector.vi', 'view-instance', {
        descriptor_id: 'record.table',
        title: 'Inspector',
        query: { types: ['record'], live: true } as unknown as JsonValue,
      }),
      layoutObject('view-data-model.rail', 'region', {
        kind: 'tool-window',
        side: 'right',
        material: 'docked',
        title: 'Agent',
        icon: 'rail',
        size: 400,
        open: true,
        collapsed: true,
        role: 'companion',
      }, ['view-data-model.rail.vi']),
      layoutObject('view-data-model.rail.vi', 'view-instance', {
        descriptor_id: 'agent.rail',
        title: 'Agent',
        query: { types: ['thread'] } as unknown as JsonValue,
      }),
    );
  }

  return out;
}

/** Merge seed views into an existing layout without resurrecting deleted seeds. */
export function mergeSeedViews(existing: readonly ObjectRef[]): ObjectRef[] {
  const deleted = readDeletedSeedSlugs();
  const byId = new Map(existing.map((object) => [object.id, object]));
  const seeds = buildSeedViews(deleted);
  for (const seed of seeds) {
    if (!byId.has(seed.id)) byId.set(seed.id, seed);
  }
  return [...byId.values()];
}
