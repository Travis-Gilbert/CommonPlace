# HANDOFF-CANON

One system per job, enforced. Plus the single addition that earns its slot: the Path lens, taken from Clew and generalized. Repo `Travis-Gilbert/CommonPlace`, `apps/web`. Depends on HANDOFF-CONSOLE-REGISTER (the lint pattern this copies), HANDOFF-STAGE-LIVE SL0 (the motion cut already named), HANDOFF-TWENTY-RECON TW2 (the table canon). Tenant slug casing is load-bearing: `Travis-Gilbert`.

## The finding

Clew (miuuyy/Clew, MIT, July 2026) is an AI-drafted prerequisite-graph workspace: click a topic, see the chain that unlocks it. Two facts decide what to take.

First, its whole frontend runs on five dependencies: `react`, `react-dom`, `three`, `katex`, `@phosphor-icons/react`. The graph canvas is hand-rolled on three.js. No graph library, no state library, no UI kit, no motion library. `apps/web` currently carries roughly 150 runtime dependencies and six overlapping graph systems.

Second, Clew's actual mechanism already exists in the Theorem substrate, three times over:

| Clew move | Already shipped |
|---|---|
| click a topic, reveal the prerequisite chain | `why_derivation_trace` (ancestor chain as a WhyTrace tree) |
| how far am I from the goal | `fold_semiring` with `semiring_kind: "tropical"` (shortest path over the same edges) |
| what is blocked, what can I do now | `plan` queries `blocked_set`, `next_actionable`, `frontier`, `progress` |
| AI drafts, human reviews, rolls back | `programmable_graph` proposals plus graph-version commit, diff, checkout |
| Obsidian in and out | `apps/obsidian-sync`, `upsert_note` wikilink reconciliation |
| MCP context bridge | the harness is one |

So Clew is a learning-shaped UI over machinery already built. Nothing gets adopted. One interaction gets taken, and it is better on Theorem data than on Clew's, because these ancestor chains are derived (assumptions, contradictions, supersessions, real prerequisites) rather than LLM-drafted.

## Governing principle

One job, one system. The dependency tree failed the same way the CSS failed: nothing prevented the next addition, so every session added its own. The cure is the same as CR1's literal lint. Name the canonical system per job as data, delete the alternates on evidence, and gate the tree so the sixth graph library cannot land. Removal without a gate is temporary.

## Part A: The Path lens

### PL1. The path adapter
Build: `pathTo(nodeId, scope)` in the web app, composing existing tools with no new backend: `why_derivation_trace` for the ancestor chain, `fold_semiring` (tropical) for distance-to-target, and for plan scopes the `blocked_set` and `next_actionable` queries for readiness. Returns `{ chain: NodeRef[], depth, distance, status: "ready" | "blocked" | "done", blockedBy: NodeRef[] }`. One adapter, per-scope resolvers.
Acceptance: `pathTo` on a derivation node returns the same chain `why_derivation_trace` returns, with a tropical distance attached; on a plan task it returns the blocking set matching `blocked_set`; adding a scope requires a resolver, not a new tool.

### PL2. The lens
Build: a `path` ViewDescriptor over the canonical graph renderer (`@cosmos.gl/graph`), not a new canvas. On selection: dim every non-ancestor to ground, light the chain in ink, weight edges along the chain, order the chain by topological depth, and render a readout line (depth, distance, blocked-by count). Escape clears. Registered against any graph-shaped ObjectSet so it inherits every future graph surface (the WS3 fallback path already routes ObjectSets to `views_for(shape)`).
Acceptance: selecting a node dims the field and lights exactly its ancestor chain; the readout matches PL1's values; the lens renders on a derivation graph, a plan graph, and a memory graph with no per-surface code.

### PL3. The nouns
Build: four scopes at launch, each a resolver plus a label: derivation ("why this is believed"), plan ("what blocks this"), memory ("what supports this claim"), code ("what reaches this symbol", over the code graph). Curriculum is the fifth and optional: a `topic` document type with a `PREREQUISITE` edge in the HANDOFF-DOCUMENT-TYPES registry, which makes Clew's entire product a document type in the taxonomy rather than an app.
Acceptance: the same lens answers all four questions with only the scope changing; the readout wording comes from the scope's label, not from a branch in the renderer.

### PL4. Draft, review, apply, roll back
Build: Clew's second good idea, on substrate that exists. A dump (topic list, note set, project scope) drafts a DAG proposal through the existing proposal path; the lens renders it as a diff (proposed nodes and edges in signal, existing in ink); apply commits through graph-version; the Timeline scrub rolls it back. No new persistence, no new review UI beyond the diff rendering on the lens.
Acceptance: a drafted DAG renders as a reviewable diff before any write; applying produces a graph-version commit; scrubbing back restores the prior graph exactly.

## Part B: The canon

### C1. The canon registry
Build: `packages/canon/canon.json`: for each job, one `canonical` package, a `banned` list with a one-line reason each, and an `undecided` list pending C2. Jobs: graph-render, graph-edit, graph-algorithms, charts, data-grid, motion, icons, dnd, ui-primitives, rich-text, code-editor, markdown-render, pdf-generate, pdf-read, browser-ml, state. Human-readable, agent-readable, and the source the C4 lint consumes.
Acceptance: every runtime dependency in `apps/web` resolves to exactly one job as canonical, banned, or undecided; the file is the only place the decision lives.

### C2. Evidence before deletion
Build: a scan script producing, per candidate package, the importing files (ripgrep over `src`, plus a `knip` or `depcheck` pass) and a verdict: unused, used-in-legacy-surface, used-in-live-surface. Nothing is deleted on assumption; the unread surfaces (`(studio)`, `(networks)`, `(spacetime)`, `theseus`) are exactly where a blind delete breaks something.
Acceptance: the scan output names every importer of every banned package; a package with zero importers is deletable immediately; a package with importers gets a migration line in C3.

### C3. The cuts
Build: land per group, tests green between groups, never one big-bang PR.

- **Graph render.** Canonical `@cosmos.gl/graph`. Cut `sigma`, `@react-sigma/core`, `@sigma/edge-curve`, `react-force-graph-3d`, `d3-force-3d`. Keep `@xyflow/react` (different job: node editing, TW4). `graphology` survives only if something other than sigma needs its data structure.
- **Graph algorithms.** Canonical: RustyRed, server-side (PPR, communities, and the rest already run there). Cut `graphology-communities-louvain`, `graphology-metrics`, `graphology-layout-forceatlas2`. Client-side Louvain over a graph the substrate already partitions is duplicate math.
- **Browser ML.** Cut `@tensorflow/tfjs`, all eight `@tensorflow-models/*`, both `@mediapipe/*`, `@mlc-ai/web-llm`, and the six TF overrides. Decide `@huggingface/transformers`: it survives only if on-device embedding at capture time is a live commitment; otherwise it goes and returns when that lands.
- **Motion.** Canonical `motion` plus `animejs` v4 (SL0). Cut `framer-motion` (the same library installed twice) and `gsap`. Decide `tw-animate-css` against the register's own motion tokens.
- **Icons.** Canonical: the Noun set through `export-icons.mjs`. Cut `lucide-react`, `iconoir-react`, `@hugeicons/react`, `@hugeicons/core-free-icons`, `react-native-vector-icons`, and the `@blocksuite/icons` override. This is a migration, not a delete: `StreamLens.tsx` imports lucide today.
- **Charts.** Pick one. `@observablehq/plot` matches the d3 canon; the `vega` plus `vega-lite` plus `vega-embed` trio is three packages for the same job. Cut the loser.
- **Data grid.** Canonical `@tanstack/react-table` plus `@tanstack/react-virtual` (TW2's engine, already installed). Cut `@glideapps/glide-data-grid`.
- **Drag and drop.** Canonical `@dnd-kit/*`. Cut `@hello-pangea/dnd`.
- **UI primitives.** Three overlapping installs (`@base-ui/react`, the unified `radix-ui`, and ten individual `@radix-ui/react-*`). Pick one shape and cut the other two.
- **Rich text.** Canonical Tiptap (y-tiptap, mention, and tables are already wired). Cut `@blocksuite/presets` and `@blocksuite/store` unless C2 finds them load-bearing.
- **Markdown.** Canonical `@travis-gilbert/markdown-theory`. Cut `react-markdown`, `remark-html`, and `highlight.js` (markdown-theory carries Shiki). Keep `remark` and `remark-gfm` only where the spine needs them directly.
- **PDF.** Generation is the D9 Typst path; cut `jspdf`. Keep `pdfjs-dist` for reading.
- **Wrong runtime.** `@rneui/base`, `@rneui/themed`, and `react-native-vector-icons` are React Native kits inside a Next web app (mobile lives in `apps/mobile`); `@inkjs/ui`, `@assistant-ui/react-ink-markdown`, and `update-notifier` are CLI-surface packages. C2 confirms, then they go.
- **luma.gl.** Four packages plus six overrides pinned at 9.2.6. Keep only if the geospatial renderer imports them; the scan decides.

Acceptance: after each group, `pnpm test`, `pnpm lint`, `pnpm test:e2e`, and the register snapshots stay green; the runtime dependency count and the size-limit numbers both drop measurably per group; no live surface loses a capability.

### C4. The gate
Build: `scripts/lint-canon.mjs`, mirroring `lint:register`: fails CI when any file imports a banned package, when a package.json dependency is absent from `canon.json`, and when a new dependency lands without a job entry. Wire into `lint` and the CI workflow.
Acceptance: adding sigma back fails CI with the canon reason printed; adding a genuinely new package fails until it is classified; the gate's own test plants a banned import and expects red.

### C5. The budget
Build: `size-limit` thresholds per entry surface (console, public site, desktop export), set just under current post-cut numbers so regrowth trips before it ships.
Acceptance: the budget file names each surface; a deliberate re-add of a heavy package trips the budget in CI.

## Verify first

- The four unread route groups (`(studio)`, `(networks)`, `(spacetime)`, `theseus`) drive most of C2's verdicts; scan before deciding anything in C3.
- Whether `@cosmos.gl/graph` covers the embedding-scatter job `embedding-atlas` does today; if it does, that is a thirteenth cut, and if not, embedding-atlas is canonical for that job and stays.
- Whether the vector graph view and the Path lens can share one cosmos instance or need two configs; PL2 assumes one renderer, many descriptors.
- Whether BlockSuite backs a live editor surface or is a stranded experiment.
- `@huggingface/transformers` and the offline-Keep decision; this is a product call, not a lint call.

## Where it lands

The tree stops being a museum of every idea any session had, and the one idea worth keeping from Clew arrives as a lens instead of an app: select anything, anywhere, and see the exact chain that leads to it, with the distance and the blockers named. The five-minute test: run the scan, delete the first group, watch the bundle drop and the tests stay green, then click a claim in the graph and watch everything that is not its ancestry fall away.
