// SOURCING: none — pure id shortening for the shell badge slot.
//
// ComfyUI puts a small ordinal on every node (`#66`) so two identically-named
// nodes can be told apart in conversation. Our ids are catalog ids and UUIDs,
// not ordinals, so the badge is a short hash of the node id: stable across
// reloads (unlike an ordinal, which renumbers when a node is deleted) and
// short enough to say out loud.

const ALPHABET = '0123456789abcdefghijklmnopqrstuvwxyz';

/**
 * FNV-1a over the node id, rendered base36. Not cryptographic and does not need
 * to be -- a collision costs two nodes sharing a label, not a wrong lookup.
 */
export function shortNodeBadge(nodeId: string, length = 3): string {
  let hash = 0x811c9dc5;
  for (let index = 0; index < nodeId.length; index += 1) {
    hash ^= nodeId.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  let out = '';
  let remaining = hash;
  for (let index = 0; index < length; index += 1) {
    out = ALPHABET[remaining % ALPHABET.length] + out;
    remaining = Math.floor(remaining / ALPHABET.length);
  }
  return `#${out}`;
}
