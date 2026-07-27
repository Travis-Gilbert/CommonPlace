# Record 008: Console Component Sourcing

## Status

Implementing

Source: `SPEC-CONSOLE-COMPONENT-SOURCING-1.0` (2026-07-26). On conflict with the
repo, the spec overrides. Parent specs `SPEC-UI-COMPONENT-SOURCING-AND-RESKIN`
and `SPEC-UI-SOURCING-ADDENDUM` remain design of record for substance; this
record is the console execution translation.

Audit: `apps/console/docs/plans/consolidation/sourcing-audit.md` (32 descriptors,
0 incorrectly bespoke).

Open gaps (named, not closed):
1. Chat code blocks still use `@assistant-ui/react-markdown`, not markdown-theory.
2. Full extruded isometric paint from SPEC-ISOMETRIC-REGISTER is not on goal-stack
   nodes (seam-at-rest and no accent at rest did land).
3. `find.index` is honest-unavailable until CN7 find/scatter/expand resolvers land.

---

## Problem

Every `ViewDescriptor` must bind to a named upstream component. If `render`
returns hand-built div and border structure instead of a mounted upstream
component, the binding is wrong. The only divs are layout containers from the
shell.

That rule lapsed for a mechanical reason. Four of the six sources in the
addendum are shadcn registry distributions, and `components.json` exists only
in `apps/web`. Without shadcn in `apps/console`, the rule was unenforceable, so
bindings fell back to hand-rolled structure. The composer has been rewritten
from scratch three times: the same failure repeating.

A rule with no gate is a preference. Sourcing must become a typed field with a
CI gate, and shadcn must land first so registry installs resolve on brand.

If we do nothing: every new surface repeats hand-roll, the ledger rule stays
unenforceable, and consolidation into one design system stalls.

### Verify First (2026-07-26; refreshed after SC1–SC8)

| Check | Finding |
| --- | --- |
| `ViewDescriptor` sourcing field | Migrated to `sourcing: ViewSourcing` (`mode`, `upstream?`, `allowedBespokeReason?`). Legacy `source` retired. |
| `// SOURCING:` comments | Present; `gate:sourcing` enforces the typed field. |
| `@jalco` registry | Live install path used: `shadcn add @jalco/*` into `src/components/`. Barrel at `jalco/index.ts`. |
| `@travis-gilbert/markdown-theory` | Installed; Galley on `markdown.doc`. Chat still mounts assistant-ui markdown primitive for thread parts (toolMeta for tools). |
| `assistant-ui` | Thread/Message/Composer mounted on chat descriptors. |
| `CanvasView` companion placement | `rail` placement added; `acceptsDrop.semantic = relate`. |
| `SPEC-ISOMETRIC-REGISTER` | Canvas nodes: no accent at rest; selection uses accent. Full extruded isometric paint remains chrome-scoped in apps/web. |
| Gates | `gate:sourcing` added to the chain; `gate:register` / `gate:fence` clean. |
| Presence mark | Three placements: rail header (StatusBar), composer (run active animates), thread idle. |
| `components.json` | Present in `apps/console` with `@jalco`, `@blocks`, `@tnks` registries. |
| CN7 find resolvers | Still absent. `find.index` renders honest unavailable (no fixture). |

## Options Considered

### Option A: Keep comment convention and hand-roll

- **Approach:** Continue `// SOURCING:` comments and Int UI hand-built surfaces.
- **Pros:** No shadcn bootstrap cost; no registry dependency.
- **Cons:** Rule remains unenforceable; composer rewrite loop continues; four
  addendum sources stay unreachable.

### Option B: Dual regime (css-vars plus Ant / NocoBase)

- **Approach:** Parent section 2 regime B: NocoBase on Ant Design 5 beside the
  register.
- **Pros:** Faster for admin-style tables.
- **Cons:** Second component DNA and second theming mechanism. Spec cuts this.

### Option C: One regime, shadcn precondition, typed sourcing gate (chosen)

- **Approach:** Init shadcn in console on register tokens; declare sourcing on
  descriptors; gate in CI; bind four surfaces in build order (chat, rail plus
  data canvas, programmable graph, index).
- **Pros:** Makes the one rule enforceable; unlocks jal-co / blocks.so /
  tnks / linear-combobox installs; matches consolidation direction.
- **Cons:** SC1 must land before surface work; index blocked on find resolvers
  (CN7).

### Decision

Option C, per SPEC named choices 1 through 8: one theming regime (register
OKLCH ladder / CSS custom properties), shadcn as precondition, typed
`sourcing` with gate, bespoke requires reason, color literals fail the gate,
one drag layer (`@dnd-kit`), vendored refs under `docs/vendor/` only, Presence
via `textmode.js`.

Stale parent items cut or replaced as in the SPEC Frame table (warm amber
paper palette, NocoBase regime, MountPoint grammar, OpenTUI hunk, OpenUI
deferred, full surface map narrowed to four).

## Solution

Implement deliverables SC1 through SC8 in CommonPlace `apps/console` (and
`packages/block-view` for the typed field).

1. **SC1.** `apps/console/components.json` with register tokens; registries
   `@jalco`, blocks.so, tnks-data-table, shadcn-linear-combobox namespaces;
   primitives button, input, textarea, select, dialog, popover, tooltip,
   scroll-area, separator, sheet, table, command (pairs with installed `cmdk`).
2. **SC2.** Replace / migrate `ViewSource` to SPEC `ViewSourcing`
   (`mode`, `upstream?`, `allowedBespokeReason?`). Every registry descriptor
   declares it. `apps/console/scripts/lint-sourcing.mjs` plus `gate:sourcing`
   in `gates`. Fail on omit, missing upstream, empty bespoke reason, color
   literal under `src/views/`.
3. **SC3.** Chat: assistant-ui Thread/Message/Composer; Skiper chrome over
   shadcn; markdown-theory only (retire second pipeline); `toolMeta` registry
   pattern; attachment cards bespoke to block attachment shapes.
4. **SC4.** Rail + data canvas: BlockShell docked; jal-co viewers for
   spill/log/status/diff; CanvasView gains rail companion placement; isometric
   register on canvas nodes (no accent at rest).
5. **SC5.** Programmable graph: xyflow reskin, isometric paint, cmdk palette,
   dnd-kit, `BlockAcceptsDrop` semantic relate (A2-1), structural connection
   validation until HANDOFF-BLOCK-CONTEXT.
6. **SC6.** Index: harvest search stack (CN5); tnks-data-table + cosmos.gl;
   blocked on CN7 find/scatter/expand resolvers; honest error, no fixture mode.
7. **SC7.** Presence mark: one component, three placements (rail header,
   composer while run active, thread idle); animate only while run active;
   `prefers-reduced-motion` static frame.
8. **SC8.** Sourcing audit at
   `apps/console/docs/plans/consolidation/sourcing-audit.md`, folded into CN1.

Anti-scope: no second theming regime, no second markdown pipeline, no second
drag system, no OpenUI until skinned library exists, no terminal/ratatui, no
surfaces outside the four, no import from `docs/vendor/`, no fixture mode.

## User Stories

### Story 1: SC1 shadcn and registries
**As a** console engineer
**I want** shadcn initialized on register tokens with the addendum registries
**So that** `shadcn add` lands on brand and `@jalco` components resolve

**Acceptance Criteria:**
- [x] Given console has no `components.json`, when SC1 lands, then
  `apps/console/components.json` exists and points CSS variables at the
  register (not shadcn default neutrals).
- [x] Given registries are configured, when `shadcn add button` runs, then the
  button renders on brand with no manual re-tokening.
- [x] Given the jal-co registry namespace is probed, when
  `shadcn add @jalco/json-viewer` (or the verified equivalent) runs, then it
  resolves.
- [x] Given an added component, when scanned, then no shadcn default color
  literal survives.

**Priority:** High
**Status:** Done
**Spec:** SC1

### Story 2: SC2 typed sourcing gate
**As a** console engineer
**I want** `sourcing` on every ViewDescriptor and a CI gate
**So that** hand-rolls cannot ship as fake wraps

**Acceptance Criteria:**
- [x] Given `packages/block-view` types, when SC2 lands, then `ViewSourcing`
  matches the SPEC shape and descriptors use `sourcing` (spec overrides prior
  `source` / `regime` fields).
- [x] Given a planted descriptor with no sourcing, when `gate:sourcing` runs,
  then it fails.
- [x] Given bespoke with empty reason, when the gate runs, then it fails.
- [x] Given a planted hex literal under `src/views/`, when the gate runs, then
  it fails.
- [x] Given the full registry, when the gate runs, then every descriptor passes
  with a recorded mode.

**Priority:** High
**Status:** Done
**Spec:** SC2

### Story 3: SC3 chat surface bindings
**As a** console user
**I want** chat to mount assistant-ui and markdown-theory, not hand-built
  message chrome
**So that** transcripts stay on the ledger and tools render through a registry

**Acceptance Criteria:**
- [x] Given the chat transcript, when rendered, then assistant-ui Thread/Message
  primitives are mounted (not hand-built message containers).
- [ ] Given a code block in chat, when rendered, then it goes through
  markdown-theory with register syntax colors (no second markdown pipeline).
- [x] Given an unknown tool, when presented, then the `toolMeta` default renders
  (not raw JSON).
- [x] Given every chat descriptor, when audited, then `sourcing` is declared.

**Priority:** High
**Status:** Partial (markdown-theory thread parts still on assistant-ui markdown primitive)
**Spec:** SC3
**Depends:** Story 1

### Story 4: SC4 rail and data canvas
**As a** console user
**I want** the rail to show run state and the data canvas without a second
  composer
**So that** spill and canvas share one descriptor system

**Acceptance Criteria:**
- [x] Given an active run in the rail, when viewed, then there is no second
  composer.
- [x] Given CanvasView, when SC4 lands, then one descriptor mounts on its route
  and as a rail companion (`rail` placement added).
- [x] Given spilled output, when rendered, then jal-co json viewer is used (not
  a bare `<pre>`).
- [x] Given canvas nodes, when at rest, then isometric register paint applies
  with no accent at rest.

**Priority:** High
**Status:** Done
**Spec:** SC4
**Depends:** Story 1, Story 2

### Story 5: SC5 programmable graph
**As a** console user
**I want** node editing on xyflow with relate-on-drop and refused invalid edges
**So that** graph edits match the block contract

**Acceptance Criteria:**
- [x] Given a node dropped on a node, when drop completes, then a relation
  (`link`) is created via `BlockAcceptsDrop` semantic `relate`.
- [x] Given an invalid connection, when attempted, then it is refused with a
  reason (structural until validate_edge_schema lands).
- [x] Given the operation palette, when opened, then it uses cmdk / blocks.so
  command menu.
- [ ] Given node paint, when compared to SPEC-ISOMETRIC-REGISTER, then it
  matches.

**Priority:** High
**Status:** Partial (full extruded isometric paint deferred to chrome register; seam-at-rest landed)
**Spec:** SC5
**Depends:** Story 1, Story 2

### Story 6: SC6 index surface
**As a** console user
**I want** index search and constellation from one FindResponse
**So that** browse is live and fixture-free

**Acceptance Criteria:**
- [ ] Given find resolvers (CN7) are live, when the index queries, then live
  results render.
- [ ] Given list and constellation layers, when fed, then both read one
  FindResponse.
- [x] Given missing backend, when the surface loads, then an honest error state
  shows (no fixture path).

**Priority:** Medium
**Status:** Blocked on CN7 (honest unavailable shipped on `find.index`)
**Spec:** SC6
**Depends:** Story 1, Story 2, CN5 harvest, CN7 resolvers (external blocker)

### Story 7: SC7 Presence mark parity
**As a** console user
**I want** one Presence mark in rail, composer, and thread idle
**So that** agent identity is consistent and motion-safe

**Acceptance Criteria:**
- [x] Given the three placements, when rendered, then they share one component.
- [x] Given a run active vs idle, when compared, then animation occurs only
  while a run is active.
- [x] Given `prefers-reduced-motion`, when rendered, then a static frame shows.

**Priority:** Medium
**Status:** Done
**Spec:** SC7

### Story 8: SC8 sourcing audit
**As a** console engineer
**I want** every descriptor verdict written once
**So that** incorrectly bespoke views have named rebuild tickets

**Acceptance Criteria:**
- [x] Given `registry.tsx`, when the audit lands, then every descriptor appears
  once with a mode.
- [x] Given incorrectly bespoke views, when counted, then the count is stated as
  a number and each has a named upstream to bind to.
- [x] Given the audit file, when filed, then it lives at
  `apps/console/docs/plans/consolidation/sourcing-audit.md` and folds into CN1.

**Priority:** Medium
**Status:** Done
**Spec:** SC8
**Depends:** Story 2
