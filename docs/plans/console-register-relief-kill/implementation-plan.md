# v2 shell → Tailwind register utilities (the CSS work that needs to happen)

Supersedes this file's earlier raw-CSS relief-kill plan. That approach was
abandoned: the project direction is Tailwind v4 register utilities, no raw CSS
(see `docs/learnings/2026-07-12-verify-styling-architecture-before-css-migration.md`
and `apps/web/CLAUDE.md` > Visual Design & CSS). Converting a surface to
register utilities kills relief by construction (utilities can only use register
tokens), so this migration IS the relief-kill, done correctly.

Branch base: `feat/register-presence-consolidation` (merge `5923357` + rule
`28b0a74`, pushed).

## Phase 0 — extend the register utility layer (prerequisite, do first)

The Tailwind mapping in `apps/web/src/styles/global.css` (`@theme`) currently
exposes only `--color-cr-*`, `--radius-cr-*`, `--text-cr-*`, `--font-cr-*`, plus
a few hand `@utility` rules (`gap-cr-1..4`, `p-cr-2..4`, `h-row`, `px-chip`,
`shadow-transient`, `duration-chrome`). There is NO full spacing/sizing scale,
so surfaces cannot be expressed in lint-legal utilities yet. Nothing consumes
the existing hand spacing utilities (grep-verified zero), so they can be
replaced.

- [ ] Add `--spacing-cr-1..6: var(--cr-space-1..6)` to `@theme`. Tailwind v4
      generates the whole spacing family (`p-cr-*`, `px-cr-*`, `m-cr-*`,
      `gap-cr-*`, `w-cr-*`, `h-cr-*`, `space-y-cr-*`) from one `--spacing-*` entry.
- [ ] Remove the now-redundant hand `@utility gap-cr-1..4` / `p-cr-2..4` (keep
      `h-control`, `h-row`, `min-h-row`, `px-chip`, `py-chip`, `shadow-transient`,
      `duration-chrome`).
- [ ] Add named layout sizes that recur (e.g. rail width) so components avoid
      arbitrary `w-[216px]` (banned by the register lint).
- [ ] Verify: `node scripts/lint-console-register.mjs` stays clean; build green.

## Phase 1 — convert the shell (highest leverage, already half-done)

`V2Shell.tsx` content sheet is already on utilities. Remaining: `Rail.tsx`
(uses `.p-rail`/`.p-nav`/`.p-navitem`/`.p-sec`/`.p-raildiv` from the two
porcelain CSS files). Reproduce `console-shell.css`'s register look as utilities
(it is the already-correct target: sidebar=ground, tint-fill active nav, no
relief), handling `data-collapsed` (`data-[collapsed]:w-cr-...`), active
(`data-[active=true]:bg-cr-tint`), and the section `::after` divider
(`after:*`).

- [ ] Convert `Rail.tsx` to register utilities.
- [ ] Delete the `.p-*` frame rules from `console-shell.css` and
      `porcelain-surfaces.css` (both now redundant once Rail is utilities).
- [ ] Browser-verify: sidebar full-bleed on ground, sheet rounded seam, nav
      tint-fill active, flat (no wells), collapsed rail works.

## Phase 2 — convert the ~21 content surfaces

Each: rewrite `className={styles.x}` → register utilities in the `.tsx`, delete
the `.module.css`, browser-verify. Spacing moves from porcelain's 8px `--u` grid
onto the register lh rhythm (CR3 intent) — a reflow, not a pure swap. Order by
visibility/relief-weight:

- [ ] `components/v2/index/index.module.css` (Index, CR5 north-star)
- [ ] `app/v2/operator/operator.module.css` (heaviest, 49 relief usages)
- [ ] `lib/block-view/database.module.css` + `lib/block-view/database/database.module.css`
- [ ] `components/v2/record-table/record-table.module.css`
- [ ] `app/v2/graph`, `timeline`, `files`, `chat`, `ledger`
- [ ] `components/v2/work` (+ `work/board`, `work/text`), `app/v2/workrooms`, `components/v2/kanban`
- [ ] `components/v2/surface/record-surface`, `components/v2/data-canvas`
- [ ] `app/v2/surface`, `records`, `db/db-index`

## Acceptance

- [ ] Zero `.module.css` files remain under `apps/web/src` for v2 surfaces.
- [ ] Zero relief-token references (`--well/--edge/--raise/--float/--plane/--bloom/--wash`) anywhere.
- [ ] `node scripts/lint-console-register.mjs` clean with converted files added to its MIGRATED lists.
- [ ] `npm run build` green.
- [ ] Browser: Workrooms + Index render flat tonal register surfaces, popovers use `shadow-transient`.
