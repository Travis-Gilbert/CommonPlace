/**
 * Zero-dependency decoder for Anytype-heart `.pb` export snapshots.
 *
 * An export file is a protobuf `SnapshotWithType`:
 *   { sbType: varint (field 1), snapshot: ChangeSnapshot (field 2) }
 * whose nested `SmartBlockSnapshotBase` carries:
 *   blocks (field 1, repeated), details (field 2, google.protobuf.Struct),
 *   objectTypes (field 5, repeated string), relationLinks (field 7, repeated).
 *
 * We only need to *read* these, so rather than vendor the full anytype-heart
 * proto we decode the wire format generically and interpret the well-known
 * structpb `Struct`/`Value`/`ListValue` shapes plus the handful of Anytype
 * message layouts (RelationLink, Dataview View) by field position.
 *
 * Varints are decoded into JS numbers (not BigInt): every varint we read is a
 * field tag, length, enum, or small int — all far under 2^53 — so accumulating
 * with multiplication is exact and keeps the module ES2019-safe.
 */

// ── wire-format primitives ──────────────────────────────────────────────────

export type Wire = 0 | 1 | 2 | 5;

export interface RawField {
  readonly field: number;
  readonly wire: Wire;
  /** varint payload (wire 0); byte slice (wire 2); or the fixed bytes (1/5). */
  readonly varint?: number;
  readonly bytes?: Uint8Array;
}

function readVarint(b: Uint8Array, pos: number): [number, number] {
  let result = 0;
  let shift = 0;
  let byte: number;
  do {
    byte = b[pos++];
    result += (byte & 0x7f) * 2 ** shift;
    shift += 7;
  } while (byte & 0x80);
  return [result, pos];
}

/** Decode one protobuf message into its flat field list. */
export function decodeFields(b: Uint8Array): RawField[] {
  const out: RawField[] = [];
  let pos = 0;
  while (pos < b.length) {
    let tag: number;
    [tag, pos] = readVarint(b, pos);
    const field = Math.floor(tag / 8);
    const wire = (tag % 8) as Wire;
    if (wire === 0) {
      let v: number;
      [v, pos] = readVarint(b, pos);
      out.push({ field, wire, varint: v });
    } else if (wire === 2) {
      let len: number;
      [len, pos] = readVarint(b, pos);
      out.push({ field, wire, bytes: b.subarray(pos, pos + len) });
      pos += len;
    } else if (wire === 1) {
      out.push({ field, wire, bytes: b.subarray(pos, pos + 8) });
      pos += 8;
    } else if (wire === 5) {
      out.push({ field, wire, bytes: b.subarray(pos, pos + 4) });
      pos += 4;
    } else {
      break; // unknown/group wire type — stop, best effort
    }
  }
  return out;
}

const dec = new TextDecoder();
const str = (b?: Uint8Array): string => (b ? dec.decode(b) : "");
const first = (fs: RawField[], field: number): RawField | undefined => fs.find((f) => f.field === field);
const all = (fs: RawField[], field: number): RawField[] => fs.filter((f) => f.field === field);
const readDoubleLE = (b: Uint8Array): number => new DataView(b.buffer, b.byteOffset, 8).getFloat64(0, true);

// ── structpb ────────────────────────────────────────────────────────────────

export type StructValue =
  | null
  | number
  | string
  | boolean
  | StructValue[]
  | { [k: string]: StructValue };

/** google.protobuf.Value */
function decodeValue(b: Uint8Array): StructValue {
  const fs = decodeFields(b);
  for (const f of fs) {
    switch (f.field) {
      case 1:
        return null; // null_value
      case 2:
        return f.bytes ? readDoubleLE(f.bytes) : f.varint ?? 0;
      case 3:
        return str(f.bytes);
      case 4:
        return (f.varint ?? 0) !== 0;
      case 5:
        return decodeStruct(f.bytes ?? new Uint8Array());
      case 6:
        return decodeListValue(f.bytes ?? new Uint8Array());
    }
  }
  return null;
}

function decodeListValue(b: Uint8Array): StructValue[] {
  // ListValue { repeated Value values = 1; }
  return all(decodeFields(b), 1).map((f) => decodeValue(f.bytes ?? new Uint8Array()));
}

/** google.protobuf.Struct { map<string,Value> fields = 1; } */
export function decodeStruct(b: Uint8Array): Record<string, StructValue> {
  const out: Record<string, StructValue> = {};
  for (const entry of all(decodeFields(b), 1)) {
    const ef = decodeFields(entry.bytes ?? new Uint8Array());
    const key = str(first(ef, 1)?.bytes);
    const valField = first(ef, 2);
    if (!key) continue;
    out[key] = valField ? decodeValue(valField.bytes ?? new Uint8Array()) : null;
  }
  return out;
}

/** Heuristic: does this message decode as a structpb Struct with string keys? */
function looksLikeStruct(b: Uint8Array): boolean {
  const fs = decodeFields(b);
  if (fs.length === 0 || fs.some((f) => f.field !== 1 || f.wire !== 2)) return false;
  const sample = decodeStruct(b);
  const keys = Object.keys(sample);
  return keys.length > 0 && keys.some((k) => k === "id" || k === "name" || k === "type" || k === "snippet");
}

// ── snapshot navigation ─────────────────────────────────────────────────────

export interface RelationLink {
  readonly key: string;
  readonly format: number; // model.RelationFormat
}

export interface DataviewView {
  readonly id: string;
  readonly type: number; // 0 Grid/Table, 1 List, 2 Gallery, 3 Board/Kanban…
  readonly name: string;
  readonly relations: { key: string; visible: boolean; width: number }[];
  readonly filters: { relationKey: string; condition: number; value: StructValue }[];
}

export interface Snapshot {
  readonly sbType: number;
  readonly details: Record<string, StructValue>;
  readonly objectTypes: string[];
  readonly relationLinks: RelationLink[];
  readonly views: DataviewView[];
}

/** Find the SmartBlockSnapshotBase (the message whose field 2 is the details Struct). */
function findBase(b: Uint8Array, depth = 0): RawField[] | undefined {
  const fs = decodeFields(b);
  const details = first(fs, 2);
  if (details?.bytes && looksLikeStruct(details.bytes)) return fs;
  if (depth > 4) return undefined;
  for (const f of fs) {
    if (f.wire === 2 && f.bytes && f.bytes.length > 8) {
      const found = findBase(f.bytes, depth + 1);
      if (found) return found;
    }
  }
  return undefined;
}

function decodeRelationLinks(base: RawField[]): RelationLink[] {
  return all(base, 7)
    .map((f) => decodeFields(f.bytes ?? new Uint8Array()))
    .map((rf) => ({ key: str(first(rf, 1)?.bytes), format: first(rf, 2)?.varint ?? 0 }))
    .filter((r) => r.key);
}

/**
 * A Dataview View. Relations and filters both key off relation keys; we classify
 * by shape — a relation entry has an isVisible bool + width, a filter entry has a
 * condition enum + a Value message.
 */
function decodeView(b: Uint8Array): DataviewView {
  const fs = decodeFields(b);
  const id = str(first(fs, 1)?.bytes);
  const type = first(fs, 2)?.varint ?? 0;
  const name = str(first(fs, 3)?.bytes);
  const relations: DataviewView["relations"] = [];
  const filters: DataviewView["filters"] = [];
  for (const f of fs) {
    if (f.wire !== 2 || !f.bytes) continue;
    const sub = decodeFields(f.bytes);
    const key = str(first(sub, 1)?.bytes);
    if (!key) continue;
    const hasValue = sub.some((s) => s.field === 3 && s.wire === 2);
    const isRelation = sub.some((s) => s.field === 2 && s.wire === 0) && sub.some((s) => s.field === 3 && s.wire === 0);
    if (isRelation && !hasValue) {
      relations.push({ key, visible: (first(sub, 2)?.varint ?? 0) !== 0, width: first(sub, 3)?.varint ?? 0 });
    } else {
      const valField = sub.find((s) => s.field === 4 && s.wire === 2) ?? sub.find((s) => s.field === 3 && s.wire === 2);
      const condition = sub.find((s) => s.wire === 0 && s.field !== 1)?.varint ?? 0;
      if (valField?.bytes) filters.push({ relationKey: str(first(sub, 1)?.bytes), condition, value: decodeValue(valField.bytes) });
    }
  }
  return { id, type, name, relations, filters };
}

function decodeViews(base: RawField[]): DataviewView[] {
  const views: DataviewView[] = [];
  for (const block of all(base, 1)) {
    if (!block.bytes) continue;
    const bf = decodeFields(block.bytes);
    for (const f of bf) {
      if (f.wire !== 2 || !f.bytes) continue;
      const inner = decodeFields(f.bytes);
      const viewMsgs = inner.filter((x) => {
        if (x.wire !== 2 || !x.bytes) return false;
        const vf = decodeFields(x.bytes);
        return first(vf, 1)?.wire === 2 && typeof first(vf, 3)?.bytes !== "undefined" && first(vf, 2)?.wire === 0;
      });
      for (const vm of viewMsgs) {
        const v = decodeView(vm.bytes!);
        if (v.id && v.name) views.push(v);
      }
    }
  }
  const seen = new Set<string>();
  return views.filter((v) => (seen.has(v.id) ? false : (seen.add(v.id), true)));
}

/** Decode one `.pb` export file into a normalized Snapshot. */
export function decodeSnapshot(bytes: Uint8Array): Snapshot {
  const top = decodeFields(bytes);
  const sbType = first(top, 1)?.varint ?? 0;
  const base = findBase(bytes) ?? [];
  const details = (() => {
    const d = first(base, 2)?.bytes;
    return d ? decodeStruct(d) : {};
  })();
  const objectTypes = all(base, 5).map((f) => str(f.bytes)).filter(Boolean);
  return {
    sbType,
    details,
    objectTypes,
    relationLinks: decodeRelationLinks(base),
    views: decodeViews(base),
  };
}
