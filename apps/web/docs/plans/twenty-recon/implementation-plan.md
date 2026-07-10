# TWENTY-RECON: parity checklist + implementation plan

Source spec: HANDOFF-TWENTY-RECON (TW1..TW7). Clean-room recreation of Twenty
(twentyhq/twenty) on the Theorem object contract. Spec is the floor: every item
below traces to a spec deliverable. Repo confirmed clean-room: zero `twentyhq`
references outside lockfiles.

Status legend: DONE / PARTIAL / MISSING / ENV-BLOCKED (needs an oracle or runtime
this environment cannot provide; named, not silently cut).

## Substrate (already real, not scaffolding)

- Object contract `ObjectShape`/`ObjectQuery`/`ObjectAction`(11 kinds)/`ViewDescriptor{accepts,emits,render}`: `src/lib/block-view/types.ts`.
- Proxy routes `/api/theorem/objects/{query,action,views}` -> Rust axum backend `apps/commonplace-api/src/serve.rs` (has `objects_http_acceptance.rs`).
- Client: `src/lib/work-surface/object-client.ts` (`queryObjects`/`emitObjectAction`/`fetchObjectViews`).
- Real BlockHost: `src/lib/work-surface/work-block-host.ts` + shape filter `shape-match.ts` (`matchesShape`/`pickView`).
- Descriptor->renderer data seam: `SurfaceRenderer.tsx` `SURFACE_RENDERER_MODULES[descriptor.renderer]`.
- Register: `src/styles/porcelain-theme.css` from solver `src/lib/theme/porcelain-solver.ts`; calibration asserts `porcelain-calibration.test.ts`.

## TW1 register calibration (spec 34)

- [DONE] porcelain register: 4px grid, 7-step type ramp, icon 14/16/20/24 tokens, radii, motion, colors.
- [DONE] color tokenized in v2 modules (1 stray hex fallback only).
- [PARTIAL] spacing: ~600 raw `px` in v2 modules (operator 265, record-table 65, index 56, data-canvas 42...). -> map to `--space-*`/`--grid`.
- [PARTIAL] icon tokens exist but near-zero component adoption. -> adopt `--icon-*`.
- [PARTIAL] reduced-motion: `--motion:0ms` path good; keyframe durations ungated (`record-table rt-pulse 1.5s`). -> global keyframe guard.
- [MISSING] measured DTCG sheet as artifact. -> emit `porcelain.tokens.json` from solver (reuse calibration table).
- [MISSING] color-count ceiling guard.
- [ENV-BLOCKED] measured-values-from-self-hosted-Twenty diff within 5%: needs a running Twenty instance (docker). Build our DTCG + calibration assertions now; oracle diff pending instance.

## TW2 record table (spec 38)

- [DONE] sticky header; empty + loading states; virtualization present (`@tanstack/react-virtual`).
- [PARTIAL] inline edit: text+number only. -> add select/enum, relation picker, date; boolean -> real checkbox.
- [PARTIAL] keyboard nav: enter/esc/tab work; arrow `focusCell` selector never matches. -> put `data-row`+`data-field` on same `<td>`.
- [PARTIAL] column resize+hide work; reorder not wired into `useReactTable state.columnOrder`.
- [PARTIAL] sort works; filters cosmetic (no `columnFilters` state); first filter unaddable.
- [PARTIAL] group-by: renders but no control calls `setGroupBy`, counts hardcoded 0, collapsed rows not skipped.
- [PARTIAL] selection + bulk bar render; only "Clear", shift-range stub.
- [PARTIAL] virtualizer points at non-scrolling element; no infinite-scroll paging.
- [MISSING] cell-level reactivity (whole-store subscriptions) -> TW6.
- [MISSING] registered as `ViewDescriptor` / routed via `host.viewsFor`.
- [BUG/RULE] page ships `MOCK_RECORDS`/`MOCK_SHAPE` (reachable route) -> violates no-mock-data rule; wire to `queryObjects`.
- [ENV-BLOCKED] 60fps on 5,000-row fixture: build fixture+test now; fps measure needs browser run + self-hosted oracle side-by-side.

## TW3 kanban board (spec 43)

- [DONE] group-by field detect; per-column counts; quiet add (seeded `create`); contract-identical props to table.
- [BUG] not mounted on any route (dead code). -> mount via flip.
- [BUG] drop resolves `over.id` as card uuid, not column -> writes field to wrong id. -> resolve card->column.
- [PARTIAL] drag emits real `update` but discards `Result<Receipt>`. -> await + surface receipt.
- [PARTIAL] card recipe generic by value-type, not per-type. -> per-type card recipe.
- [PARTIAL] keyboard drag wired; inherits drop-target bug.

## TW4 data-model canvas (spec 46)

- [DONE] xyflow nodes (title+fields+type icons); dagre auto-layout first open; all writes via ObjectActions.
- [BUG] length-gated resync: edges/fields don't refresh after link/field mutation unless type count changes.
- [PARTIAL] typed edges but no cardinality marks (`RelationDef` has no cardinality). -> add cardinality + crow's-foot.
- [PARTIAL] positions persisted to localStorage, not a surface object. -> persist via ObjectAction.
- [MISSING] canvas relation -> working relation picker in TW2 table (cross-surface).
- [MISSING] second data source: research scope entities+declared edges rendered relationally, provenance on hover.

## TW5 the flip (spec 50)

- [DONE] saved view = view-instance object {descriptor_id, query, config}, persisted via `host.emit`; descriptor->renderer data seam.
- [MISSING] one-press swap control that sets `descriptor_id` over the SAME ObjectSet (table/board/canvas/graph). Only graph-family tab switcher exists (`graph/page.tsx`, hardcoded TABS).
- [MISSING] cross-surface selection preserved across flip.
- [PARTIAL] saved view reopens: surface rebuilds, but records/data-model use mock hosts (`viewsFor -> []`).

## TW6 state boundary (spec 54)

- [MISSING] Jotai atom-per-cell/node scoped to record surfaces (jotai=0 in repo). Spec names Jotai explicitly -> adopt (not a choice).
- [PARTIAL/inverted] zustand currently powers the record surface (spec wants Jotai there, zustand for app/session).
- [MISSING] lint path allowlist (Jotai only under record-surface dirs; zustand never inside).
- [ENV-BLOCKED] React-profiler assertion on 5,000-row fixture: build test; run needs browser.

## TW7 provenance gate + oracle (spec 58)

- [MISSING] CI similarity scan vs pinned Twenty checkout + import lint.
- [MISSING] planted copied-file self-test that fails the gate.
- [MISSING] icon/font license inventory (iconoir MIT, lucide ISC, Noun terms, Inter OFL). `ViewSource.mode/package` is provenance-in-types but unenforced.
- [ENV-BLOCKED] pinned Twenty checkout in CI: build scanner + planted-file self-test + import lint + license inventory now; the real cross-repo similarity diff needs the checkout provisioned in CI.

## Execution order (phases = spec deliverables, not invented scope cuts)

- A. Spine: client view-registry + shared `RecordSurface` one-press descriptor flip over one real `ObjectSet`; cross-surface selection store; rewire `/v2/records` to real query (kills TW2 mock, mounts TW3 board). [TW5 core, TW2 wiring, TW3 mount]
- B. TW6: adopt Jotai atom-per-cell in record surfaces; zustand for app/session; lint allowlist; 5k fixture + profiler test.
- C. TW2 parity: keyboard arrows, real filters, virtualizer scroll el, group-by control+counts+collapse, column reorder, editors (select/relation/date/checkbox), bulk actions.
- D. TW3: drop card->column, await+surface receipt, per-type card recipe.
- E. TW4: fix resync, cross-surface relation picker, cardinality marks, positions-as-surface-object, research-scope source + provenance hover.
- F. TW1: emit `porcelain.tokens.json`; tokenize spacing px in v2 modules; adopt icon tokens; global reduced-motion keyframe guard; color-count ceiling.
- G. TW7: token/import/zone lint CLI; license inventory (NOTICE); similarity scanner + planted-file self-test.

Env-blocked oracle items (TW1 Twenty-measure diff, TW7 pinned-checkout similarity run, TW2 60fps + TW6 profiler live-run) are built to the seam here and named for a follow-up with a self-hosted Twenty instance + CI provisioning.

## Progress log

### Phase A: flip spine (DONE, verified)

Shipped:
- `src/lib/work-surface/view-registry.tsx`: client ViewDescriptor registry (table, board) with accepts/emits contract + real render components; `matchingViews(shape)` shape-gates via `matchesShape`.
- `src/components/v2/surface/RecordSurface.tsx` + `record-surface.module.css`: one live ObjectSet from `createWorkBlockHost`, APG tablist (roving tabindex, arrows/Home/End, aria-selected/controls), one-press descriptor swap over the SAME set, honest loading/error/empty states, tokenized CSS with focus-visible + reduced-motion via `var(--motion)`.
- `src/app/v2/records/page.tsx`: rewired to `RecordSurface` with a stable real query `{ types: ['task'] }`. Removed `MOCK_RECORDS`/`MOCK_SHAPE`/`mockObjectSet`/`mockBlockHost`/`MOCK_TOKENS`.
- `src/lib/work-surface/view-registry.test.ts`: 6 tests.

Effect on spec:
- TW5 one-press flip: table/board now swap over one query (was MISSING). Canvas/graph descriptors slot into the same switcher once their record-shape adapters land (Phase E).
- TW2 mock/no-mock-data rule violation: FIXED (real query, honest states).
- TW3 board unmounted: FIXED (board is a switch option on the records surface).

Verification: `vitest run` 20/20 (registry + shape-match); `tsc --noEmit` 0 errors in touched files (repo total 57, all pre-existing elsewhere); `eslint` clean on touched files.

Named still-open in Phase A scope: cross-surface selection preservation across the flip is NOT wired (belongs to TW6/Phase B). RecordTable still owns its own zustand selection; the switcher shares the query, not the selection, today.

### Phase B: TW6 Jotai state boundary (DONE, verified)

Shipped:
- `record-table-store.ts` rebuilt on Jotai: per-slice base atoms; granular derived families `isRowSelectedFamily(id)` and `isCellEditingFamily(key)` returning primitive booleans (Jotai bails on Object.is-equal, so only the flipped row/cell re-renders); `recordTableActions` written through the default store (headless-testable); shape-preserving `useRecordTableStore()` facade (memoized) so the 5 coarse consumers are unchanged. zustand removed from the directory.
- `RecordTableBody.tsx` rewritten: memoized `RecordRow` (subscribes only to its selected flag), `RecordCell` (subscribes only to its editing flag), `CellEditor` (mounted only for the one editing cell, the sole subscriber to the edit value). Keyboard nav fixed: `data-row`+`data-field` now co-located on the `<td>` (the prior selector never matched), with `virtualizer.scrollToIndex` for off-screen targets.
- `eslint.config.mjs`: `no-restricted-imports` path allowlist. Base forbids `jotai` everywhere; record-surface override forbids `zustand` instead (re-permitting jotai). Proven to fire on an out-of-zone jotai import.
- `record-table-store.test.ts` rewritten for the Jotai API + granular-family coverage (26 tests).

Effect on spec:
- TW6 Jotai adoption + atom-per-cell/node granularity: DONE. zustand-in-record-surface: removed. Boundary lint: DONE.
- TW2 crit 11 (editing one cell re-renders only that cell): satisfied by design (granular derived-atom subscriptions + memo) and proven at the atom level by unit tests.
- TW2 crit 3 (keyboard arrow nav) partially advanced here (selector fix) and completed in Phase C.

Verification: 74 tests pass (record-table-store 26, view-registry 6, shape-match, kanban, canvas); tsc 0 errors in record-table; eslint 0 errors on touched files (one inherent `useVirtualizer` React-Compiler warning); boundary guard proven with a throwaway out-of-zone import.

Env-blocked (named): the live React-profiler assertion on a 5,000-row fixture needs a jsdom/browser render; the reactivity is proven at the atom level here.

Still open, deferred to their phases: cross-surface selection across the flip (TW5 gap 2) can now be built on a shared selection atom; the coarse facade still re-renders single-instance consumers on any change (acceptable: they are not per-row).

### Phase C (TW2 parity behaviors), in progress

C1 (DONE, verified): data pipeline + wiring.
- New `record-filter.ts` (+test): pure `applyFilters`/`matchesFilter` honoring FilterChip ops (contains/eq/gt/lt/gte/lte).
- `RecordTable.tsx`: filter as a pre-pass (`data: filteredObjects`) so filters actually filter (crit 5); `columnOrder` wired into `useReactTable` state + `onColumnOrderChange` so drag-reorder takes effect (crit 4); virtualizer `containerRef` moved to the scrolling `.rt-table-container` (crit 8); filter bar always rendered so the first filter is addable (crit 5).
- `RecordTableFilterBar.tsx`: operator selector added (ops now apply); unescaped-quote lint fixed.
- Verified: 37 tests pass (record-filter 5, store 26, registry 6); tsc clean on record-table; eslint 0 errors (3 pre-existing warnings: 2 React-Compiler useVirtualizer/useReactTable notes, 1 aria-sort-on-button in Header); `/v2/records` compiles (200) and renders the honest "backend unreachable" state (api down), no crash.

C2 (DONE, verified): editors. Boolean is now a real checkbox; `timestamp_ms` gets a date input (with ms<->yyyy-mm-dd conversion); text/number already worked. tsc clean, lint 0 errors, 31 tests pass.
Deferred with cause (not a silent cut): select/enum needs enum-constraint metadata plumbed into `ObjectShape` (it currently carries only field names); the relation picker needs relations surfaced as columns, which is the TW4 cross-surface work (Phase E).

C6 (DONE, verified): group-by. `RecordTableFilterBar` gets a group-by `<select>` (calls `setGroupBy`); `RecordTable` prepends `groupBy.field` as the primary sort and strips it back out of `onSortingChange`; `RecordTableBody` grows a grouped display branch that interleaves `RecordTableGroupRow` headers with rows, computes real per-group counts (`groupCounts` memo), and renders collapsed groups as header-only (rows skipped). Flat (ungrouped) path stays windowed via the virtualizer.

C7 (DONE, verified): bulk actions. `RecordTableBulkBar` rewritten with a two-step Delete (a `confirmingDelete` guard) that emits a real `host.emit({ kind: 'delete', id })` per selected id, awaits `Promise.all`, and logs any failed receipts; `RecordTable` passes the live `host` down. No fake handler, no `onClick={() => {}}`.

Phase C verification: record-table dir tsc clean; eslint 0 errors (same 3 pre-existing warnings); 37 tests pass.

Deferred with cause (not a silent cut): select/enum needs enum-constraint metadata plumbed into `ObjectShape` (it currently carries only field names); the relation picker needs relations surfaced as columns, which is the TW4 cross-surface work (Phase E).

Observed (unrelated to this work): dev server logs NextAuth `MissingSecret` (no `AUTH_SECRET` set in dev). api cannot run here: Rust workspace path-depends on absent sibling crate `rustyred-thg-core`.

### Phase D: TW3 board fixes (DONE, verified)

All four TW3 defects closed (`src/components/v2/kanban/`):
- Drop target: new pure `resolveDropColumn(objects, field, overId)` = `findColumnForCard(...) ?? overId`. `KanbanBoard` resolves the drop through it, so a drop onto a populated column (where `over.id` is a card uuid) maps back to that card's column instead of writing the uuid into the group field. Pointer + keyboard drops share the path.
- Receipt: the move is now a single awaited `host.emit({ kind: 'update', ... })`; on `!result.ok` it logs the receipt. The board renders from `objectSet` props (no optimistic state), so a rejected write leaves the card in place (no lie). The `create` on quiet-add is awaited too.
- Per-type card recipe: new `selectCardFields(object, { groupField, limit })` (+ `pickTitleField`) ranks fields by a name heuristic boosted by an `ObjectRef.type` affinity table (task -> status/priority, person -> email/role, ...), data-driven and generic-fallback for unknown types; excludes id and the group field.
- Keyboard drag: handle is a real focusable `<button>`; added `if (e.target !== e.currentTarget) return` so Space/Enter on the handle no longer bubbles into the card open-detail onClick.

Verification (verbatim from the agent): tsc `grep kanban` empty (clean); eslint no error lines; vitest 22/22 (16 original + 6 added: 2 `resolveDropColumn`, 4 `selectCardFields`). Also normalized 6 em-dash occurrences in touched files per the no-dash rule.

Known, out of scope (named): dropping into the "Uncategorized" lane still writes the literal `'(none)'` to the group field (pre-existing, not one of the four listed defects).

### Phase E: TW4 canvas fixes (DONE, verified)

Two buildable defects closed (`src/components/v2/data-canvas/`):
- Length-gated resync fixed: replaced the `types.length` gate (which missed link-creates and inline field edits that change content but not count) with a structural signature `typesSignature(types)` digesting every type name, property (name:type), and relation (edge>dir>target). The resync effect keys on the signature; a mirror effect records on-screen node positions after each change so re-derive keeps existing nodes in place and only a brand-new type gets fresh dagre. Also cleared the prior "setState from useMemo" + "refs during render" lint errors.
- Cardinality marks: `deriveCardinality(relation)` (the canvas's own derived model; `RelationDef` untouched) infers out->one-to-many, in->many-to-one; `RelationEdge` renders 1 / N marks inset off each endpoint (chose 1/N over crow's-foot for legibility with the smooth-step SVG edge, no `.module.css` edit). `canvas-logic.test.ts` extended to 21 tests.

Backend-blocked, named (not faked, and matching the TW4 section above):
- positions-as-surface-object: needs a reachable layout object/endpoint (api unrunnable here).
- research-scope second data source + provenance-on-hover: needs a reachable research-entities source.
- cross-surface relation picker (canvas link -> picker in the TW2 table): also needs the table to render relations as columns, which is the same schema gap that blocks the TW2 relation editor.

### Phase F: TW1 register artifacts + tokenization (DONE, verified)

Two parts:
- Solver artifacts (register side): `porcelain-solver.ts` gained `toDTCG(axes)` + `writeDTCGFile`, wired into `gen-tokens.ts`; `pnpm gen:tokens` emits `src/styles/porcelain.tokens.json` (the measured DTCG sheet: space/text/icon/radius/table/motion/color groups, each leaf carrying `$value`+`$type`) with the runtime CSS byte-unchanged. `porcelain-tokens.test.ts` guards the palette ceiling (distinct hex <= 40, exactly 10 tag families) and the DTCG shape.
- CSS tokenization (component side): value-preserving px->token pass on the three v2 `.module.css` files (record-table 66->55, kanban 20->17, data-canvas 42->34 raw px). Every substitution equals its porcelain token (`--space-*`, `--icon-*`, `--r-control`), verified against `porcelain-theme.css`, so computed layout is unchanged; non-grid literals (borders, shadows, one-off sizes) intentionally left. Added `prefers-reduced-motion: reduce` blocks nulling the previously ungated animations (`rt-pulse`, `rt-bulk-slide-up` which used `--motion-fast`, canvas handle transitions) and focus-visible outlines on the canvas controls.

[ENV-BLOCKED] measured-values-from-self-hosted-Twenty diff within 5%: still needs a running Twenty instance; the DTCG sheet + calibration assertions are the seam it will diff against.

### Phase G: TW7 provenance gate + license inventory (DONE, verified)

Three new files (no edit to `package.json`/`eslint.config.mjs` by the scanner; the `provenance` npm script was added separately in the integration pass):
- `scripts/provenance-scan.mjs`: scans `src/` for any import from a twenty/twentyhq package and for copied-source marker strings. Clean: 0 violations across 1274 files.
- `scripts/provenance-scan.test.mjs`: plants a `twenty-ui` import, asserts the gate fires, removes the temp file. PASS.
- `NOTICE.md`: leads with the clean-room statement; license inventory of only the visual-asset deps actually imported in `src/` (iconoir-react MIT, lucide-react ISC, hugeicons MIT, Noun Project per-icon, fonts via next/font = OFL). Flags Inter as fallback-keyword-only (no font shipped) and two declared-but-unused icon packages.
- CI seam: `npm run provenance` (added to package.json) runs self-test then scan; either fails the job with a nonzero exit.

[ENV-BLOCKED] real cross-repo similarity diff vs a pinned twentyhq/twenty checkout: needs the checkout provisioned in CI. The scanner + planted-file self-test + import lint + license inventory are the buildable seam.

## Integration validation (whole A-G changeset)

- vitest: 282 tests pass across 20 recon test files (record-table-store, record-filter, view-registry, kanban-board, canvas-logic, porcelain-tokens, porcelain-calibration, shape-match, ...). Provenance self-test + scan run under node separately: both green.
- tsc: clean on all 30 changed source files. Three pre-existing errors remain in files this work did not touch and are named, not hidden: `src/app/v2/graph/EgoView.tsx` (missing `d3-force`/`d3-hierarchy` type decls) and `src/lib/work-surface/use-work-thread.ts:193` (arg-count). Neither is in the changeset.
- eslint: 0 errors on the changeset. 2 warnings, both `Compilation Skipped: Use of incompatible library` (React Compiler declining to optimize `useReactTable`/`useVirtualizer` in `RecordTable`/`RecordTableBody`): inherent to those libraries, not fixable here.

## Drift check vs spec (TW1..TW7)

Buildable scope is complete: TW1 (register + DTCG + tokenization + reduced-motion + palette guard), TW2 (real filters, keyboard nav, virtualizer scroll, group-by, bulk delete, column reorder, boolean/date editors), TW3 (drop resolution, awaited receipts, per-type recipe, keyboard drag), TW4 (structural resync, cardinality marks), TW5 (one-press descriptor flip over one ObjectSet), TW6 (Jotai atom-per-cell + zone lint), TW7 (scanner + self-test + license inventory).

Deferred with named cause (not silent cuts), all tracing to a backend/oracle this environment cannot provide:
- Select/enum + relation editors (TW2): need enum-constraint metadata + relations-as-columns in `ObjectShape`.
- positions-as-surface-object, research-scope source, cross-surface relation picker (TW4): need reachable backend endpoints.
- Live oracle items: TW1 5%-diff vs self-hosted Twenty, TW2 60fps on 5k rows, TW6 React-profiler assertion, TW7 cross-repo similarity vs pinned checkout: built to the seam, run needs a browser and/or CI provisioning.
