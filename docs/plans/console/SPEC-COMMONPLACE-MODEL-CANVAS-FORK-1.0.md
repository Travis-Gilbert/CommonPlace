# SPEC-COMMONPLACE-MODEL-CANVAS-FORK-1.0

2026-07-28. `Travis-Gilbert/CommonPlace`, `Travis-Gilbert/Theorem`. Architecture decision plus execution handoff. Deliverables MF1 through MF7.

The verdict on OWOX/models: hard fork, adopted as the model-canvas surface, with the registry as the only model truth and the fork's own package boundaries as the cut lines. Supersedes the from-scratch model-canvas construction in `SPEC-MODEL-CANVAS-RECORDS-1.0` (MC1); carries that spec's MC2 through MC5 forward as the customization list. The records surface RT1 through RT7 is untouched. Dispositions for every other candidate library are recorded here so none of them reopens unlabeled.

`CONVENTIONS.md` applies.

## Frame

What OWOX/models actually is, verified today. A three-package pnpm monorepo, Apache 2.0 as of June 25, 2026, NOTICE © 2026 OWOX, active within the last twelve hours at 332 commits. `packages/okf` is a pure library, `ModelGraph` to and from an OKF markdown bundle, no I/O. `packages/web` is a React plus Vite plus React Flow SPA: the Miro-like canvas, a field-level ERD view with columns, primary keys, and join keys, an inspector, a template library, OKF import and export, shareable URL-encoded models, and, landed June 29, a models rail with version history and a structural diff that compares versions by tables, fields, and joins. `packages/server` is a Fastify proxy for the OWOX product API. And OKF, the Open Knowledge Format, is an open specification published by Google: a data model as a folder of Markdown files with YAML frontmatter, one document per model object, a schema table, and a Joins section, designed to be human-reviewable in a pull request and authorable by agents, which is exactly the alignment with the harness's native use of it.

Why hard fork rather than vendor-and-track. The customizations are structural, not cosmetic: the persistence layer, the model truth, and the push target all change. But the upstream is active and well-factored, so the fork keeps the upstream remote and cherry-picks canvas improvements where they still apply, which is the practical middle between a dead snapshot and a tracking burden.

The cut lines the repo hands over. Keep `packages/okf` nearly intact as the interchange library. Keep `packages/web` as the surface and gut its edges: Supabase optional accounts, PostHog, the Gemini insight-questions call, and Push-to-OWOX all go day one, along with all of `packages/server`. What replaces them is the console's existing doors: persistence through the object seam the JSON Canvas rail already uses, identity through the console session, and Push becomes Declare, the MR5 promote path into the schema registry.

The one law that makes the fork safe. **Semantic truth lives in the registry; the canvas document holds layout and nothing else.** This is the same rule the program canvas already enforces, layout never in the content identity. Their Supabase `models` table stored the whole ModelGraph as one blob; the fork splits it: object types, fields, and relations are registry state read through the observed and declared lenses, while positions, collapse states, and visual annotations persist as a canvas document. Their version-history feature gets better under this law, not worse: the graph already versions every declaration, so their structural diff UI re-seats over registry version pairs and their `model_versions` table is deleted rather than ported.

The reconciliation with `SPEC-MODEL-CANVAS-RECORDS-1.0`, stated plainly. MC1 built this canvas from scratch on xyflow; the fork supersedes that construction, and an amendment on that spec says so. MC2's ObjectTypeCard anatomy, MC3's field-anchored relation edges with cardinality, MC4's observed ghosts with pin-to-declare, and MC5's live counts survive as the customization program applied to the fork's node and edge components, which is less work against a working canvas than it was against a blank one.

And the backend that has been waiting for this. `theorem-canvas-compile` in the Theorem tree, compile, driver, invalidation, scheduler, registry, surface, is the reactive canvas-compilation pipeline whose spec implemented the backend without a frontend. The fork is that frontend. Its exact contract is a Verify First read, not an assumption here.

## Named choices

1. **Hard fork with a live upstream remote.** Vendored into `Travis-Gilbert/CommonPlace` as `packages/model-canvas`, Apache 2.0 obligations kept: LICENSE and NOTICE preserved, modifications noted, upstream remote retained for cherry-picks.
2. **The registry is the only model truth.** The canvas reads observed and declared lenses and writes through generated tools; Declare replaces Push; no model blob store exists anywhere in the fork.
3. **Layout is a canvas document.** Persisted through the object seam under the console principal and workspace, the same door and durability floor as `canvas.inspector.rail`, id-namespaced per model view.
4. **OKF is the model interchange.** The registry gains import and export of OKF bundles through the fork's `okf` package semantics: agents author OKF, review happens in text, the canvas renders it, Declare lands it. The harness's existing OKF usage and this bridge are wired as one thing, not two.
5. **Their diff UI over graph versions.** The structural tables-fields-joins diff survives as the comparison surface between registry versions; their snapshot table does not.
6. **The gut list is day one.** `packages/server`, Supabase, PostHog, Gemini calls, Push-to-OWOX, and URL-blob sharing all removed before any feature work; sharing returns later as console-native links to registry state.
7. **MC2 through MC5 are the customization program.** Card anatomy, field-anchored cardinality edges, ghosts with pin-to-declare, and live counts, applied to the fork's components under console tokens.
8. **Every candidate library gets a recorded disposition.** Adopted, quarry, or declined, with reasons, in this spec and mirrored in the engines-registry document, so the survey never silently reruns.

## Deliverables

### MF1. Vendor and gut

`packages/model-canvas` in CommonPlace

The fork lands building and running inside the console workspace: upstream remote configured, LICENSE and NOTICE preserved with a modifications note, the gut list removed, the app boots to an empty canvas served inside the console shell with no external calls of any kind.

Accepted when the package builds in the console's pnpm workspace, a network trace of a full session shows zero third-party calls, and the Apache notices survive intact.

### MF2. Persistence through the object seam

`packages/model-canvas`, console-host

Layout documents persist via the console host to the object seam under the authenticated principal and workspace, debounced on structural edits exactly as the JSON Canvas rail does, surviving refresh, logout, and Railway restart.

Accepted when a moved card's position returns after a hard refresh and a re-login, and the persisted document contains layout only, verified by inspection against the no-semantics law.

### MF3. Registry binding, read

Observed and declared lenses

The canvas renders the registry: declared object types as full cards, observed-only types as ghosts, fields with the generated `FieldType` driving icons and formatting, relations as field-anchored edges with cardinality, live counts per MC5's shape.

Accepted when a declared type edited through any other door appears on the canvas without reload ambiguity, a ghost renders for an observed-only type, and the ERD field view shows real fields typed by the generated union.

### MF4. Declare, the write path

MR5 promote through generated tools

Pin-to-declare from a ghost and field-level edits flow through the registry's write tools with receipts; Push-to-OWOX's interaction slot becomes Declare; refusals surface in-card with the reason named.

Accepted when declaring a ghost creates the registry entry with a receipt, an edit conflict surfaces the registry's refusal verbatim, and no write path bypasses the generated tools.

### MF5. The OKF bridge

Registry import and export, harness alignment

OKF bundle import creates or updates declared state through the same write tools with a dry-run diff first; export produces a bundle that round-trips; the harness's native OKF touchpoints are located and re-pointed at this one bridge.

Accepted when an agent-authored OKF bundle imports with a visible diff and receipts, an exported bundle re-imports to identity, and the harness's OKF path and the canvas's are demonstrably the same code.

### MF6. Version diff over graph versions

Their diff surface, registry history

The structural diff UI compares any two registry versions of the model by tables, fields, and joins, entered from the models rail's history, with restore expressed as a new declaration batch, never a blob overwrite.

Accepted when two known registry versions diff correctly in the UI, and a restore lands as receipted declarations that the diff then shows as the new current.

### MF7. canvas-compile wiring

`theorem-canvas-compile`, per its spec

The fork's surface registers as a consumer of the compile pipeline per the crate's actual contract, read first: compiled projections, invalidation-driven refresh, and limits honored, so the canvas participates in the reactive system rather than polling beside it.

Accepted per the canvas-compile spec's own acceptance shape once read, with the minimum being: a registry change invalidates and recompiles the canvas's projection without a manual refresh.

## Candidate dispositions

- **obsidianmd/jsoncanvas**: adopted already, format only, as the rail Z-layer wire. Unchanged.
- **OWOX/models**: hard fork, this spec.
- **FallenDeity/DataCanvas**: quarry, declined as a base. It is a whole Next.js application, its own NextAuth, its own Postgres schema, its own provisioning, stale two years at 32 commits, and every organ, schema graph, SQL editor, data grid, duplicates a surface this system owns in better shape, the fork, the pg-server door, the RT records series. Its graph-schema interaction patterns may be borrowed by eye.
- **TonyGermaneri/canvas-datagrid**: declined. The records surface stays on the RT series; and the TypeScript wish has a standing answer recorded for the day DOM grids hit a wall: Glide Data Grid, MIT, TypeScript, canvas-rendered, maintained. Candidate, not adoption.
- **nocode-js/sequential-workflow-designer**: quarry only. The program canvas spec owns workflow surfaces, and its semiring program graph is strictly richer than a sequential designer's model.
- **AykutSarac/jsoncrack.com**: inspiration only for JSON payload visualization in inspectors; its license is verified before any code moves, and nothing moves in this spec.
- **1jehuang/mermaid-rs-renderer**: evaluation candidate for the render worker, server-side Mermaid for documents and canvas mermaid nodes; maturity and coverage verified before adoption, recorded in the engines registry either way.

## Verify First

- The `theorem-canvas-compile` spec and `driver.rs` contract before MF7 claims its integration shape.
- Where the harness natively uses OKF today, files and code paths, so MF5 re-points reality rather than a memory.
- The fork's `ModelGraph` type coverage against the generated `FieldType` union: composites, enums, and whatever the registry expresses that data marts do not, so MF3's mapping is written down before code.
- The `packages/okf` library's runtime assumptions, whether it runs server-side in the worker for MF5 or stays client-side with the registry doing its own serialization.
- The exact object-seam document shape and id conventions the JSON Canvas rail persists with, so MF2 shares the door identically.
- Upstream's cadence and openness to patches, in case any customization, the diff-over-versions seam especially, is upstreamable the way the Servo seam is.
- jsoncrack's current license terms, before its disposition line is ever revisited.

## Anti-scope

- No `packages/server` survival, no Supabase, no analytics, no third-party AI calls from the fork.
- No model semantics in any canvas document, and no blob store of models anywhere.
- No second model canvas: MC1's from-scratch build ends, by amendment on its spec.
- No records-surface changes; RT1 through RT7 stand.
- No adoption of the declined candidates without reopening their disposition lines by name.
- No OKF divergence: the bundle format tracks the published specification, and extensions go through the registry's types, not through format forks.
