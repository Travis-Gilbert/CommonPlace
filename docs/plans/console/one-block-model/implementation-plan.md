# Console one-block model: implementation plan

Register: HANDOFF-CONSOLE-ONE-BLOCK-MODEL (Downloads handoff, decided 2026-07-21).
Companions: HANDOFF-CONSOLE-BLOCK-SYSTEM (choice 2 superseded in part);
HANDOFF-CONSOLE-ISLAND-SHELL (choices 1 and 8 superseded in part);
HANDOFF-CONSOLE-SIDEBAR (choice 1 superseded in part); AMENDMENT-01 stands;
sidebar plan at `docs/plans/console/sidebar/`.

Writing rules: no em or en dashes. Status leads with what is not done.
Harness MCP unavailable this session; plan lives on disk only.

## Gap (current HEAD)

Shipped in this branch (OB1 to OB8 code path): one noun (`block`),
`BlockPlacement`, free `BlockGeometry` with edge resize, region attrs on
IntuiShell, chrome strips removed (Run + connection on rail), header drag,
kanban `acceptsChildren` + innermost collision helper, CardView and workspace
body sections. Validate with gates and focused e2e before calling acceptance
done.

## Status

| ID | State |
|---|---|
| OB1 | shipped (package + registry) |
| OB2 | shipped (renames; paint `data-island*` kept) |
| OB3 | shipped (free geometry; `snapToDeclaredSize` deleted) |
| OB4 | shipped (`data-shell-region` rail/dock/ground) |
| OB5 | shipped (MainToolbar/StatusBar removed; Run + reconnect on rail) |
| OB6 | shipped (header drag surface; cross-placement receipts retained) |
| OB7 | shipped (collision helper + KanbanBlock columns) |
| OB8 | shipped (`data-block-section` on CardView and workspace) |

## Verify-first notes (pre-implementation; retained for audit)

- Was: `snapToDeclaredSize` constrained height; now free `BlockGeometry` with
  edge/corner resize and limits clamp.
- MaterialLayer paints via `[data-island]` / `[data-island-header]`: those are
  **paint** attributes and stay.
- Cards seed is the only `kind: "grid"` ground region today.
- Vendored `recursive-dnd-kanban-board` informed OB7 collision / nesting.

## Deliverables mapped to OB1 to OB8

| ID | Work | Spec backref |
|---|---|---|
| OB1 | `BlockPlacement`, `BlockGeometry`, `BlockLimits`, `placements`, `defaultSize`, `limits`, `acceptsChildren`; `blocksForPlacement`; package tests | Named choices 1 to 3, 7; Deliverable OB1 |
| OB2 | Mechanical renames: Shell/Canvas/ArrangementHost, geometry/placement libs, surface/glyph/bleed types, gate script, non-paint data attrs | Named choice 1; Deliverable OB2 |
| OB3 | Free `col/row/colSpan/rowSpan`; delete `snapToDeclaredSize`; edge+corner resize; clamp by limits | Named choice 3; Deliverable OB3 |
| OB4 | IntuiShell as region host: rail, docks, ground; rail width drives ground reflow; no rail chrome paint | Named choice 4; Deliverable OB4 |
| OB5 | Remove MainToolbar and StatusBar strips; Run on rail; connection dot in rail footer | Named choice 5; Deliverable OB5 |
| OB6 | Whole-block drag; cross-placement drops; receipts; keyboard via handle | Named choice 6; Deliverable OB6 |
| OB7 | `acceptsChildren`; innermost-accepting-container collision; kanban first container | Named choice 7; Deliverable OB7 |
| OB8 | Body sections on CardView and workspace substrate; split substrate past three sections | Named choice 8; Deliverable OB8 |

## Named implementation choices (execution)

1. Placement map: `stripe→rail`, `chrome|companion→dock`, `island→ground`,
   `surface→full`. Dock edge is view-instance config, not a placement kind.
2. `defaultSize` is one `BlockSize`; named sizes remain reset/initial only.
3. Paint layer keeps `--ij-island-*` and `data-paint-region="island-*"` and
   `data-island` material hooks. Grep for `Island` as a **type/component**
   name must be empty outside styles and paint.
4. Region host: CSS grid or absolute regions over MaterialLayer; rail is
   transparent width, not a column with its own surface.
5. Drop priority: one dnd-kit collision config; innermost accepting container
   wins; else ground.

## Order of operations

OB1 → OB2 → OB3 → OB4 → OB5 → OB6 → OB7 → OB8. Chrome deletion after regions
so Run and connection have a home. Containers after whole-block drag so
collision rules apply to one drag system. Body IA last.

## Acceptance proofs (handoff)

1. Grep `Island` outside styles/paint attrs: empty for types and components.
2. Ground block vertical resize by bottom edge, one grid row, stops at minRows.
3. Rail collapse widens ground; no rail border/shadow; gradient continuous.
4. No top/bottom strips; Run on rail; disconnect indicator only in rail footer.
5. Rail↔ground drag: two receipts; survives cleared localStorage reload.
6. Drop on kanban lands in container; drop on non-container falls to ground.
7. Header drag moves; body button click does not drag.
8. CardView and workspace bodies ≤3 sections; no unjustified nested raised surfaces.
9. `npm run gates` including renamed `check-block-classes.mjs`.

## File touch list (primary)

- `packages/block-view/src/types.ts`, `registry.ts`, `island-class.ts` → `block-class.ts`
- `apps/console/src/lib/island-grid.ts` → `block-geometry.ts`
- `apps/console/src/lib/island-promotion.ts` → `block-placement.ts`
- `apps/console/src/components/blocks/IslandShell.tsx` → `BlockShell.tsx`
- `IslandGrid.tsx` → `BlockCanvas.tsx`; `IslandArrangementHost.tsx` → `BlockArrangementHost.tsx`
- `apps/console/scripts/check-island-classes.mjs` → `check-block-classes.mjs`
- `IntuiShell.tsx`, `Sidebar.tsx`, `MainToolbar.tsx`, `StatusBar.tsx`, `views/registry.tsx`
- CardView and workspace substrate views; e2e selectors for renames

## Out of scope (handoff)

Chat surface, Remotion/pdfx, native/GPUI, correspondence family, Paper
authoring, material layer changes beyond consuming existing region attrs.
