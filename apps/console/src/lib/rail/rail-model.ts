// SOURCING: none. Pure logic, no upstream component applies.
// SPEC-COMMONPLACE-CONSOLE-SHELL-1.1 CS11: launch rail is five destinations.
// PLACE_ENTRIES drives rail rows, Cmd/Ctrl digit bindings, Alt digit bindings,
// and route prefetch. Collections leave the rail; they stay reachable through
// the layout switcher and the Blocks palette.
//
// Rail targets the rich workspace-seed places (companions, multi-region
// wells), not the sparse CS8 seed-view shells. Seed views remain for /v/*
// idempotent seeding and list membership.

import type {
  BlockKindGlyph,
  ObjectQuery,
  ViewDescriptor,
} from '@commonplace/block-view/types';
import { KIND_GLYPH_ORDER } from '@/lib/material/kind-hues';

export type RailTier = 'place' | 'collection' | 'pin';

export type BlockPaletteMaterial = 'sunken' | 'lifted' | 'docked';

export interface BlockPaletteItem {
  readonly id: string;
  readonly label: string;
  readonly kind: string;
  readonly descriptorId: string;
  readonly material: BlockPaletteMaterial;
  readonly query?: ObjectQuery;
}

export interface ConsoleViewDescriptor extends ViewDescriptor {
  /**
   * Opts this descriptor into the Blocks group. Places and Collections remain
   * separate navigation concepts and do not imply palette membership.
   */
  readonly paletteVisible?: boolean;
  readonly palette?: {
    readonly id?: string;
    readonly label?: string;
    readonly kind?: string;
    readonly material?: BlockPaletteMaterial;
    /** Data contract for query-backed views. Omit when the renderer owns data. */
    readonly query?: ObjectQuery;
  };
}

/**
 * CN2: derive one Blocks row per opted-in descriptor. The registry is the
 * membership source; optional palette metadata only controls presentation.
 */
export function deriveBlockPaletteItems(
  descriptors: readonly ConsoleViewDescriptor[],
): readonly BlockPaletteItem[] {
  return descriptors
    .filter((descriptor) => descriptor.paletteVisible === true)
    .map((descriptor) => ({
      id: descriptor.palette?.id ?? descriptor.id,
      label: descriptor.palette?.label ?? descriptor.name,
      kind: descriptor.palette?.kind ?? descriptor.block?.kindGlyph ?? descriptor.id,
      descriptorId: descriptor.id,
      material: descriptor.palette?.material ?? 'sunken',
      ...(descriptor.palette?.query
        ? { query: descriptor.palette.query }
        : {}),
    }));
}

export interface RailPlace {
  readonly tier: 'place';
  readonly id: string;
  readonly kind: string;
  readonly label: string;
  readonly path: string;
  readonly surfaceId: string;
  readonly stripeOrder: number;
}

export interface RailCollection {
  readonly tier: 'collection';
  readonly kindGlyph: BlockKindGlyph;
  readonly label: string;
  readonly path: string;
  readonly surfaceId: string;
  readonly kind: string;
}

/**
 * Per-kind rail policy. `hidden` means the kind never becomes a collection
 * entry (place-owned glyphs, chrome glyphs, or dock-only affordances).
 * CS11: collections leave the rail; policy stays so layout switcher routes
 * and SURFACE_ROUTES still resolve. `deriveRailCollections` returns empty for
 * the rail; use `deriveLayoutCollections` for switcher/route membership.
 */
export type KindRailPolicy =
  | { readonly rail: 'hidden'; reason: string }
  | {
      readonly rail: 'collection';
      readonly label: string;
      readonly path: string;
      readonly surfaceId: string;
      readonly kind: string;
    };

/**
 * Launch set: Chat, Researcher, Index, Editor, Models.
 * Digits one through five. Surfaces are the durable IA places so the rail
 * opens companions and multi-region wells, not a single full-bleed panel.
 */
export const PLACE_ENTRIES: readonly RailPlace[] = [
  {
    tier: 'place',
    id: 'place-chat',
    kind: 'chat',
    label: 'Chat',
    path: '/chat',
    surfaceId: 'console-chat',
    stripeOrder: 0,
  },
  {
    tier: 'place',
    id: 'place-researcher',
    kind: 'survey',
    label: 'Researcher',
    path: '/indexer',
    surfaceId: 'console-survey',
    stripeOrder: 1,
  },
  {
    tier: 'place',
    id: 'place-index',
    kind: 'index',
    label: 'Index',
    path: '/filing',
    surfaceId: 'console-index',
    stripeOrder: 2,
  },
  {
    tier: 'place',
    id: 'place-editor',
    kind: 'workspace',
    label: 'Editor',
    path: '/workspace',
    surfaceId: 'console-workspace',
    stripeOrder: 3,
  },
  {
    tier: 'place',
    id: 'place-models',
    kind: 'model',
    label: 'Models',
    path: '/models',
    surfaceId: 'console-models',
    stripeOrder: 4,
  },
] as const;

/** Kind → collection policy. Collections leave the rail (CS11) but keep routes. */
export const KIND_RAIL_POLICY: Record<BlockKindGlyph, KindRailPolicy> = {
  records: {
    rail: 'collection',
    label: 'Records',
    path: '/records',
    surfaceId: 'console-records',
    kind: 'records',
  },
  cards: {
    rail: 'collection',
    label: 'Cards',
    path: '/cards',
    surfaceId: 'console-cards',
    kind: 'cards',
  },
  thread: {
    rail: 'collection',
    label: 'Threads',
    path: '/threads',
    surfaceId: 'console-threads',
    kind: 'threads',
  },
  doc: {
    rail: 'collection',
    label: 'Documents',
    path: '/documents',
    surfaceId: 'console-docs',
    kind: 'documents',
  },
  files: {
    rail: 'collection',
    label: 'Files',
    path: '/files',
    surfaceId: 'console-files',
    kind: 'files',
  },
  memory: { rail: 'hidden', reason: 'memory surfaces through Files projection, not a parallel collection' },
  rail: { rail: 'hidden', reason: 'chrome glyph for Index destinations, not a graph kind collection' },
  workspace: { rail: 'hidden', reason: 'Editor is the launch View for the workspace place' },
  model: { rail: 'hidden', reason: 'Models is a launch View' },
  context: { rail: 'hidden', reason: 'dock companion, not a rail destination' },
  terminal: { rail: 'hidden', reason: 'tool window affordance, not a collection' },
  browser: { rail: 'hidden', reason: 'tool window affordance, not a collection' },
  kanban: { rail: 'hidden', reason: 'descriptor exists without a collection surface yet; declare when routed' },
  automation: { rail: 'hidden', reason: 'Automation stays reachable via layout switcher, not the launch rail' },
  canvas: { rail: 'hidden', reason: 'Canvas stays reachable via layout switcher, not the launch rail' },
};

/** Rail collections: empty under CS11. Prefer deriveLayoutCollections for routes. */
export function deriveRailCollections(
  _kinds: readonly BlockKindGlyph[] = KIND_GLYPH_ORDER,
): readonly RailCollection[] {
  return [];
}

/** Collections that still own App Router segments and layout-switcher entries. */
export function deriveLayoutCollections(
  kinds: readonly BlockKindGlyph[] = KIND_GLYPH_ORDER,
): readonly RailCollection[] {
  const collections: RailCollection[] = [];
  for (const kindGlyph of kinds) {
    const policy = KIND_RAIL_POLICY[kindGlyph];
    if (!policy || policy.rail === 'hidden') continue;
    collections.push({
      tier: 'collection',
      kindGlyph,
      label: policy.label,
      path: policy.path,
      surfaceId: policy.surfaceId,
      kind: policy.kind,
    });
  }
  return collections;
}

export function assertUniqueRailLabels(
  places: readonly RailPlace[] = PLACE_ENTRIES,
  collections: readonly RailCollection[] = deriveLayoutCollections(),
): void {
  const seen = new Set<string>();
  for (const entry of [...places, ...collections]) {
    const key = entry.label.toLowerCase();
    if (seen.has(key)) {
      throw new Error(`Rail label collides: ${entry.label}`);
    }
    seen.add(key);
  }
}

if (process.env.NODE_ENV !== 'production') {
  assertUniqueRailLabels();
}
