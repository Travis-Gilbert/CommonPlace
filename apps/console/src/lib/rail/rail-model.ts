// SOURCING: none. SPEC-CONSOLE-INFORMATION-ARCHITECTURE-1.0 D1/D2:
// three rail tiers (place, collection, pin). Collections are derived from
// BlockKindGlyph; Places are a closed hand-authored set.

import type { BlockKindGlyph } from '@commonplace/block-view/types';
import { KIND_GLYPH_ORDER } from '@/lib/material/kind-hues';

export type RailTier = 'place' | 'collection' | 'pin';

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
 * Adding a glyph to KIND_GLYPH_ORDER without a policy defaults to hidden so
 * unregistered destinations cannot drift into the rail.
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
    id: 'place-workspace',
    kind: 'workspace',
    label: 'Workspace',
    path: '/workspace',
    surfaceId: 'console-workspace',
    stripeOrder: 1,
  },
  {
    tier: 'place',
    id: 'place-filing',
    kind: 'index',
    label: 'Filing',
    path: '/filing',
    surfaceId: 'console-index',
    stripeOrder: 2,
  },
  {
    tier: 'place',
    id: 'place-canvas',
    kind: 'canvas',
    label: 'Canvas',
    path: '/canvas',
    surfaceId: 'console-canvas',
    stripeOrder: 3,
  },
  {
    tier: 'place',
    id: 'place-automation',
    kind: 'automation',
    label: 'Automation',
    path: '/automation',
    surfaceId: 'console-automation',
    stripeOrder: 4,
  },
  {
    tier: 'place',
    id: 'place-topics',
    kind: 'topics',
    label: 'Topics',
    path: '/topics',
    surfaceId: 'console-topics',
    stripeOrder: 5,
  },
  {
    tier: 'place',
    id: 'place-indexer',
    kind: 'survey',
    label: 'Indexer',
    path: '/indexer',
    surfaceId: 'console-survey',
    stripeOrder: 6,
  },
  {
    tier: 'place',
    id: 'place-models',
    kind: 'model',
    label: 'Models',
    path: '/models',
    surfaceId: 'console-models',
    stripeOrder: 7,
  },
] as const;

/** Kind → collection policy. Place names keep the singular; collections take plural where needed. */
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
  workspace: { rail: 'hidden', reason: 'Workspace is a Place' },
  model: { rail: 'hidden', reason: 'Models is a Place' },
  context: { rail: 'hidden', reason: 'dock companion, not a rail destination' },
  terminal: { rail: 'hidden', reason: 'tool window affordance, not a collection' },
  browser: { rail: 'hidden', reason: 'tool window affordance, not a collection' },
  kanban: { rail: 'hidden', reason: 'descriptor exists without a collection surface yet; declare when routed' },
  automation: { rail: 'hidden', reason: 'Automation is a Place' },
  canvas: { rail: 'hidden', reason: 'Canvas is a Place' },
};

/** Generate collection rail entries from the registered kind set. */
export function deriveRailCollections(
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
  collections: readonly RailCollection[] = deriveRailCollections(),
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
