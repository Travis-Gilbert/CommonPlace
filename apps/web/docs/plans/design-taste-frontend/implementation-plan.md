# Design Taste Frontend: console lane implementation

**Spec source:** the `/design-taste-frontend` skill (High-Agency Frontend Skill). Per project CLAUDE.md, its binding contribution to this repo is the metric-based engineering rules and the CSS hardware-acceleration discipline; the console register keeps its own identity (IBM Plex Sans, Vollkorn, oklch parchment). Rules that would re-brand the site (Geist/Satoshi fonts, #f9fafb bento surfaces) are intentionally not applied; the register is the design system.

**Audit method:** grep sweep over `apps/web/src` (h-screen, pure black, calc flex math, layout-prop transitions, emojis, dashes, transition-all, active-state coverage, loading/error coverage), verified against the shipped console-paint state at HEAD (PR #50).

## Verified state at HEAD

| Spec rule | State |
| --- | --- |
| Viewport stability (no h-screen) | Clean. Only `min-h-screen` on the root layout, which is not a Hero section. |
| No pure black | Clean in the lane. `#000` appears only in print.css (print output) and the act pages' patent-figure plate ink (deliberate aesthetic, commented). |
| Grid over flex math | Clean. The three `calc()` hits are max-width guards, not column math. |
| Color calibration, single accent | Already register-owned (HP2 solver, AA both planes). |
| Empty-state restraint | Already shipped (HP5) with a merge-blocking oracle (HP4). |
| Loading/error cycles | Fetching console pages (tables, workrooms, graph, operator, files, agent) carry loading and error handling; records/objects/work delegate to surfaces that render honest states. |
| ANTI-EMOJI policy | VIOLATION: `databases/page.tsx` renders pictographic emoji as card marks. (Typographic dingbats like the console's `✓ ○ ✕` apparatus are the register's deliberate glyph vocabulary, not emoji; they stay.) |
| Project no-dash rule | VIOLATION: ~24 em/en dashes across 15 files in `(console)` (comments, UI placeholder strings, one data sentinel). |
| Rule 5 tactile feedback | VIOLATION: zero `:active` press states anywhere in the console lane. |
| Section 5 hardware acceleration | VIOLATION: one layout-prop transition in the lane: `.bayProgressFill { transition: width }` (operator). Legacy porcelain/theseus/studio sheets have many width transitions; those files are out of the migrated lane and are flagged, not refactored. |

## Checklist (spec backreferences)

- [ ] DT1 (spec section 2, ANTI-EMOJI; section 7 content): replace the databases page emoji with typographic monogram marks in the page's own token vocabulary; no new icon dependency (the console lane imports no icon library; its language is type).
- [ ] DT2 (project Writing Rules; spec section 7 hygiene): remove every em/en dash in `src/app/(console)`: comment dashes become colons/commas; the workrooms counter placeholder and the timeline sentinel become honest non-dash forms.
- [ ] DT3 (spec Rule 5, tactile feedback): a central press-state rule in `console-shell.css`, transform-only (translateY(1px)), scoped to buttons that do not carry their own transform utilities; plus a press state on the databases card.
- [ ] DT4 (spec section 5, hardware acceleration): convert `.bayProgressFill` from `transition: width` to `transform: scaleX()` with `transform-origin: left` (BayCard writes `--bay-progress` instead of width).
- [ ] DT5 (spec section 10 pre-flight, as a merge gate): new `scripts/lint-design-taste.mjs` over the `(console)` tree + `console-shell.css`: pictographic-emoji ban, em/en-dash ban, `h-screen` ban, layout-prop transition ban, `transition-all`/`transition: all` ban. Wire `lint:taste` into package.json and the CI workflow next to `lint:register`.
- [ ] DT6 (HP4 oracle culture): press-feedback e2e oracle in `e2e/console-paint.spec.ts` (mousedown on a stream row asserts a non-none computed transform; CI-run, local proof via Browser pane).
- [ ] DT7 (validation): `lint`, `lint:register`, `lint:taste` green; Browser pane verification of `/databases` and the press state; truthful report of anything not run locally (Playwright runs in CI only).

## Out of scope, flagged not changed

- Legacy width/height transitions in `theseus.css`, `commonplace.css`, `studio.css`, `reader.css`, `reading-pane.css`: legacy porcelain surfaces outside the migrated lane; several are collapsible-panel reflows where width animation is the layout mechanism. The lint scopes to the console lane exactly like `lint-console-register.mjs`.
- Pictographic emoji in legacy commonplace components (`BoardCatalogSidebar`, `AutoOrganizeView`): same lane rule.
- `timeline/page.tsx` seeded ITEMS array: pre-existing strangler scaffold in a reachable surface (its comment declares the intended `itemsAsOf` wiring). Fixing means wiring commonplace-api; flagged as its own follow-up lane, not silently absorbed here.
