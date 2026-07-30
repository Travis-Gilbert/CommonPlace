// Relationship label visibility is pure view state. Persistence belongs to the
// CommonPlace host, not this registry projection package.
export type RelLabelMode = "all" | "defined" | "undefined" | "hidden";

type KeyPair = { left: string; right: string };

export function isKeySet(k: KeyPair): boolean {
  return Boolean(k.left || k.right);
}

export function visibleKeys<T extends KeyPair>(keys: T[], mode: RelLabelMode): T[] {
  switch (mode) {
    case "all": return keys;
    case "defined": return keys.filter(isKeySet);
    case "undefined": return keys.filter(k => !isKeySet(k));
    case "hidden": return [];
  }
}

export function showCardinality(keys: KeyPair[], mode: RelLabelMode): boolean {
  if (mode === "hidden") return false;
  if (keys.length === 0) return true;
  return visibleKeys(keys, mode).length > 0;
}
