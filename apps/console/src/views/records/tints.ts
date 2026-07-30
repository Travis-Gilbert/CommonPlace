// SOURCING: RecordTableView tag/status hue ladder (TWENTY-APP-VALUES pattern).
// Register tokens only: tint surfaces plus ink pairs for record chips and cells.

export const TAG_HUES: Record<string, { tint: string; ink: string }> = {
  harness: { tint: 'var(--ij-gold-tint)', ink: 'var(--ij-gold)' },
  memory: { tint: 'var(--ij-memory-tint)', ink: 'var(--ij-memory)' },
  graph: { tint: 'var(--ij-graph-tint)', ink: 'var(--ij-graph)' },
  index: { tint: 'var(--ij-row-blue)', ink: 'var(--ij-link)' },
  publish: { tint: 'var(--ij-ok-bg)', ink: 'var(--ij-ok)' },
  agent: { tint: 'var(--ij-agent-tint)', ink: 'var(--ij-agent)' },
  room: { tint: 'var(--ij-room-tint)', ink: 'var(--ij-room)' },
};

export const STATUS_HUES: Record<string, { tint: string; ink: string }> = {
  open: { tint: 'var(--ij-row-blue)', ink: 'var(--ij-link)' },
  processing: { tint: 'var(--ij-warn-bg)', ink: 'var(--ij-warn)' },
  settled: { tint: 'var(--ij-ok-bg)', ink: 'var(--ij-ok)' },
};

const OBJECT_KEY_HUES: Record<string, { tint: string; ink: string }> = {
  record: { tint: 'var(--ij-row-gray)', ink: 'var(--ij-ink)' },
  task: { tint: 'var(--ij-agent-tint)', ink: 'var(--ij-agent)' },
  note: { tint: 'var(--ij-memory-tint)', ink: 'var(--ij-memory)' },
  company: { tint: 'var(--ij-row-blue)', ink: 'var(--ij-link)' },
  person: { tint: 'var(--ij-room-tint)', ink: 'var(--ij-room)' },
};

function hashLabel(label: string): number {
  let hash = 5381;
  for (let index = 0; index < label.length; index += 1) {
    hash = ((hash << 5) + hash + label.charCodeAt(index)) >>> 0;
  }
  return hash;
}

const FALLBACK_HUE_KEYS = Object.keys(TAG_HUES);

/** Stable hue pair for a tag or enum option string. */
export function hueForTag(tag: string): { tint: string; ink: string } {
  const direct = TAG_HUES[tag] ?? STATUS_HUES[tag];
  if (direct) return direct;
  const bucket = FALLBACK_HUE_KEYS[hashLabel(tag) % FALLBACK_HUE_KEYS.length] ?? 'harness';
  return TAG_HUES[bucket] ?? { tint: 'var(--ij-row-gray)', ink: 'var(--ij-ink-info)' };
}

/** Hue pair for an object type key (relation chip targets). */
export function hueForObjectKey(key: string): { tint: string; ink: string } {
  const normalized = key.trim().toLowerCase();
  return (
    OBJECT_KEY_HUES[normalized]
    ?? TAG_HUES[normalized]
    ?? hueForTag(normalized)
  );
}
