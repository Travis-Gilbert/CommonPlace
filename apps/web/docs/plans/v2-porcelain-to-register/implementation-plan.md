# v2 → Composable Lens-Index over RustyRed

Supersedes the earlier "port porcelain CSS to the register" framing. That was
the wrong primary goal. The real work: make `/v2` a **composable lens front-end
over the RustyRed substrate**, built from real component libraries (no
hand-rolling), themed to the console register. The porcelain→register migration
and the hand-rolled-surface deletion ride along as consequences.

## Architecture: three layers, one composition model

| Layer | What it is | Status |
|---|---|---|
| **Substrate** | RustyRed / THG: typed objects + edges + algorithms (PPR, similarity, communities). Provides the *scoring primitives*. | exists |
| **Intake** | Connectors + the filing engine: email/tasks/GitHub/etc. become *typed objects, filed*. Orchestrates RustyRed's scorer (routing-with-abstention) into destinations + zones + a feedback loop. | HANDOFF-INDEX IX1-IX6 (backend track, separate) |
| **Lens front-end** | The Index: a user-assembled composition of lens-widgets over the filtered substrate. Where the component libraries live. | this plan |

Key seam: RustyRed is **not** the CRM/task/email app; it is what those are built
on. "CRM/tasks/email" = object types + connectors on the substrate. The Index is
the lens layer that makes them usable.

## The composition model

- **Widget = `(query, lens, config)` = a saved view.** `query` is a watch
  query / `objectQueryForView` binding; `lens` is a component; `config` is
  lens-local (columns, sort, grouping).
- **Index = a serializable composition of widgets** (a tiling tree). Persisted
  per-user (localStorage now, backend later).
- **Lens availability is data-driven, per widget.** A lens is offered only when
  the bound query's objects carry the fields it needs:
  `status → Kanban`, `dates → Calendar`, `xy/graph → Canvas`,
  `rows → Table`, `thread → Mail`, anything → Stream.
- **Presets are seed assemblies.** "Data", "Board", the daily-driver triage:
  each is a default composition the user can duplicate and edit. Never a blank
  Index.
- **Suggested widgets.** The system proposes lenses the current data can fill
  ("12 tasks with due dates → add a Calendar?").

### Decisions (locked; revisit only with cause)

- **Composition primitive:** nested `react-resizable-panels` (tiling tree), the
  layout serialized as the index document. Already the v2 layout lib; no
  hand-rolled grid engine. v1 that landed is a flat horizontal row; nested tiling
  and orientation are the planned extension, not yet shipped. (Bento grid is a
  later option if tiling constrains.)
- **Cross-linking (linked widgets):** deferred to a fast-follow, but the widget
  contract exposes an optional `selection` publish/subscribe from day one.
  Mechanisms already in-repo: the `commonplace:*` CustomEvent bus + the Mosaic
  `Selection` cross-filter from the cosmos work.
- **Theming:** everything lands on the console register (`cr-*`). Porcelain is
  deleted, not ported.
- **No hand-rolling:** reuse existing primitives + adopt the sources below.
  Timeline is skipped.

## Reuse, don't rebuild (existing in-repo primitives)

- **Layout / composition:** `react-resizable-panels` (nested groups): the
  tiling tree. Prior art: CommonPlace's JSON-serializable split-pane binary tree.
- **Query binding:** `block-view` / `objectQueryForView` (contract-first fetch,
  shared cache → widget fetch dedupe).
- **Canvas substrate:** existing `data-canvas` (xyflow) becomes the Canvas lens.
- **Index data seam:** `lib/commonplace/index-queries.ts` (already built:
  bands, destinations, watch queries, refile-as-training-signal, fixture→live
  fail-open). Watch queries become the widget `query`.

## Lens / component source map

| Lens or role | Source | License/adoption | Notes |
|---|---|---|---|
| Index shell + **Mail lens** | shadcn v3 `examples/mail` + `maily.to` | shadcn = copy-in; maily = repo, vet | Index customized from the mail example; maily for compose |
| **Table lens** (= "Data view") | `tnks-data-table` | vet | one component, many scopes |
| **Kanban lens** | `recursive-dnd-kanban-board` | repo, vet | status-bearing objects |
| **Canvas lens** | `eternal` (reference) + `jsoncanvas` + react-flow | port-then-edit | pair with existing data-canvas |
| **Text editor** | CodeMirror + `coss.com/ui` toolbar | npm + copy-in | follow CodeMirror's setup docs exactly |
| **Chat** | assistant-ui | npm | all chat surfaces |
| **Toasts** | `goey-toast` | repo, vet | confirmations / errors |
| Primitives / blocks | `ephraimduncan/blocks`, `coss.com/ui` | copy-in, pre-green-lit | grab-bag |
| ~~Timeline~~ | n/a | n/a | skipped |

## v1 vertical slice (proves the whole model on one screen)

Ship the Index as the **lens-composition shell** with three real lenses:

1. **Shell:** global rail collapses to icons on the Index; Index gets its own
   contextual sub-rail (destinations + saved views + add-widget); on the shadcn
   mail base; register-themed.
2. **Stream lens:** the IX7 triage work, reskinned porcelain → `cr-*`.
3. **Table lens:** `tnks-data-table` bound to a query, register-themed.
4. **Compose (planned, not in the landed slice):** `maily.to` / mail compose as
   the Mail lens seed; needs the `maily` install.
5. **Composition:** add/remove/resize widgets in a tiling tree; layout persists;
   the add-widget picker only offers lenses the bound data can fill; ship one
   default assembly (the daily-driver triage) so first run is never blank.

### v1 acceptance

- Add a Table widget over a real query; it renders live rows; remove it; layout
  persists across reload.
- The add-widget picker hides Kanban/Calendar when the data lacks status/dates
  (data-driven availability provably works).
- Stream + Table coexist in one Index, both live, both register-themed.
- No porcelain tokens, no `index.module.css`, no hand-rolled table/kanban.
- Contrast + focus + reduced-motion hold (register is WCAG-solved; keep it).

## Register prerequisite: DONE (light register), verified

The register grew a **status scale** (`--cr-waiting/progress/attention` ←
porcelain `teal/navy/amber`, plus `--cr-ok` ← porcelain `ok`, all under the
reserved red `--cr-signal`) and a **tag scale** (10 hues ← porcelain `--tag-*`).

- Hand-authored raw values live in `src/styles/console-register-status.css` (a
  companion to the generated `console-register.css`, which the markdown-theory
  `console` fixture emits with no status/tag axis, so it cannot host them and a
  regenerate would erase hand-edits). Re-exported as Tailwind utilities in
  `global.css` `@theme` (`-soft`/`-line` derived via `color-mix`) and mirrored
  into the block-view channel (`console-tokens.ts`). Imported app-wide in
  `src/app/layout.tsx`.
- **WCAG:** every foreground clears 4.5:1 on the darkest register ground
  (`--cr-ground`); ok/amber/yellow/green were deepened (`#3B7648 / #8E6212 /
  #846611`) to get there. Verified with an oklch->sRGB contrast script.
- **Consumers:** shared `TagChip` (`src/components/v2/TagChip.tsx`) +
  deterministic `tagHue` (`src/lib/v2/tag-color.ts`, djb2, unit-tested) render
  tags as hued chips in the Stream and Table lenses.
- **Deferred, on purpose (named):** the cr **umber** (dark) status/tag lands with
  the first machine surface, where a dark cr ground exists to sit dark hues on
  (porcelain's umber is a per-container `[data-register='umber']` opt-in, used
  only by `v2/graph`). Status utilities are wired but dormant until a
  status-bearing surface consumes them (Tailwind tree-shakes unused theme vars).
- Mono stays **JetBrains** (the register default) for metadata; no reface needed.

## Rollout

**Status (2026-07-12):** v1 composition slice landed and verified live. The Index
is now a composition of lens widgets: lens contract + registry
(`src/lib/v2/lenses/`), Stream lens (reskinned porcelain→cr-*, `p-band/p-row`
dependence dropped, `IndexList.tsx` deleted), Table lens (TanStack, register,
data-driven columns), layout store (localStorage, persists across reload),
add/remove/switch widgets, data-driven add-view picker, cross-lens shared
selection → inspector. Register `--spacing-cr-*` namespace added to `global.css`.
**The whole Index is now off porcelain**: rail (`IndexRail`), inspector
(`IndexDetail`), shell chrome (`IndexSurface`/`page.tsx`), and the rooms strip
(`ActiveRoomsBand`, decoupled from `operator.module.css`) are all `cr-*`;
`index.module.css` deleted; zero `styles.`/porcelain-token/`p-band`/`p-row`
references remain under the Index. Lint clean (only the inherent TanStack
`useReactTable` compiler warning). Still to do (rollout): the maily compose lens;
the global-rail collapse-to-icons on the Index; composition nesting/orientation.

1. ~~**v1 slice** (Index shell + Stream + Table + compose + default assembly).~~ Done.
2. ~~**Register prerequisite** (status + tag scales).~~ Done (light register,
   WCAG-verified, tag chips consumed by Stream + Table lenses; umber + status
   consumer deferred as named above).
3. Adopt remaining lenses from the source map as widgets. Each themed to `cr-*`,
   each a widget, adopted directly (design gate WAIVED by the user this session:
   no synthesis, just import the vetted library + customize; no hand-rolling).
   - ~~**Board (Kanban)** = `@dnd-kit/core`~~ Done: columns = destinations,
     drag = refile via `submitRefile`, `KanbanLens.tsx` + pure `kanban-columns.ts`
     (unit-tested), registered `available: hasDestination`.
   - Remaining: Text = CodeMirror, Chat = `@assistant-ui/react`, Canvas =
     `@xyflow/react` (+ jsoncanvas), Mail = shadcn mail + `maily` (needs install).
4. Fold the old top-level surfaces (Data, Graph, Tables) into **starter
   assemblies** (Data = Table lens over everything; Graph = Canvas/Graph lens).
5. **Linked widgets** fast-follow: turn on `selection` publish/subscribe.
6. **Deletion endgame:** remove porcelain imports from `app/v2/layout.tsx`;
   delete `porcelain-theme.css`, `porcelain-surfaces.css`, the 18 `*.module.css`,
   and unused `.p-*` classes. Final grep gate: zero
   `--plane|--raised|--edge|--well|p-band|p-row|\.module\.css` under `src/**/v2`.

## Risks / open

- **Scope is a platform.** Guard with the v1 slice + default assemblies; don't
  build all lenses before the composition model is proven on Stream + Table.
- **Per-widget fetch fan-out** → rely on the `block-view` shared-cache seam; dedupe
  by query.
- **License vetting** on each GitHub source at adoption (kanban, eternal,
  goey-toast, maily); shadcn/coss/blocks are copy-in and pre-green-lit.
- **Mono:** settled as JetBrains (the register default); no reface. Kept here only
  as the record of a closed decision.
- Non-v2 surfaces (main-site parchment) are out of scope.
