import { makeCell, type Cell, type DbObject, type ObjectGraph, type OptionRef, type RelationMeta, type SavedView, type TagColor } from "./model";

/**
 * Sample content for the two demo databases. Each export ships exactly one real
 * domain object; this appends a few same-type rows that reuse the REAL relation
 * keys and option ids so the gallery is dense and filter/sort/group/board are
 * exercised on real structure. Everything here is origin:"seed" — the engine
 * stays generic; only this sample content is per-space.
 */

const norm = (s: string) => s.trim().toLowerCase();

interface SeedSpec {
  title: string;
  emoji?: string;
  text?: Record<string, string>;
  num?: Record<string, number>;
  opts?: Record<string, string[]>;
}

function relKeyByName(graph: ObjectGraph): Record<string, string> {
  const m: Record<string, string> = {};
  for (const r of Object.values(graph.relations)) m[norm(r.name)] = r.key;
  return m;
}
function poolByRelKey(graph: ObjectGraph): Record<string, OptionRef[]> {
  const m: Record<string, OptionRef[]> = {};
  for (const o of Object.values(graph.options)) if (o.relationKey) (m[o.relationKey] ??= []).push(o);
  return m;
}

function buildSeed(graph: ObjectGraph, relKey: Record<string, string>, pool: Record<string, OptionRef[]>, id: string, spec: SeedSpec): DbObject {
  const cells: Record<string, Cell> = {};
  const setCell = (relName: string, raw: unknown) => {
    const key = relKey[norm(relName)];
    const meta = key ? graph.relations[key] : undefined;
    if (!meta) return;
    const cell = makeCell(meta, raw, graph.options);
    if (!cell.empty) cells[key] = cell;
  };
  for (const [n, v] of Object.entries(spec.text ?? {})) setCell(n, v);
  for (const [n, v] of Object.entries(spec.num ?? {})) setCell(n, v);
  for (const [n, names] of Object.entries(spec.opts ?? {})) {
    const key = relKey[norm(n)];
    const ids = key ? names.map((nm) => pool[key]?.find((o) => norm(o.name) === norm(nm))?.id).filter(Boolean) : [];
    setCell(n, ids);
  }
  return { id, typeKey: graph.type.key, title: spec.title, emoji: spec.emoji, cover: null, cells, origin: "seed" };
}

/** Ensure a board view exists grouped by `relName`; add one if the type has none. */
function ensureBoard(graph: ObjectGraph, views: readonly SavedView[], relName: string): SavedView[] {
  const key = relKeyByName(graph)[norm(relName)];
  if (!key) return [...views];
  const board = views.find((v) => v.kind === "board");
  if (board) return views.map((v) => (v === board ? { ...v, groupBy: key } : v));
  const primary = views[0];
  return [...views, { ...primary, id: `${primary.id}-board`, name: "Board", kind: "board", groupBy: key }];
}

// ── plants ────────────────────────────────────────────────────────────────
const PLANTS: SeedSpec[] = [
  { title: "Papaya", emoji: "🌿", text: { "Botanical Name": "Carica papaya", "Plant Height": "6 to 10 m" },
    opts: { "Difficulty Rating": ["Easy Plant"], "Living space": ["Outdoor"], "Plant Type": ["Tree"], Lifespan: ["Perennial"], "Planting Time": ["Summer"], "Bloom Time": ["All year around"], Sunlight: ["Full sun", "Part sun"], Water: ["Consistently moist soil"], Toxicity: ["Non-toxic"] } },
  { title: "Weeping fig", emoji: "🌿", text: { "Botanical Name": "Ficus benjamina", "Plant Height": "7 to 30 m" },
    opts: { "Difficulty Rating": ["Easy Plant"], "Living space": ["Indoor", "Outdoor"], "Plant Type": ["Tree"], Lifespan: ["Perennial"], "Planting Time": ["All year around"], "Bloom Time": ["Summer"], Sunlight: ["Full sun", "Part sun"], Water: ["Partially dry soil"], Toxicity: ["Toxic to animals"] } },
  { title: "Monstera", emoji: "🌿", text: { "Botanical Name": "Monstera deliciosa", "Plant Height": "1 to 3 m" },
    opts: { "Difficulty Rating": ["Easy Plant"], "Living space": ["Indoor"], "Plant Type": ["Vine"], Lifespan: ["Perennial"], "Planting Time": ["All year around"], "Bloom Time": ["Non-blooming"], Sunlight: ["Part sun", "Part shade"], Water: ["Regular misting"], Toxicity: ["Toxic to humans", "Toxic to animals"] } },
  { title: "Snake plant", emoji: "🌿", text: { "Botanical Name": "Dracaena trifasciata", "Plant Height": "30 to 100 cm" },
    opts: { "Difficulty Rating": ["Easy Plant"], "Living space": ["Indoor"], "Plant Type": ["Herb"], Lifespan: ["Perennial"], "Planting Time": ["All year around"], "Bloom Time": ["Non-blooming"], Sunlight: ["Part shade"], Water: ["Dry topsoil"], Toxicity: ["Toxic to humans", "Toxic to animals"] } },
];

function withPlantSeeds(graph: ObjectGraph): ObjectGraph {
  const relKey = relKeyByName(graph);
  const pool = poolByRelKey(graph);
  const seeds = PLANTS.map((s, i) => buildSeed(graph, relKey, pool, `seed-plant-${i}`, s));
  return { ...graph, objects: [...graph.objects, ...seeds], set: { ...graph.set, views: ensureBoard(graph, graph.set.views, "Living space") } };
}

// ── movies ────────────────────────────────────────────────────────────────
const GENRES: { name: string; color: TagColor }[] = [
  { name: "Sci-fi", color: "blue" }, { name: "Drama", color: "red" }, { name: "Dramedy", color: "green" },
  { name: "Documentary", color: "yellow" }, { name: "Romance", color: "pink" }, { name: "TV series", color: "teal" },
];
const MOVIES: SeedSpec[] = [
  { title: "Her", emoji: "🎬", text: { Rating: "⭐⭐⭐⭐" }, num: { "IMDb rating": 8, "Rotten Tomatoes rating": 95 }, opts: { Genre: ["Drama", "Romance"], Status: ["To Do"] } },
  { title: "La Grande Bellezza", emoji: "🎬", num: { "IMDb rating": 7.7, "Rotten Tomatoes rating": 87 }, opts: { Genre: ["Dramedy"], Status: ["Done"] } },
  { title: "Koyaanisqatsi", emoji: "🎬", num: { "IMDb rating": 8.2, "Rotten Tomatoes rating": 90 }, opts: { Genre: ["Documentary"], Status: ["Done"] } },
  { title: "Can't Get You Out of My Head", emoji: "🎬", num: { "IMDb rating": 8, "Rotten Tomatoes rating": 82 }, opts: { Genre: ["TV series"], Status: ["In Progress"] } },
];

function withMovieSeeds(graph: ObjectGraph): ObjectGraph {
  const genreKey = "genre";
  const relations: Record<string, RelationMeta> = { [genreKey]: { key: genreKey, name: "Genre", format: "tag" }, ...graph.relations };
  const genreOpts: Record<string, OptionRef> = {};
  const byName: Record<string, string> = {};
  GENRES.forEach((g, i) => {
    const id = `gopt-${i}`;
    genreOpts[id] = { id, name: g.name, color: g.color, relationKey: genreKey };
    byName[norm(g.name)] = id;
  });
  const options = { ...graph.options, ...genreOpts };
  const g2: ObjectGraph = { ...graph, relations, options };

  // The gallery stays faithful (title + genre); grid/list/board show more.
  const rich = ["genre", "status", "imdbRating", "rottenTomatoesRating"].filter((k) => relations[k]);
  const views = g2.set.views.map((v) => (v.kind === "gallery" ? { ...v, visibleRelations: ["genre"] } : { ...v, visibleRelations: rich }));

  const relKey = relKeyByName(g2);
  const pool = poolByRelKey(g2);
  const augmented = g2.objects.map((o) =>
    o.title.startsWith("2001") ? { ...o, cells: { ...o.cells, [genreKey]: makeCell(relations[genreKey], [byName["sci-fi"]], options) } } : o,
  );
  const seeds = MOVIES.map((s, i) => buildSeed(g2, relKey, pool, `seed-movie-${i}`, s));
  return { ...g2, objects: [...augmented, ...seeds], set: { ...g2.set, views: ensureBoard(g2, views, "Status") } };
}

export function withSeeds(graph: ObjectGraph): ObjectGraph {
  if (graph.space === "plant_database") return withPlantSeeds(graph);
  if (graph.space === "movie_database") return withMovieSeeds(graph);
  return graph;
}
