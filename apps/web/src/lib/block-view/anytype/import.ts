/**
 * Anytype export → resolved ObjectGraph.
 *
 * Reads a `<space>/` export directory (types, relations, relationsOptions,
 * objects, filesObjects, files) and resolves it into the database model that a
 * Set view renders: typed cells, option chips with colors, object-relation
 * chips, cover urls, and the Set's saved views. Node-only (uses fs).
 */

import { readFileSync, readdirSync, existsSync, statSync } from "node:fs";
import { join, basename } from "node:path";
import { decodeSnapshot, type Snapshot, type StructValue } from "./decode";
import {
  ANYTYPE_FORMAT,
  ANYTYPE_VIEW_KIND,
  asTagColor,
  type Cell,
  type DbObject,
  type DbSet,
  type FileRef,
  type ObjectGraph,
  type OptionRef,
  type RefChip,
  type RelationFormat,
  type RelationMeta,
  type SavedView,
  type ViewKind,
} from "../database/model";

// Relation keys that are Anytype plumbing, never shown as content cells.
const SYSTEM_KEYS = new Set([
  "name", "snippet", "iconEmoji", "iconImage", "iconOption", "coverId", "coverX", "coverY",
  "coverScale", "coverType", "layout", "layoutAlign", "resolvedLayout", "origin", "importType",
  "internalFlags", "oldAnytypeID", "sourceObject", "spaceId", "creator", "lastModifiedBy",
  "lastModifiedDate", "lastOpenedDate", "backlinks", "links", "featuredRelations", "restrictions",
  "workspaceId", "syncDate", "syncError", "syncStatus", "isHidden", "isArchived", "isDeleted",
  "isFavorite", "isReadonly", "id", "type", "setOf", "uniqueKey", "spaceDashboardId", "globalName",
  "identity", "participantPermissions", "participantStatus", "isHiddenDiscovery", "profileOwnerIdentity",
  "fileExt", "fileMimeType", "fileId", "source", "addedDate", "createdDate", "recommendedLayout",
  "recommendedRelations", "recommendedFeaturedRelations", "recommendedHiddenRelations",
  "defaultTemplateId", "defaultTypeId", "lastUsedDate", "timestamp", "relationFormat", "relationKey",
]);

interface Buckets {
  relations: Map<string, RelationMeta>;
  options: Map<string, OptionRef>;
  files: Map<string, FileRef>;
  refTargets: Map<string, RefChip>;
  typesByAny: Map<string, { key: string; name: string; emoji?: string; id: string }>;
  set?: { snap: Snapshot; id: string; name: string; emoji?: string; description?: string; setOf: string };
  objectSnaps: Snapshot[];
}

const s = (v: StructValue): string => (typeof v === "string" ? v : "");
const arr = (v: StructValue): string[] => (Array.isArray(v) ? v.map(s).filter(Boolean) : typeof v === "string" && v ? [v] : []);
const num = (v: StructValue): number | undefined => (typeof v === "number" ? v : undefined);

function listPb(dir: string): string[] {
  if (!existsSync(dir) || !statSync(dir).isDirectory()) return [];
  return readdirSync(dir).filter((f) => f.endsWith(".pb")).map((f) => join(dir, f));
}

function fileUrl(space: string, source: string): string {
  return `/api/v2/db/${space}/files/${basename(source)}`;
}

/** Pass 1: decode every snapshot and bucket by kind. */
function collect(root: string, space: string): Buckets {
  const b: Buckets = {
    relations: new Map(), options: new Map(), files: new Map(),
    refTargets: new Map(), typesByAny: new Map(), objectSnaps: [],
  };
  const dirs = ["types", "relations", "relationsOptions", "objects", "filesObjects", "templates", "profile"];
  for (const d of dirs) {
    for (const p of listPb(join(root, d))) {
      let snap: Snapshot;
      try { snap = decodeSnapshot(readFileSync(p)); } catch { continue; }
      const ot = snap.objectTypes[0] ?? "";
      const det = snap.details;
      const id = s(det.id);

      if (ot === "ot-relation") {
        const key = s(det.relationKey);
        if (key) b.relations.set(key, { key, name: s(det.name) || key, format: ANYTYPE_FORMAT[num(det.relationFormat) ?? -1] ?? "unknown" });
      } else if (ot === "ot-relationOption") {
        if (id) b.options.set(id, { id, name: s(det.name), color: asTagColor(s(det.relationOptionColor)), relationKey: s(det.relationKey) || undefined });
      } else if (ot === "ot-objectType") {
        const entry = { key: s(det.uniqueKey) || id, name: s(det.name), emoji: s(det.iconEmoji) || undefined, id };
        if (id) b.typesByAny.set(id, entry);
        if (det.uniqueKey) b.typesByAny.set(s(det.uniqueKey), entry);
      } else if (ot === "ot-image" || ot === "ot-file" || ot === "ot-video" || ot === "ot-audio") {
        if (id) b.files.set(id, { id, name: s(det.name), url: fileUrl(space, s(det.source) || `${id}.${s(det.fileExt) || "png"}`) });
      } else if (ot === "ot-set") {
        b.set = { snap, id, name: s(det.name), emoji: s(det.iconEmoji) || undefined, description: s(det.description) || undefined, setOf: arr(det.setOf)[0] ?? "" };
      }

      // Any object with a name is a potential object-relation target.
      if (id && det.name) b.refTargets.set(id, { id, title: s(det.name), icon: s(det.iconEmoji) || undefined });
      // Options can also live in objects/ (movie status options).
      if (ot === "ot-relationOption" && id) b.options.set(id, { id, name: s(det.name), color: asTagColor(s(det.relationOptionColor)), relationKey: s(det.relationKey) || undefined });
      // Domain objects are anything that isn't Anytype system furniture.
      if (isDomainType(ot)) b.objectSnaps.push(snap);
    }
  }
  return b;
}

const SYSTEM_TYPES = new Set([
  "ot-participant", "ot-profile", "ot-dashboard", "ot-space", "ot-set", "ot-relation",
  "ot-relationOption", "ot-objectType", "ot-image", "ot-file", "ot-video", "ot-audio",
  "ot-template", "ot-note", "ot-page", "ot-collection", "ot-bookmark", "ot-chat", "ot-date",
]);
const isDomainType = (ot: string): boolean => ot.startsWith("ot-") && !SYSTEM_TYPES.has(ot);

/** Resolve one relation value into a typed Cell. */
function resolveCell(key: string, meta: RelationMeta, raw: StructValue, b: Buckets): Cell {
  const base = { key, name: meta.name, format: meta.format };
  switch (meta.format) {
    case "status":
    case "tag": {
      const options = arr(raw).map((id) => b.options.get(id)).filter(Boolean) as OptionRef[];
      return { ...base, options, empty: options.length === 0 };
    }
    case "object": {
      const refs = arr(raw).map((id) => b.refTargets.get(id) ?? { id, title: id.slice(0, 8) }).filter(Boolean) as RefChip[];
      return { ...base, refs, empty: refs.length === 0 };
    }
    case "file": {
      const files = arr(raw).map((id) => b.files.get(id)).filter(Boolean) as FileRef[];
      return { ...base, files, empty: files.length === 0 };
    }
    case "date": {
      const n = num(raw);
      return { ...base, date: n != null ? Math.round(n * 1000) : undefined, empty: n == null };
    }
    case "number": {
      const n = num(raw);
      return { ...base, number: n, empty: n == null };
    }
    case "checkbox":
      return { ...base, bool: raw === true, empty: raw == null };
    default: {
      const t = typeof raw === "string" ? raw : Array.isArray(raw) ? raw.map(s).filter(Boolean).join(", ") : "";
      return meta.format === "url" ? { ...base, url: t, empty: !t } : { ...base, text: t, empty: !t };
    }
  }
}

function resolveObject(snap: Snapshot, b: Buckets): DbObject {
  const det = snap.details;
  const id = s(det.id);
  const cells: Record<string, Cell> = {};
  for (const [key, raw] of Object.entries(det)) {
    if (SYSTEM_KEYS.has(key)) continue;
    const meta = b.relations.get(key) ?? (key === "description" ? { key, name: "Description", format: "longtext" as RelationFormat } : undefined);
    if (!meta) continue;
    const cell = resolveCell(key, meta, raw, b);
    if (!cell.empty) cells[key] = cell;
  }
  const coverId = s(det.coverId);
  return {
    id,
    typeKey: snap.objectTypes[0] ?? "",
    title: s(det.name) || "Untitled",
    emoji: s(det.iconEmoji) || undefined,
    icon: b.files.get(s(det.iconImage))?.url,
    cover: coverId ? b.files.get(coverId) ?? null : null,
    cells,
    createdMs: num(det.createdDate) != null ? Math.round((num(det.createdDate) as number) * 1000) : undefined,
    updatedMs: num(det.lastModifiedDate) != null ? Math.round((num(det.lastModifiedDate) as number) * 1000) : undefined,
    origin: "import",
  };
}

/** Build the Set's saved views; derive grid/list/board siblings from the gallery. */
function buildViews(b: Buckets, relations: Record<string, RelationMeta>): SavedView[] {
  const views: SavedView[] = [];
  const rawViews = b.set?.snap.views ?? [];
  for (const v of rawViews) {
    const visible = v.relations.filter((r) => r.visible && r.key !== "name").map((r) => r.key);
    views.push({
      id: v.id,
      name: v.name || "View",
      kind: ANYTYPE_VIEW_KIND[v.type] ?? "gallery",
      visibleRelations: visible.length ? visible : Object.keys(relations).slice(0, 6),
      filters: v.filters.map((f) => ({ relationKey: f.relationKey, condition: "eq" as const, value: typeof f.value === "string" ? f.value : undefined })).filter((f) => f.relationKey),
      sorts: [],
    });
  }
  if (!views.length) return views;
  const primary = views[0];
  const kinds: ViewKind[] = ["gallery", "grid", "list", "board"];
  const present = new Set(views.map((v) => v.kind));
  const firstOption = primary.visibleRelations.find((k) => relations[k] && (relations[k].format === "status" || relations[k].format === "tag"));
  for (const kind of kinds) {
    if (present.has(kind)) continue;
    if (kind === "board" && !firstOption) continue;
    views.push({ ...primary, id: `${primary.id}-${kind}`, name: kind[0].toUpperCase() + kind.slice(1), kind, groupBy: kind === "board" ? firstOption : undefined });
  }
  return views;
}

export function importSpace(root: string, space: string): ObjectGraph {
  const b = collect(root, space);
  const typeKeyFromSet = b.set ? b.typesByAny.get(b.set.setOf)?.key : undefined;
  const domain = b.objectSnaps.map((snap) => resolveObject(snap, b));
  const typeKey = typeKeyFromSet ?? domain[0]?.typeKey ?? "unknown";
  const objects = domain.filter((o) => o.typeKey === typeKey || !typeKeyFromSet);

  // Relations catalog: everything actually used by an object, in a stable order.
  const relations: Record<string, RelationMeta> = {};
  for (const o of objects) for (const key of Object.keys(o.cells)) if (b.relations.get(key)) relations[key] = b.relations.get(key)!;

  const typeMeta = b.typesByAny.get(typeKey) ?? { key: typeKey, name: b.set?.name ?? space, emoji: b.set?.emoji };
  const set: DbSet = {
    id: b.set?.id ?? space,
    name: b.set?.name ?? typeMeta.name,
    emoji: b.set?.emoji ?? typeMeta.emoji,
    description: b.set?.description,
    typeKey,
    views: buildViews(b, relations),
  };
  // Expose the full option pool (not just used ones) so seeds/mutations can
  // reference options this single-object export didn't happen to reference.
  const options: Record<string, OptionRef> = Object.fromEntries(b.options);

  return { space, set, type: { key: typeKey, name: typeMeta.name, emoji: typeMeta.emoji }, relations, options, objects };
}
