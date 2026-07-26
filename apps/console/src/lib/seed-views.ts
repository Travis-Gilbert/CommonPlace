// SOURCING: none. Pure logic, no upstream component applies.
// SPEC-COMMONPLACE-CONSOLE-SHELL-1.1 CS8/CS11: five seeded views.
// Seeding is idempotent. A deleted seeded view stays deleted across restart.

import type { JsonValue, ObjectRef } from '@commonplace/block-view/types';
import { CONTAINS_EDGE } from '@commonplace/block-view/surface-tree';
import { readDeletedSeedSlugs } from './surface-object';

export const SEED_VIEW_CHAT = 'chat';
export const SEED_VIEW_RESEARCHER = 'researcher';
export const SEED_VIEW_INDEX = 'index';
export const SEED_VIEW_EDITOR = 'editor';
export const SEED_VIEW_DATA_MODEL = 'data-model';

export const SEED_VIEW_SLUGS = [
  SEED_VIEW_CHAT,
  SEED_VIEW_RESEARCHER,
  SEED_VIEW_INDEX,
  SEED_VIEW_EDITOR,
  SEED_VIEW_DATA_MODEL,
] as const;
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

function agentRail(prefix: string, collapsed: boolean, role: 'surface' | 'companion' = 'companion'): ObjectRef[] {
  return [
    layoutObject(`${prefix}.rail`, 'region', {
      kind: 'tool-window',
      side: 'right',
      material: 'docked',
      title: 'Agent',
      icon: 'rail',
      size: 400,
      open: true,
      collapsed,
      role,
    }, [`${prefix}.rail.vi`]),
    layoutObject(`${prefix}.rail.vi`, 'view-instance', {
      descriptor_id: 'agent.rail',
      title: 'Agent',
      query: { types: ['thread'] } as unknown as JsonValue,
    }),
  ];
}

/** Build the five seeded views. Caller filters deleted slugs. */
export function buildSeedViews(deleted: ReadonlySet<string> = readDeletedSeedSlugs()): ObjectRef[] {
  const out: ObjectRef[] = [];

  if (!deleted.has(SEED_VIEW_CHAT)) {
    out.push(
      layoutObject('view-chat', 'surface', {
        name: 'Chat',
        slug: SEED_VIEW_CHAT,
        kind: 'chat',
        role: 'place',
        stripe_order: 0,
        active: true,
        seeded: true,
        seed_revision: 2,
      }, ['view-chat.well', 'view-chat.rail']),
      layoutObject('view-chat.well', 'region', {
        kind: 'editor',
        material: 'sunken',
        title: 'Well',
        open: true,
        empty_hint: 'Add a block from the sidebar. Sunken blocks land here.',
      }, ['view-chat.well.vi']),
      layoutObject('view-chat.well.vi', 'view-instance', {
        descriptor_id: 'chat.surface',
        title: 'Chat',
        query: { types: ['thread'] } as unknown as JsonValue,
        config: { size: 'full' } as unknown as JsonValue,
      }),
      ...agentRail('view-chat', false, 'surface'),
    );
  }

  if (!deleted.has(SEED_VIEW_RESEARCHER)) {
    out.push(
      layoutObject('view-researcher', 'surface', {
        name: 'Researcher',
        slug: SEED_VIEW_RESEARCHER,
        kind: 'survey',
        role: 'place',
        stripe_order: 1,
        active: false,
        seeded: true,
        seed_revision: 1,
      }, ['view-researcher.well', 'view-researcher.rail']),
      layoutObject('view-researcher.well', 'region', {
        kind: 'editor',
        material: 'sunken',
        title: 'Researcher',
        open: true,
      }, ['view-researcher.well.vi']),
      layoutObject('view-researcher.well.vi', 'view-instance', {
        descriptor_id: 'survey.board',
        title: 'Researcher',
        query: {
          types: ['topic', 'capture', 'survey-edge'],
          live: true,
        } as unknown as JsonValue,
      }),
      ...agentRail('view-researcher', true),
    );
  }

  if (!deleted.has(SEED_VIEW_INDEX)) {
    out.push(
      layoutObject('view-index', 'surface', {
        name: 'Index',
        slug: SEED_VIEW_INDEX,
        kind: 'index',
        role: 'place',
        stripe_order: 2,
        active: false,
        seeded: true,
        seed_revision: 2,
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
      ...agentRail('view-index', true),
    );
  }

  if (!deleted.has(SEED_VIEW_EDITOR)) {
    out.push(
      layoutObject('view-editor', 'surface', {
        name: 'Editor',
        slug: SEED_VIEW_EDITOR,
        kind: 'editor',
        role: 'place',
        stripe_order: 3,
        active: false,
        seeded: true,
        seed_revision: 1,
      }, ['view-editor.well', 'view-editor.rail']),
      layoutObject('view-editor.well', 'region', {
        kind: 'editor',
        material: 'sunken',
        title: 'Editor',
        open: true,
      }, ['view-editor.well.vi']),
      layoutObject('view-editor.well.vi', 'view-instance', {
        descriptor_id: 'workspace.substrate',
        title: 'Editor',
        query: { types: ['surface-tool'] } as unknown as JsonValue,
      }),
      ...agentRail('view-editor', true),
    );
  }

  if (!deleted.has(SEED_VIEW_DATA_MODEL)) {
    out.push(
      layoutObject('view-data-model', 'surface', {
        name: 'Models',
        slug: SEED_VIEW_DATA_MODEL,
        kind: 'model',
        role: 'place',
        stripe_order: 4,
        active: false,
        seeded: true,
        seed_revision: 2,
      }, ['view-data-model.well', 'view-data-model.inspector', 'view-data-model.rail']),
      layoutObject('view-data-model.well', 'region', {
        kind: 'editor',
        material: 'sunken',
        title: 'Models',
        open: true,
      }, ['view-data-model.well.vi']),
      layoutObject('view-data-model.well.vi', 'view-instance', {
        descriptor_id: 'model.studio',
        title: 'Models',
        query: {
          types: [
            'model-scope',
            'object-type-metadata',
            'field-metadata',
            'relation-metadata',
            'view-metadata',
            'schema-version',
          ],
          live: true,
        } as unknown as JsonValue,
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
      ...agentRail('view-data-model', true),
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
