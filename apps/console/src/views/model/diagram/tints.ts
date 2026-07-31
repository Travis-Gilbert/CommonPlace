// SOURCING: jalco repo-card kind chip ladder, retokened to the Int UI register.
// Extends the RecordTableView TAG_HUES object tint vocabulary.

export interface ObjectTint {
  readonly tint: string;
  readonly ink: string;
}

/** Stable object-type tint ladder keyed by domain channel. */
export const OBJECT_TINTS: Record<string, ObjectTint> = {
  memory: { tint: 'var(--ij-memory-tint)', ink: 'var(--ij-memory)' },
  graph: { tint: 'var(--ij-graph-tint)', ink: 'var(--ij-graph)' },
  agent: { tint: 'var(--ij-agent-tint)', ink: 'var(--ij-agent)' },
  room: { tint: 'var(--ij-room-tint)', ink: 'var(--ij-room)' },
  gold: { tint: 'var(--ij-gold-tint)', ink: 'var(--ij-gold)' },
  link: { tint: 'var(--ij-row-blue)', ink: 'var(--ij-link)' },
};

const TINT_KEYS = Object.keys(OBJECT_TINTS);

function hashKey(key: string): number {
  let hash = 0;
  for (let index = 0; index < key.length; index += 1) {
    hash = (hash * 31 + key.charCodeAt(index)) >>> 0;
  }
  return hash;
}

/** Deterministic tint for an object key or label. */
export function tintForKey(key: string): ObjectTint {
  const normalized = key.trim().toLowerCase();
  if (OBJECT_TINTS[normalized]) return OBJECT_TINTS[normalized]!;
  const ladderKey = TINT_KEYS[hashKey(normalized) % TINT_KEYS.length] ?? 'link';
  return OBJECT_TINTS[ladderKey]!;
}
