# RESUME — v2 porcelain→register migration

Start here after a context reset. Full plan: `implementation-plan.md` (same dir).

## One-line state

The **Index (`/v2`)** is fully built and fully off porcelain (register/`cr-*`),
and the **register now carries status + tag color scales** (the prerequisite is
done, light register, WCAG-verified, tag chips already consumed by the Stream and
Table lenses). The other **17 v2 surfaces are still porcelain**. Next task:
migrate surfaces (reskin-only ones directly; library-adoption lenses go through
the design gate), and land the cr **umber** register with the first machine
surface (Operator/Workrooms).

## Register status + tag palettes: DONE (light), verified

- **Files:** `src/styles/console-register-status.css` (raw `--cr-*` status + tag
  values, hand-authored companion to the generated `console-register.css`),
  re-exported as Tailwind utilities in `global.css` `@theme`
  (`bg-cr-ok` / `text-cr-attention` / `bg-cr-tag-red-soft` /
  `border-cr-tag-red-line`, `-soft`/`-line` derived via `color-mix`), mirrored
  into the block-view channel (`console-tokens.ts`), imported in
  `src/app/layout.tsx` after `console-register.css`.
- **Status = 4 steps under the reserved red signal:** `--cr-waiting` (teal) ->
  `--cr-progress` (navy) -> `--cr-attention` (amber) -> `--cr-signal` (red, kept),
  plus `--cr-ok` (green) off the ladder. Ported from porcelain `--teal/--navy/
  --amber/--ok`.
- **Tags = 10 hues** ported from porcelain `--tag-*`. Deterministic tag->hue via
  `src/lib/v2/tag-color.ts` (djb2), rendered by the shared
  `src/components/v2/TagChip.tsx`. Unit-tested (`tag-color.test.ts`, 5 passing).
- **WCAG:** ok/amber/yellow/green deepened (`#3B7648 / #8E6212 / #846611`) so
  every fg clears 4.5:1 on the darkest ground (`--cr-ground`); the rest were
  already clear. Verified with an oklch->sRGB contrast script; deepened chips
  re-checked (>= 4.55:1).
- **Named gaps (honest state):**
  - **Tag chips render but no live tag data:** live `/v2` is publish-state atoms
    with empty tags, so no chips show on the real surface yet (proven with an
    ephemeral browser probe, not shipped). They appear the moment tagged objects
    exist. Do NOT fabricate tags (No Fake UI).
  - **Status utilities are wired but dormant:** no surface consumes `bg-cr-ok`
    etc. yet, so Tailwind tree-shakes those `--color-cr-*` vars (exactly like the
    pre-existing dormant `--color-cr-signal-pressed`). Proven-by-construction +
    raw tokens verified live; screenshot proof lands with the first
    status-bearing surface (Operator).
  - **umber (dark) status/tag deferred on purpose:** the cr register has no dark
    ground, so dark status hues would render broken. porcelain's umber is a
    per-container `[data-register='umber']` opt-in (only `v2/graph/page.tsx` uses
    it today). The cr umber register (base + status/tag) lands with the
    machine-surface migration, where a dark ground exists to sit them on.

## Done (verified live, lint clean)

- **IX7 Index surface** (destination rail with counts + filtering, watch queries
  = saved searches in localStorage, filing-rationale "Why here" + Signals
  disclosure, sticky small-caps dividers).
- **Composable lens-index v1**: `src/lib/v2/lenses/{types,registry,layout-store}`
  + `src/components/v2/index/{IndexComposition, lenses/StreamLens, lenses/TableLens}`.
  Widget = `(query, lens, config)`; index = serializable tiling of widgets
  (localStorage `v2:index:layout`); data-driven add-view picker; per-widget lens
  switch; cross-lens shared selection → inspector. Default assembly = Stream+Table.
- **Full register reskin of the Index**: `IndexRail`, `IndexDetail`,
  `IndexSurface` chrome, `v2/page.tsx`, `ActiveRoomsBand` all `cr-*`;
  `index.module.css` deleted; `IndexList.tsx` deleted. Zero
  `styles.`/porcelain-token/`p-band`/`p-row` under the Index.
- **`--spacing-cr-*` namespace** added to `global.css` (generates
  `p/px/py/gap/m/w/h-cr-N`); removed the old one-off `@utility gap-cr`/`p-cr`.

## Design gate WAIVED for lens adoption (user, this session)

The user waived the apps/web design gate for this lens-adoption work: no design
synthesis, no proposal-approval step. The binding rule is **no hand-rolling**:
adopt/import the real vetted library directly, then customize + theme to `cr-*`.
See memory [[v2-lens-adoption-no-design-gate]]. Still binding: No Fake UI / No
Mock Data (data-driven lens availability, honest empty states), no dashes.

## Board (Kanban) lens: DONE

- `@dnd-kit/core` (installed) adopted directly. Columns = destinations (+ trailing
  Unfiled), cards = rows with tag chips, cross-column drag = refile via the
  shell's `submitRefile` (real edit + training signal). Files:
  `src/components/v2/index/lenses/KanbanLens.tsx`, pure grouping in
  `src/lib/v2/lenses/kanban-columns.ts` (unit-tested, 5 passing), registered in
  `registry.tsx` as `board` (available when `hasDestination`). `LensProps` grew an
  optional `onRefileRow`; wired in `IndexSurface` (`handleRefileRow`).
- **Verified:** unit tests (grouping multi-column + Unfiled-last + override-aware;
  refile-target same/Unfiled no-op); live render + cr theming (screenshot: a
  register column of cards); availability gating (Board hidden from the picker on
  destination-less live data). **Not shown:** a live multi-column board + drag,
  because the live briefing carries no destinations (data thinness, same as tags);
  forcing the rich fixture needs a full reload, which the App Router route cache
  fights. Grouping/refile logic is unit-proven; DnD is @dnd-kit.

## Next: remaining lenses + surfaces (adopt directly, no gate)

- **Lenses to adopt** (libs installed unless noted): Text = CodeMirror (+
  coss.com/ui toolbar), Chat = `@assistant-ui/react`, Canvas = `@xyflow/react`
  (+ jsoncanvas), Mail/compose = shadcn mail + `maily` (needs install). Each a
  widget conforming to `LensProps`, cr-themed, data-driven availability.
- **Fold** Data/Tables/Graph standalone surfaces into starter assemblies over the
  lenses rather than reskinning them (throwaway).
- **cr umber register** (base ground + status/tag umber) lands with the first
  machine surface (Operator / Workrooms), where a dark ground exists.
- Confirmed: **mono stays JetBrains** (register default) for metadata.

## Then (rollout order)

Migrate surfaces smallest-first (see plan table): records, db, chat, ledger,
files, timeline(skip), text, board, data-canvas, kanban, workrooms, work, graph,
record-table, operator. Adopt lenses from the user's MIT/Apache sources:
Table=`tnks-data-table`, Kanban=`recursive-dnd-kanban-board`, Canvas=`eternal`
+`jsoncanvas`+react-flow, Text=CodeMirror+`coss.com/ui` toolbar, Chat=assistant-ui,
Toasts=`goey-toast`, Mail/compose=shadcn v3 mail + `maily.to`, blocks=`ephraimduncan/blocks`
+`coss.com/ui`. Each becomes a lens/widget, register-themed, hand-rolled surfaces deleted.

Index-specific remaining: maily compose (Mail) lens; global-rail collapse-to-icons
on the Index; composition nesting/orientation (v1 is a flat horizontal row).

## Gotchas / conventions

- Live briefing returns the same item in multiple bands → `allRows` has dup ids.
  Stream keys by `indexRowKey` (band:id); Table dedupes by id + TanStack `getRowId`.
- localStorage stores use `useSyncExternalStore` (SSR-safe, lint-clean) — NOT
  `useEffect(setState)` (React-Compiler error `set-state-in-effect`).
- No `Date.now()`/impure calls in render (React-Compiler error). Snapshot via
  `useState(() => Date.now())` or an effect.
- Reset component state on selection via a remount `key`, not a reset effect.
- Live data is currently thin (publish-state atoms, no destinations) — the
  destination rail shows only "All" live; per-destination rows appear when items
  carry collections. Don't fabricate (repo rule: No Fake UI).
- Verify: dev server `web` (port 3000) via preview_start; `/v2` at 1440×900;
  console errors are all pre-existing auth `MissingSecret` (ignore).
- Registry casing load-bearing: tenant `Travis-Gilbert`.
- Tailwind v4 tree-shakes `@theme` variables: a `--color-cr-*` var is emitted to
  `:root` only when a utility that references it is generated from scanned source.
  So a correctly-defined register token reads `(empty)` in the browser until a
  component consumes its utility. Prove register tokens with a real consumer, not
  by reading the var in isolation (the pre-existing `--color-cr-signal-pressed`
  is also dormant/empty for the same reason).
- Dynamic Tailwind class names do NOT generate: `bg-cr-tag-${hue}` is invisible
  to the scanner. Spell every class out (see `CR_TAG_CHIP` in `tag-color.ts`) so
  the utilities actually exist. This is why the hue->class map is a literal table.
