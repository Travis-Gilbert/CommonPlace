// SOURCING: twenty-ui `Tag` / `Status` (packages/twenty-ui, hard fork) — the
// record tag and status hue namespace. TU4 re-seat.
//
// Before the fork this file named CSS values directly (`var(--ij-gold-tint)`).
// It now names palette slots, and the fork's theme generator resolves those
// slots back to the same register tokens (see REGISTER_HUE_SLOTS in
// packages/twenty-ui/src/theme/generator/commonplaceTokens.ts). One indirection
// more, one place fewer for the two systems to drift apart.

import type { TagColor } from 'twenty-ui/data-display';

export const TAG_HUES: Record<string, TagColor> = {
  harness: 'gold',
  memory: 'jade',
  graph: 'turquoise',
  index: 'blue',
  publish: 'green',
  agent: 'amber',
  room: 'purple',
};

export const STATUS_HUES: Record<string, TagColor> = {
  open: 'blue',
  processing: 'yellow',
  settled: 'green',
};

const OBJECT_KEY_HUES: Record<string, TagColor> = {
  record: 'gray',
  task: 'amber',
  note: 'jade',
  company: 'blue',
  person: 'purple',
};

function hashLabel(label: string): number {
  let hash = 5381;
  for (let index = 0; index < label.length; index += 1) {
    hash = ((hash << 5) + hash + label.charCodeAt(index)) >>> 0;
  }
  return hash;
}

const FALLBACK_HUE_KEYS = Object.keys(TAG_HUES);

/** Stable hue for a tag or enum option string. */
export function hueForTag(tag: string): TagColor {
  const direct = TAG_HUES[tag] ?? STATUS_HUES[tag];
  if (direct) return direct;
  const bucket = FALLBACK_HUE_KEYS[hashLabel(tag) % FALLBACK_HUE_KEYS.length] ?? 'harness';
  return TAG_HUES[bucket] ?? 'gray';
}

/** Hue for an object type key (relation chip targets). */
export function hueForObjectKey(key: string): TagColor {
  const normalized = key.trim().toLowerCase();
  return (
    OBJECT_KEY_HUES[normalized]
    ?? TAG_HUES[normalized]
    ?? hueForTag(normalized)
  );
}
