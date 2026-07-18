/**
 * Resolved database model — the object-model projection a Set view renders.
 *
 * The block-view contract (`../types.ts`) is the raw substrate: ObjectRef with
 * opaque `properties`. This module is the *resolved* layer a database view needs:
 * relation values turned into typed cells (option chips, object refs, file urls,
 * dates), plus the Set/View arrangement. Resolution lives at the host boundary,
 * never in a renderer, so every view sees the same shape.
 */

// ── relation formats (empirically mapped from the Anytype export) ────────────

export type RelationFormat =
  | "longtext"
  | "shorttext"
  | "number"
  | "status" // single-select, colored
  | "tag" // multi-select, colored
  | "date"
  | "file"
  | "checkbox"
  | "url"
  | "email"
  | "phone"
  | "emoji"
  | "object" // relation to other objects
  | "unknown";

/** Anytype model.RelationFormat int → our format. Confirmed against both exports. */
export const ANYTYPE_FORMAT: Readonly<Record<number, RelationFormat>> = {
  0: "longtext",
  1: "shorttext",
  2: "number",
  3: "status",
  4: "date",
  5: "file",
  6: "checkbox",
  7: "url",
  8: "email",
  9: "phone",
  10: "emoji",
  11: "tag",
  100: "object",
  101: "object",
};

// ── tag colors (Anytype palette → porcelain chip tokens) ─────────────────────

export type TagColor =
  | "grey"
  | "yellow"
  | "orange"
  | "red"
  | "pink"
  | "purple"
  | "blue"
  | "sky"
  | "teal"
  | "green";

/** Anytype color names → our porcelain chip hue. Muted for the parchment ground. */
export const ANYTYPE_COLOR: Readonly<Record<string, TagColor>> = {
  grey: "grey",
  gray: "grey",
  yellow: "yellow",
  amber: "yellow",
  orange: "orange",
  red: "red",
  pink: "pink",
  purple: "purple",
  blue: "blue",
  ice: "sky",
  sky: "sky",
  teal: "teal",
  lime: "green",
  green: "green",
};

export const asTagColor = (name?: string): TagColor => ANYTYPE_COLOR[String(name ?? "").toLowerCase()] ?? "grey";

// ── resolved cell / object ───────────────────────────────────────────────────

export interface OptionRef {
  readonly id: string;
  readonly name: string;
  readonly color: TagColor;
  /** the relation this option belongs to — lets seeds/mutations pool options. */
  readonly relationKey?: string;
}
export interface RefChip {
  readonly id: string;
  readonly title: string;
  readonly icon?: string;
}
export interface FileRef {
  readonly id: string;
  readonly url: string;
  readonly name: string;
}

/** One relation value on an object, resolved for rendering. */
export interface Cell {
  readonly key: string;
  readonly name: string;
  readonly format: RelationFormat;
  readonly text?: string;
  readonly number?: number;
  readonly date?: number;
  readonly bool?: boolean;
  readonly url?: string;
  readonly options?: readonly OptionRef[];
  readonly refs?: readonly RefChip[];
  readonly files?: readonly FileRef[];
  /** true when the value is empty/unset — views hide or dim these. */
  readonly empty: boolean;
}

export interface DbObject {
  readonly id: string;
  readonly typeKey: string;
  readonly title: string;
  readonly icon?: string;
  readonly emoji?: string;
  readonly cover?: FileRef | null;
  /** resolved cells keyed by relationKey. */
  readonly cells: Readonly<Record<string, Cell>>;
  readonly createdMs?: number;
  readonly updatedMs?: number;
  /** "import" (from the .pb export) or "seed" (synthetic, same schema). */
  readonly origin: "import" | "seed";
}

// ── set / view arrangement ────────────────────────────────────────────────────

export type ViewKind = "gallery" | "grid" | "list" | "board";

/** Anytype view Type int → our ViewKind. Table=0 List=1 Gallery=2 Kanban=3. */
export const ANYTYPE_VIEW_KIND: Readonly<Record<number, ViewKind>> = {
  0: "grid",
  1: "list",
  2: "gallery",
  3: "board",
};

export type FilterCondition = "eq" | "neq" | "empty" | "notEmpty" | "contains";

export interface Filter {
  readonly relationKey: string;
  readonly condition: FilterCondition;
  readonly value?: string;
}
export interface Sort {
  readonly relationKey: string;
  readonly dir: "asc" | "desc";
}

/** A saved view = an Anytype tab: its own kind, columns, filters, sort, group. */
export interface SavedView {
  readonly id: string;
  readonly name: string;
  readonly kind: ViewKind;
  readonly visibleRelations: readonly string[];
  readonly filters: readonly Filter[];
  readonly sorts: readonly Sort[];
  readonly groupBy?: string;
  readonly coverRelation?: string;
}

export interface DbSet {
  readonly id: string;
  readonly name: string;
  readonly emoji?: string;
  readonly description?: string;
  readonly typeKey: string;
  readonly views: readonly SavedView[];
}

export interface RelationMeta {
  readonly key: string;
  readonly name: string;
  readonly format: RelationFormat;
}

/** The full importable/servable graph for one space. */
export interface ObjectGraph {
  readonly space: string;
  readonly set: DbSet;
  readonly type: { readonly key: string; readonly name: string; readonly emoji?: string };
  readonly relations: Readonly<Record<string, RelationMeta>>;
  /** every option referenced by the objects, so mutations can re-resolve cells. */
  readonly options: Readonly<Record<string, OptionRef>>;
  readonly objects: readonly DbObject[];
}

/** Build a resolved Cell from a raw value — used by the host when a patch lands. */
export function makeCell(meta: RelationMeta, value: unknown, options: Readonly<Record<string, OptionRef>>): Cell {
  const base = { key: meta.key, name: meta.name, format: meta.format };
  const ids = Array.isArray(value) ? value.map(String) : value != null && value !== "" ? [String(value)] : [];
  switch (meta.format) {
    case "status":
    case "tag": {
      const opts = ids.map((id) => options[id]).filter(Boolean) as OptionRef[];
      return { ...base, options: opts, empty: opts.length === 0 };
    }
    case "checkbox":
      return { ...base, bool: value === true, empty: value == null };
    case "number": {
      const n = typeof value === "number" ? value : Number(value);
      return { ...base, number: Number.isFinite(n) ? n : undefined, empty: !Number.isFinite(n) };
    }
    case "url":
      return { ...base, url: String(value ?? ""), empty: !value };
    default:
      return { ...base, text: String(value ?? ""), empty: !value };
  }
}

// ── pure view engine: filter / sort / group over resolved objects ─────────────

const cellText = (c?: Cell): string => {
  if (!c) return "";
  if (c.options?.length) return c.options.map((o) => o.name).join(" ");
  if (c.refs?.length) return c.refs.map((r) => r.title).join(" ");
  if (c.text) return c.text;
  if (typeof c.number === "number") return String(c.number);
  if (typeof c.bool === "boolean") return c.bool ? "true" : "false";
  return "";
};

export function applyFilter(obj: DbObject, f: Filter): boolean {
  const c = obj.cells[f.relationKey];
  switch (f.condition) {
    case "empty":
      return !c || c.empty;
    case "notEmpty":
      return !!c && !c.empty;
    case "neq":
      return cellText(c).toLowerCase() !== String(f.value ?? "").toLowerCase();
    case "contains":
      return cellText(c).toLowerCase().includes(String(f.value ?? "").toLowerCase());
    case "eq":
    default:
      return cellText(c).toLowerCase() === String(f.value ?? "").toLowerCase();
  }
}

export function selectObjects(objects: readonly DbObject[], view: SavedView, search = ""): DbObject[] {
  let out = objects.filter((o) => view.filters.every((f) => applyFilter(o, f)));
  if (search.trim()) {
    const q = search.toLowerCase();
    out = out.filter((o) => o.title.toLowerCase().includes(q) || Object.values(o.cells).some((c) => cellText(c).toLowerCase().includes(q)));
  }
  for (const s of [...view.sorts].reverse()) {
    out = [...out].sort((a, b) => {
      const av = a.cells[s.relationKey];
      const bv = b.cells[s.relationKey];
      const an = av?.number ?? av?.date;
      const bn = bv?.number ?? bv?.date;
      const cmp = an != null && bn != null ? an - bn : cellText(av).localeCompare(cellText(bv));
      return s.dir === "asc" ? cmp : -cmp;
    });
  }
  return out;
}

export interface Group {
  readonly key: string;
  readonly label: string;
  readonly color?: TagColor;
  readonly objects: readonly DbObject[];
}

/** Group objects by a status/tag relation into board columns (empty column last). */
export function groupObjects(objects: readonly DbObject[], relationKey: string): Group[] {
  const groups = new Map<string, Group & { objects: DbObject[] }>();
  const ensure = (key: string, label: string, color?: TagColor) => {
    let g = groups.get(key);
    if (!g) groups.set(key, (g = { key, label, color, objects: [] }));
    return g;
  };
  for (const o of objects) {
    const c = o.cells[relationKey];
    const opts = c?.options ?? [];
    if (!opts.length) ensure("∅", "No value").objects.push(o);
    else for (const opt of opts) ensure(opt.id, opt.name, opt.color).objects.push(o);
  }
  const arr = [...groups.values()];
  arr.sort((a, b) => (a.key === "∅" ? 1 : b.key === "∅" ? -1 : 0));
  return arr;
}
