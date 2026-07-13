import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import type { ObjectQuery } from "@/lib/block-view/types";
import type { CommonplaceRustyRedDataSource } from "@/lib/commonplace/rustyred-data-contract";
import {
  gqlAddToCollection,
  gqlBriefing,
  gqlCollections,
  gqlCreateCollection,
  gqlMoveToCollection,
  type ItemGql,
} from "@/lib/commonplace-graphql";

/* Index band queries (HANDOFF-INDEX-SURFACE D4).
 *
 * The Index is the daily driver: everything is already filed, so the surface
 * reviews three bands -- what landed, what is open, what today holds. This
 * module is the contract-first seam between those bands and the substrate:
 *
 *   - `useIndexData()` returns typed bands with a `source.mode` (live/fixture/
 *     error), the same derive-or-consume seam the graph surface uses. It serves
 *     a fixture today and grows into the CommonPlace GraphQL `briefing` +
 *     due-today task queries with no change to the list/detail components.
 *   - `INDEX_BAND_QUERIES` are the three ObjectQuery bindings, modeled on the
 *     proven `objectQueryForView` vocabulary. They ride along as provenance now
 *     and become the live request when the GraphQL resolver is wired.
 *   - `isNeedsYou()` is the decision predicate behind the Needs-you tab.
 *
 * Epistemic rows (question, tension) are gated behind M3 in live mode via
 * `INDEX_EPISTEMIC_M3`; the fixture always includes them so the band ships now
 * with its full shape and live-mode grows into it without a UI change. */

export type IndexBandId = "landed" | "open" | "today";

export type IndexRowKind =
  | "file"
  | "link"
  | "voice"
  | "task"
  | "question"
  | "tension"
  | "event"
  | "note";

export interface IndexRowDestination {
  /** "filed to" for a collection/folder edge, "linked to" for a relation. */
  readonly verb: "filed to" | "linked to";
  readonly label: string;
}

export interface IndexRow {
  readonly id: string;
  readonly band: IndexBandId;
  readonly kind: IndexRowKind;
  readonly title: string;
  /** The filed-to destination token. Editing it is the training signal (D5). */
  readonly destination: IndexRowDestination | null;
  /** The collection id backing the destination (live only), so a refile can MOVE
   *  (tombstone the old membership + add the new) instead of only adding. */
  readonly destinationId?: string;
  readonly tags: readonly string[];
  /** Right side of the subtitle line, e.g. "draft ready in Artifacts". */
  readonly meta?: string;
  /** For the Today band: a time label, "2:00 PM", or a soft anchor "today". */
  readonly when?: string;
  readonly whenSoft?: boolean;
  /** A structural tension: the one place the accent is earned in a row. */
  readonly isTension?: boolean;
  /** Provenance for the detail pane: who filed it and when. */
  readonly provenance?: { readonly filedBy: string; readonly atMs: number };
  /** Classification confidence in 0..1. Optional derive-or-consume field: the
   *  live ingest carries it; absent means "not a refile candidate". A value
   *  below `REFILE_CONFIDENCE_THRESHOLD` exposes a decision (Needs you). */
  readonly classificationConfidence?: number;
}

export interface IndexData {
  readonly source: CommonplaceRustyRedDataSource;
  readonly bands: Readonly<Record<IndexBandId, readonly IndexRow[]>>;
}

export function indexRowKey(row: Pick<IndexRow, "band" | "id">): string {
  return `${row.band}:${row.id}`;
}

/** Below this, the engine is unsure where it filed something: a refile
 *  candidate that surfaces in Needs you. */
export const REFILE_CONFIDENCE_THRESHOLD = 0.6;

/** Live-mode gate for epistemic rows (question, tension), keyed to data-model
 *  M3 (claims layer). Fixture ignores this; live mode honors it. */
export const INDEX_EPISTEMIC_M3 = false;

/** Live-mode gate for valid-time anchored Today items, keyed to data-model M1
 *  (bi-temporal). Same pattern as INDEX_EPISTEMIC_M3: the fixture ignores it;
 *  the live Today mapping includes valid-time anchored items (beyond due-today
 *  tasks) only once M1 lands, with no UI change. */
export const INDEX_TEMPORAL_M1 = false;

/** A row exposes a decision -- the Needs-you filter. Refile candidates below the
 *  confidence threshold, open questions, tensions, and due-today tasks. */
export function isNeedsYou(row: IndexRow): boolean {
  if (row.isTension) return true;
  if (row.kind === "question") return true;
  if (row.band === "today" && row.kind === "task") return true;
  return (
    row.classificationConfidence !== undefined &&
    row.classificationConfidence < REFILE_CONFIDENCE_THRESHOLD
  );
}

const RANK_NEWEST: ObjectQuery["rank"] = [
  { kind: "field", field: "createdAtMs", direction: "desc" },
];

/** The three band bindings (D4). Landed reads capture/agent arrivals by recency;
 *  Open reads unresolved work plus epistemic rows once M3 lands; Today reads
 *  due-today tasks plus valid-time anchored items. Not-done / due-today /
 *  source filters resolve server-side; encoded here as intent + provenance. */
export const INDEX_BAND_QUERIES: Readonly<Record<IndexBandId, ObjectQuery>> = {
  landed: {
    types: ["file", "doc", "image", "clip", "link", "note", "voice"],
    rank: RANK_NEWEST,
    project: {
      fields: ["title", "kind", "source", "tags", "classification", "createdAtMs"],
      relations: [{ edge: "IN_COLLECTION", dir: "out", target: "collection" }],
      include_body_preview: true,
      include_metadata: true,
    },
    page: { limit: 60 },
    live: true,
  },
  open: {
    types: ["task", "question", "tension", "thread"],
    rank: [{ kind: "field", field: "updatedAtMs", direction: "desc" }],
    project: {
      fields: ["title", "kind", "source", "tags", "classification", "updatedAtMs"],
      include_body_preview: true,
      include_metadata: true,
    },
    page: { limit: 60 },
    live: true,
  },
  today: {
    types: ["event", "task", "note", "artifact"],
    rank: [{ kind: "field", field: "dueAtMs", direction: "asc" }],
    project: {
      fields: ["title", "kind", "source", "tags", "dueAtMs", "updatedAtMs"],
      include_metadata: true,
    },
    page: { limit: 60 },
    live: true,
  },
};

const FIXTURE_FILED_AT = Date.UTC(2026, 6, 3, 8, 30, 0);

/** The current seed content, promoted to typed rows so the upgrade renders
 *  identically to the static page until the live seam is wired. */
const FIXTURE_BANDS: Record<IndexBandId, readonly IndexRow[]> = {
  landed: [
    {
      id: "fixture:file:ordinance-24-113",
      band: "landed",
      kind: "file",
      title: "Ordinance 24-113, porch lighting and setbacks.pdf",
      destination: { verb: "filed to", label: "Files / Zoning" },
      tags: ["porch", "setback"],
      provenance: { filedBy: "capture", atMs: FIXTURE_FILED_AT },
      classificationConfidence: 0.93,
    },
    {
      id: "fixture:link:adhd-external-memory",
      band: "landed",
      kind: "link",
      title: "How ADHD brains use external memory systems",
      destination: { verb: "filed to", label: "Reading" },
      tags: ["adhd", "pkm"],
      meta: "clipped from the web",
      provenance: { filedBy: "agent", atMs: FIXTURE_FILED_AT - 1_200_000 },
      classificationConfidence: 0.42,
    },
    {
      id: "fixture:voice:note-47s",
      band: "landed",
      kind: "voice",
      title: "Voice note, 47 seconds",
      destination: { verb: "linked to", label: "PorchFest 2026" },
      tags: ["transcribed"],
      provenance: { filedBy: "capture", atMs: FIXTURE_FILED_AT - 3_600_000 },
      classificationConfidence: 0.78,
    },
  ],
  open: [
    {
      id: "fixture:task:gclba-week-27",
      band: "open",
      kind: "task",
      title: "Send GCLBA compliance report, week 27",
      destination: { verb: "filed to", label: "Artifacts" },
      tags: [],
      meta: "draft ready in Artifacts",
    },
    {
      id: "fixture:question:corner-lots",
      band: "open",
      kind: "question",
      title: "Does the porch-light ordinance apply to corner lots?",
      destination: null,
      tags: [],
      meta: "raised from your reading",
    },
    {
      id: "fixture:tension:setback-distance",
      band: "open",
      kind: "tension",
      title: "Two sources disagree on the required setback distance",
      destination: null,
      tags: [],
      meta: "Ordinance 24-113 vs. the 2019 zoning map",
      isTension: true,
    },
    {
      id: "fixture:task:braintrust-reply",
      band: "open",
      kind: "task",
      title: "Reply to the Braintrust engagement email",
      destination: { verb: "filed to", label: "Threads" },
      tags: [],
      meta: "waiting 2 days",
    },
  ],
  today: [
    {
      id: "fixture:event:gclba-sync",
      band: "today",
      kind: "event",
      title: "GCLBA weekly compliance sync",
      destination: { verb: "linked to", label: "GCLBA" },
      tags: [],
      when: "2:00 PM",
      meta: "30 min, report due at end of day",
    },
    {
      id: "fixture:event:porchfest-applicants",
      band: "today",
      kind: "event",
      title: "PorchFest applicant review, 4 new",
      destination: { verb: "linked to", label: "PorchFest 2026" },
      tags: [],
      when: "today",
      whenSoft: true,
      meta: "no set time, Square payments cleared",
    },
    {
      id: "fixture:task:pairformer-kernel",
      band: "today",
      kind: "note",
      title: "Pairformer scatter-add kernel, pick back up",
      destination: { verb: "linked to", label: "Pairformer" },
      tags: [],
      when: "5:30 PM",
      meta: "focus block, from yesterday",
    },
  ],
};

/** Fixture Index data. `message` promotes the source to `error` mode so the
 *  surface can show a live-unreachable state without losing its shape. */
export function fixtureIndexData(message?: string): IndexData {
  return {
    source: {
      mode: message ? "error" : "fixture",
      message: message ?? "Fixture data is active until CommonPlace GraphQL is reachable.",
    },
    bands: FIXTURE_BANDS,
  };
}

/** commonplace-api ItemKind -> IndexRowKind (the glyph the row draws). */
const GQL_KIND_TO_INDEX: Record<string, IndexRowKind> = {
  file: "file",
  image: "file",
  doc: "note",
  note: "note",
  link: "link",
  clip: "link",
  voice: "voice",
  audio: "voice",
  task: "task",
  event: "event",
  question: "question",
  tension: "tension",
};

function mapGqlKind(kind: string): IndexRowKind {
  return GQL_KIND_TO_INDEX[kind] ?? "note";
}

function isDueToday(ms: number | null): boolean {
  if (!ms) return false;
  const due = new Date(ms);
  const now = new Date();
  return (
    due.getFullYear() === now.getFullYear() &&
    due.getMonth() === now.getMonth() &&
    due.getDate() === now.getDate()
  );
}

function itemGqlToIndexRow(
  item: ItemGql,
  band: IndexBandId,
  collectionName: (id: string) => string,
): IndexRow {
  const destId = item.collections[0];
  const destination: IndexRowDestination | null = item.path
    ? { verb: "filed to", label: item.path }
    : destId
      ? { verb: "filed to", label: collectionName(destId) }
      : null;
  const filedBy = item.tags.some((t) => t.startsWith("capture:")) ? "capture" : "agent";
  const when =
    band === "today" && item.dueAtMs
      ? new Date(item.dueAtMs).toLocaleTimeString("en-US", {
          hour: "numeric",
          minute: "2-digit",
        })
      : undefined;
  return {
    id: item.id,
    band,
    kind: mapGqlKind(item.kind),
    title: item.title || "Untitled",
    destination,
    destinationId: destId,
    tags: item.tags.filter((t) => !t.startsWith("capture:")),
    meta: item.classification ?? undefined,
    when,
    isTension: item.kind === "tension",
    provenance: { filedBy, atMs: item.createdAtMs },
    // classificationConfidence stays undefined here: briefing items don't carry
    // it. The server-computed confidence + needs-you partition lives on
    // gqlOrganize (organize.needsYou); wiring the Needs-you tab to it is the
    // follow-on that lets the confidence clause fire in live mode.
  };
}

/** Live Index data from commonplace-api briefing. Fail-open: returns null on any
 *  error or an all-empty briefing, so callers fall back to the fixture and the
 *  surface stays honest when the backend is unreachable. */
async function fetchLiveIndexData(): Promise<IndexData | null> {
  try {
    const [briefing, collections] = await Promise.all([gqlBriefing(), gqlCollections()]);
    const nameById = new Map(collections.map((c) => [c.id, c.name] as const));
    const collectionName = (id: string) => nameById.get(id) ?? id;

    const landed = briefing.recent.map((it) => itemGqlToIndexRow(it, "landed", collectionName));
    const open = briefing.openThreads.map((it) => itemGqlToIndexRow(it, "open", collectionName));

    const today: IndexRow[] = [];
    const seen = new Set<string>();
    for (const it of [...briefing.recent, ...briefing.openThreads]) {
      if (isDueToday(it.dueAtMs) && !seen.has(it.id)) {
        seen.add(it.id);
        today.push(itemGqlToIndexRow(it, "today", collectionName));
      }
    }

    if (landed.length === 0 && open.length === 0 && today.length === 0) return null;
    return {
      source: { mode: "live", message: "Live from commonplace-api briefing." },
      bands: { landed, open, today },
    };
  } catch {
    return null;
  }
}

/** The Index data hook. Contract-first: fixture on first paint (server + first
 *  client render, so hydration matches), then swaps to live briefing on mount if
 *  reachable. A down backend keeps the fixture -- callers never change. */
export function useIndexData(): IndexData {
  const [data, setData] = useState<IndexData>(fixtureIndexData);

  useEffect(() => {
    let cancelled = false;
    fetchLiveIndexData().then((live) => {
      if (!cancelled && live) setData(live);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return data;
}

/** Flatten the bands to a single ordered row list (All tab), preserving band
 *  order landed -> open -> today. */
export function allRows(data: IndexData): readonly IndexRow[] {
  return [...data.bands.landed, ...data.bands.open, ...data.bands.today];
}

/* Session-scoped refile overrides. The CustomEvent updates surfaces already
   mounted; these overrides let a surface you open AFTERWARD still reflect the
   correction (they survive client navigation within the session). Keyed by item
   id, carrying the title so fixture surfaces that key by title also resolve. */
interface RefileOverride {
  readonly label: string;
  readonly title?: string;
  readonly collectionId?: string;
}
const refileOverrides = new Map<string, RefileOverride>();

function recordRefileOverride(id: string, label: string, title?: string, collectionId?: string): void {
  refileOverrides.set(id, { label, title, collectionId });
}

/** The corrected destination label for an item by id or title, or undefined. */
export function refiledLabel(id?: string, title?: string): string | undefined {
  if (id) {
    const byId = refileOverrides.get(id);
    if (byId) return byId.label;
  }
  if (title) {
    for (const override of refileOverrides.values()) {
      if (override.title === title) return override.label;
    }
  }
  return undefined;
}

/** All active refile overrides, for a surface to fold into its seed on mount. */
export function refileOverrideList(): { id: string; label: string; title?: string }[] {
  return [...refileOverrides.entries()].map(([id, o]) => ({ id, label: o.label, title: o.title }));
}

/** Emit a refile correction (D5). Records a session override (so a surface
 *  opened later still reflects it), fires an observable CustomEvent so mounted
 *  peer surfaces react immediately, and best-effort writes the durable edge.
 *  The durable edge-write + harness feedback event is CC-owned backend work
 *  (no part of this spec went to Codex). Fail-open: SSR is a no-op. */
export function submitRefile(
  id: string,
  label: string,
  title?: string,
  currentCollectionId?: string,
  currentCollectionLabel?: string,
): Promise<string | undefined> {
  if (typeof window === "undefined") return Promise.resolve(undefined);
  recordRefileOverride(id, label, title);
  // 1. Observable signal (immediate): peer surfaces bind this to reflect the
  //    correction without a refetch. `title` lets fixture surfaces (which key by
  //    title) match; live surfaces match by `id`.
  try {
    window.dispatchEvent(
      new CustomEvent("commonplace:refile", {
        detail: { id, label, title, at: Date.now() },
      }),
    );
  } catch {
    /* ignore: signal is best-effort */
  }
  // 2. Durable write (best-effort, fail-open): resolve the destination label to
  //    a collection (create if new). When the item's current collection id is
  //    known (live), MOVE -- add the new membership and tombstone the old with
  //    provenance retained (commonplace-api moveToCollection). Otherwise add.
  return persistRefile(id, label, currentCollectionId, currentCollectionLabel).then((collectionId) => {
    if (collectionId) recordRefileOverride(id, label, title, collectionId);
    return collectionId;
  });
}

async function persistRefile(
  itemId: string,
  label: string,
  currentCollectionId?: string,
  currentCollectionLabel?: string,
): Promise<string | undefined> {
  const name = label.trim();
  if (!name) return undefined;
  try {
    const collections = await gqlCollections();
    const match = collections.find((c) => c.name.toLowerCase() === name.toLowerCase());
    const newId = match ? match.id : (await gqlCreateCollection(name)).id;
    const currentId =
      currentCollectionId ??
      (currentCollectionLabel
        ? collections.find((c) => c.name.toLowerCase() === currentCollectionLabel.toLowerCase())?.id
        : undefined);
    if (currentId && currentId !== newId) {
      await gqlMoveToCollection(itemId, currentId, newId);
    } else {
      await gqlAddToCollection(itemId, newId);
    }
    return newId;
  } catch {
    /* backend unreachable or write failed: the optimistic UI + event still hold */
    return undefined;
  }
}

/** The refile correction as peer surfaces receive it. */
export interface RefileSignal {
  readonly id: string;
  readonly label: string;
  readonly title?: string;
  readonly at: number;
}

/** Subscribe to refile corrections from any surface (D5 cross-surface). The
 *  handler is held in a ref so the listener is registered once, not per render. */
export function useRefileSignal(handler: (signal: RefileSignal) => void): void {
  const ref = useRef(handler);
  useEffect(() => {
    ref.current = handler;
  }, [handler]);

  useEffect(() => {
    const onRefile = (event: Event) => {
      const detail = (event as CustomEvent<RefileSignal>).detail;
      if (detail) ref.current(detail);
    };
    window.addEventListener("commonplace:refile", onRefile);
    return () => window.removeEventListener("commonplace:refile", onRefile);
  }, []);
}

/* ── Destinations (IX7 destination rail) ──────────────────────────────────────
   The rail is derived from the loaded rows, not a separate fetch: every
   destination shown has at least one real item and an exact count, so clicking
   it filters the stream to those items. Deriving from data already in hand keeps
   the count honest (it reflects the live stream) and avoids a rail full of
   zero-count collections. */

export interface IndexDestination {
  /** Stable key: the collection id when live, else the label. */
  readonly key: string;
  readonly label: string;
  /** How many loaded rows are filed to this destination. */
  readonly count: number;
}

/** The destination key a row files to, or null when it is not filed (an open
 *  question, an unresolved tension). Uses the collection id when present so a
 *  rename does not split a destination in two. */
export function rowDestinationKey(row: IndexRow): string | null {
  if (!row.destination) return null;
  return row.destinationId ?? row.destination.label;
}

/** Destinations present in the data, most-populated first. */
export function destinationsFromData(data: IndexData): readonly IndexDestination[] {
  const byKey = new Map<string, { label: string; count: number }>();
  for (const row of allRows(data)) {
    const key = rowDestinationKey(row);
    if (!key || !row.destination) continue;
    const entry = byKey.get(key);
    if (entry) entry.count += 1;
    else byKey.set(key, { label: row.destination.label, count: 1 });
  }
  return [...byKey.entries()]
    .map(([key, { label, count }]) => ({ key, label, count }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
}

/* ── Watch queries (IX6 saved-search destinations) ────────────────────────────
   A watch query is a saved search that behaves as a destination: it re-runs a
   real filter over the real rows and shows its live match count. This is the
   surface half of IX6, fully real client-side (localStorage). The engine half --
   a watch query participating in filing scores like an anchor -- is backend work
   that this seam does not fake. */

export interface WatchQuery {
  readonly id: string;
  readonly label: string;
  readonly query: string;
}

const WATCH_QUERIES_KEY = "v2:index:watch-queries";

function readWatchQueries(): WatchQuery[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(WATCH_QUERIES_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (q): q is WatchQuery =>
        !!q &&
        typeof (q as WatchQuery).id === "string" &&
        typeof (q as WatchQuery).label === "string" &&
        typeof (q as WatchQuery).query === "string",
    );
  } catch {
    return [];
  }
}

function writeWatchQueries(queries: readonly WatchQuery[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(WATCH_QUERIES_KEY, JSON.stringify(queries));
  } catch {
    /* storage full or blocked: the in-memory list still holds for the session */
  }
}

/** True when a row matches a free-text query (title, tags, destination, meta) --
 *  the same haystack the list search uses, so a saved query and a typed one
 *  select the same rows. */
export function rowMatchesQuery(row: IndexRow, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const hay = [row.title, ...row.tags, row.destination?.label ?? "", row.meta ?? ""]
    .join(" ")
    .toLowerCase();
  return hay.includes(q);
}

/** Live match count for a saved query over the loaded rows. */
export function watchQueryCount(data: IndexData, query: string): number {
  return allRows(data).filter((row) => rowMatchesQuery(row, query)).length;
}

/* Watch queries live in a tiny external store (localStorage is the source of
   truth) read through useSyncExternalStore. That is the SSR-safe, lint-clean way
   to subscribe to browser storage: the server snapshot is empty so first paint
   matches, the client snapshot is a cached array (stable ref, so no render loop),
   and a cross-tab `storage` event refreshes it. */

const EMPTY_WATCH_QUERIES: readonly WatchQuery[] = [];
let watchSnapshot: readonly WatchQuery[] | null = null;
const watchListeners = new Set<() => void>();

function watchStoreSnapshot(): readonly WatchQuery[] {
  if (watchSnapshot === null) watchSnapshot = readWatchQueries();
  return watchSnapshot;
}

function commitWatchQueries(next: readonly WatchQuery[]): void {
  watchSnapshot = next;
  writeWatchQueries(next);
  watchListeners.forEach((notify) => notify());
}

function subscribeWatchStore(onChange: () => void): () => void {
  watchListeners.add(onChange);
  const onStorage = (event: StorageEvent) => {
    if (event.key === WATCH_QUERIES_KEY) {
      watchSnapshot = readWatchQueries();
      onChange();
    }
  };
  window.addEventListener("storage", onStorage);
  return () => {
    watchListeners.delete(onChange);
    window.removeEventListener("storage", onStorage);
  };
}

/** Saved watch queries + mutators, backed by localStorage. SSR-safe: the server
 *  snapshot is empty so first paint matches, then the client snapshot hydrates
 *  from storage without a setState-in-effect. */
export function useWatchQueries(): {
  queries: readonly WatchQuery[];
  save: (label: string, query: string) => void;
  remove: (id: string) => void;
} {
  const queries = useSyncExternalStore(
    subscribeWatchStore,
    watchStoreSnapshot,
    () => EMPTY_WATCH_QUERIES,
  );

  const save = (label: string, query: string) => {
    const trimmedLabel = label.trim();
    const trimmedQuery = query.trim();
    if (!trimmedLabel || !trimmedQuery) return;
    // Replace an existing query with the same label rather than duplicating it.
    const withoutDupe = watchStoreSnapshot().filter(
      (q) => q.label.toLowerCase() !== trimmedLabel.toLowerCase(),
    );
    commitWatchQueries([
      ...withoutDupe,
      { id: `wq-${Date.now()}`, label: trimmedLabel, query: trimmedQuery },
    ]);
  };

  const remove = (id: string) => {
    commitWatchQueries(watchStoreSnapshot().filter((q) => q.id !== id));
  };

  return { queries, save, remove };
}
