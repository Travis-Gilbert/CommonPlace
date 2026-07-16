# Complete the UI-sourcing addendum: 7 libraries, nothing deferred

Branch `feat/register-presence-consolidation`. User directive (2026-07-12):
install/import the REAL library everywhere (never hand-roll an equivalent);
every library ships MOUNTED; where the backend or consuming surface does not
exist, BUILD it; nothing is deferred. Constraints: Tailwind v4 register
utilities only (no raw CSS), no fake UI / no mock data (real state/endpoint).

Presence mark + textmode.js already shipped (prior work). This plan is the
remaining 6 rows (pts is reference for the mark's motion; eternal is the
data-canvas north star = the one genuine from-scratch build).

## Real install methods (verified 2026-07-12)

- tablecn: `npx shadcn@latest add https://diceui.com/r/data-table` (sadmann7, copy-in over `@tanstack/react-table` ^8.21.3 already installed). Needs `nuqs` NuqsAdapter for URL table state.
- linear-combobox: copy `damianricobelli/shadcn-linear-combobox` component (uses installed `cmdk` + `components/ui/command.tsx`). Do not add a dep.
- blocks: `npx shadcn@latest add https://blocks.so/r/{name}.json` (ephraimduncan). Configure `@blocks` registry in `components.json`.
- pdfx: `npx pdfx-cli add <component>` — copies components built on `@react-pdf/renderer` (add that dep). MIT, no runtime dep on pdfx itself.
- maily.to: `pnpm add @maily-to/core @maily-to/render`. HAZARD: Tiptap peer — repo is `@tiptap/core` 3.27.3 (patched); maily may pin a different tiptap major. Reconcile peers before install lands (see tiptap-peer-locking gotcha in CLAUDE.md).
- pts: `pnpm add pts`.

## Consuming surfaces + backends (what to build where)

1. **tablecn** -> real tabular surfaces that already have data: `components/v2/record-table/*`, `app/v2/ledger`, `app/v2/db`, operator run lists, capture queue, inbox. Replace hand tables with the tablecn DataTable, fed by the existing block-view / records data. Register-utility styled.
2. **linear-combobox** -> real property/tag/status pickers on records (block-view property edit, tag selection). Wire to real object-property mutations.
3. **blocks** -> `app/v2/settings`, `app/v2/account` exist; onboarding / auth (`src/app/api/auth` exists, no UI) / pricing / designed empty-states do NOT -> BUILD those surfaces with blocks, wired to real auth (`[...nextauth]`) + real state. Empty states replace populated-looking fakes.
4. **pdfx** -> BUILD a Brief export path: a real `brief` document (galley / markdown-theory doc) renders to PDF via a route/action using pdfx components. Backend: export endpoint that pulls the real brief doc.
5. **maily.to** -> BUILD the email seam: Django (publishing_api or research_api) send path for welcome / digest / waitlist. maily editor authors the template; `@maily-to/render` -> HTML -> real `django.core.mail` send. Service-tier auth stays server-side (CLAUDE.md rule): no SMTP creds in the frontend.
6. **pts** -> wire into a real motion surface (Presence mark choreography enhancement, or a real ambient/loading surface). Not decorative-only.
7. **eternal** (from scratch) -> the data-canvas north star: a real node-liveness canvas surface. Build against real graph/data, register-styled.

## Execution order (slices, each ends wired + build-green + browser-verified)

- [ ] Slice A: linear-combobox (smallest, real picker) -> proves copy-in + register-utility wiring pattern.
- [ ] Slice B: tablecn -> records/ledger real data (highest reuse).
- [ ] Slice C: blocks -> settings/account + build auth/onboarding/pricing/empty-state surfaces on real auth.
- [ ] Slice D: pdfx + Brief export backend.
- [ ] Slice E: maily.to + Django email send seam (server-side).
- [ ] Slice F: pts motion wiring.
- [ ] Slice G: eternal-inspired data canvas (from scratch).

## VERIFIED GROUNDING (2026-07-12 execution pass, /execute)

Deep read of the real code corrected the Slice A assumptions. Three findings:

1. **`linear-combobox` is built.** `apps/web/src/components/ui/combobox.tsx` is the
   reference pattern adopted onto the existing `Command` (cmdk) + `Popover`
   (Base UI) + `Button` primitives: a controlled `{options, value, onChange}`
   single-select with `--tag-*` colored dots. No dep added, no hand-roll. `tsc
   --noEmit` clean. It is a library primitive, NOT yet consumed by a user
   surface (honest state: unmounted).

2. **The plan's named consumer was wrong about editability.** `database/cells.tsx`
   renders on `/v2/db/[space]` via `DatabaseSurfaceView`, which passes only
   `host.graph` (immutable) to `DatabaseView` and DROPS the host's `emit`. That
   surface is read-only, and its data is a bundled Anytype export (movie/plant
   demo space), so it is a fixture/developer surface, not the product acceptance
   target. The host-connected `renderers/` set (whose `BoardView` proves
   `host.emit({kind:"update", id, patch:{[key]:[optId]}})`) has NO user-reachable
   mount.

3. **The real acceptance surface is `/v2/records` -> `RecordTable`.** It is live
   (`createWorkBlockHost` -> `/api/theorem/objects/*` -> the Rust `commonplace-api`
   axum service), its view descriptor already declares `update` in its emit
   contract, and its `CellEditor` already commits real mutations via
   `host.emit({kind:"update"})`. The gap: `InlineEdit` has no select/enum branch
   and the served `ObjectShape.fields` are bare field-name strings. Enum is
   modeled as a `Constraint {kind:"enum", values}` on the type contract
   (`block-view/types.ts`), NOT surfaced in the query-response shape.

**Real mount path for `Combobox` (couples Slice A into Slice B, which owns the
record-table + its contract):**
- Backend (build, not defer): `apps/commonplace-api` surfaces enum constraints
  for select/status fields in the `/objects/query` response shape (field ->
  optional `{kind:"enum", values}` + option colors).
- FE: `columnsFromShape` carries the enum options onto `ColumnMeta`; `CellEditor`
  routes enum `propType` to `<Combobox>`; commit uses the existing
  `host.emit({kind:"update", id, patch})` path (single-select -> scalar value).
- Verify against the running Rust service (localhost:50090) at `/v2/records`.

Nothing deferred: the combobox exists; its live mount is a real backend+FE task
folded into Slice B because both land on `RecordTable`.

## Hazards / coordination

- Codex mobile WIP is uncommitted in the tree (root `package.json` + `package-lock.json`). `pnpm add` in apps/web touches `apps/web/package.json` + `pnpm-lock.yaml` (NOT root package-lock.json), so no overlap — but stage explicitly (never `git add .`) and keep Codex's root files out of every commit.
- Railway standalone install uses `apps/web/package-lock.json`; new deps must sync there too or the deploy drifts (PR#35 lesson).
- tiptap peer reconciliation for maily is the main install risk.
