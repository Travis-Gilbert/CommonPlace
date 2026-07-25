# Console sidebar: implementation plan

Register: HANDOFF-CONSOLE-SIDEBAR (Downloads handoff, decided 2026-07-20).
Companions: B1 mounts, B3 routes, B6 layout persistence, B10 promotion;
HANDOFF-CONSOLE-ISLAND-SHELL; 00-DECISIONS.md (IA split Surfaces/Companions);
35-AMENDMENT-MATERIAL-REVIEW (frame-resident stripe, 36 to 40px nav rows);
Claude.ai web sidebar screenshot (banked reference); Paper file Island Shells.

Writing rules: no em or en dashes. Status leads with what is not done.

## Gap (current HEAD)

Not shipped: labeled expanded sidebar, landmarks zone, collapse rail, Cmd/Ctrl
shortcuts, stripe `blocksForMount` wiring, sidebar width tokens. What exists
today is the icon-only 40px stripe inside `IntuiShell.tsx` (Surfaces radio +
Companions toggles), B3 routes, B6 write-through, and B10 island to stripe-tray
promotion.

## Design brief (Paper stage)

- Mood candidates: industrial, phosphor, gallery, bookish, vehicle dashboard
- Mood chosen: industrial (not phosphor): JetBrains chrome ground, one accent
  pip, flat wash. Phosphor would fight the terracotta Material Layer.
- Palette (register-derived roles, hex from dark Int UI for Paper stage only):
  frame `#1E1F22`, chrome wash `#2B2D30`, ink `#DFE1E5`, ink-info `#868A91`,
  seam `#393B40`, selection `#2B2D30`, accent pip uses `--ij-accent` in code
- Type: IBM Plex Sans 14/500 labels (active 14/600); JetBrains Mono 11 shortcuts
- Direction: Claude.ai web sidebar structure (always-visible labels, content
  landmarks, single active wash, flat) fitted to Theorem tokens and frame paint

Paper artboards: Sidebar expanded (264px rail), Sidebar collapsed (44px rail).
Extract via `get_jsx` / `get_computed_styles` into `paper-extract-sidebar.md`.

## Deliverables mapped to SB1 to SB5

| ID | Work | Spec backref |
|---|---|---|
| SB1 | Extract `Sidebar.tsx`; zones Surfaces, Companions, Landmarks, footer; frame-resident paint; IntuiShell keeps composition only | Named choices 1 to 3; Deliverable SB1 |
| SB2 | Tokens: expanded 264, collapsed 44, row 36, icon 16, row radius 8, wash, pip; regenerate `token-manifest.json` | Fitted values; Deliverable SB2 |
| SB3 | Landmarks on live `ObjectQuery` (pinned OR recent); stripe density rows; titles truncated end; kind glyph leading | Named choice 3 landmarks; Deliverable SB3 |
| SB4 | Rows resolve via `blocksForMount("stripe")`; pin/remove/reorder and promote-to-ground write `view-instance` mutations through `emit` | Named choice 4; Deliverable SB4 |
| SB5 | Collapse rail, tooltips, Cmd/Ctrl-B, Cmd/Ctrl-1..5; collapse persists on layout object via B6 | Named choice 6; Deliverable SB5 |

## Named implementation choices

1. Surfaces zone lists the five routed surfaces only (Chat, Workspace, Index,
   Documents, Cards). Goal Stack stays reachable from the toolbar switcher and
   Command mode; it leaves the primary Surfaces radio.
2. Icon distinctness without new Noun family glyphs (00-DECISIONS item 12): add
   distinct control-stroke glyphs for Index, Files, and Chat so no two rail
   roles share a silhouette at 16px.
3. Landmarks region: seed `console.region-landmarks` (kind `landmarks`) holding
   stripe-mount view-instances; query domain objects with
   `where: or(pinned eq true, ...)` plus `rank: updated desc` for the recent
   set; dragging a landmark onto the active grid emits B10 promote-to-grid.
4. Collapse width uses CSS `transition: width var(--ij-motion)` plus label
   opacity fade; inventoried as an exception to the transform-only rule because
   the handoff requires width animation. Reduced motion snaps width.
5. Footer shows session profile initials and tenant from shell store; connection
   stays in StatusBar.

## Acceptance proofs

1. Expanded: every row shows its label without hover.
2. Side-by-side icon review at 16px: no confusable pair.
3. Landmark to ground: receipt + reload with cleared localStorage restores island
   and sidebar arrangement from server layout.
4. Collapsed: mouse and Cmd/Ctrl-1..5 reach all five surfaces.
5. No shadow, no border; ground gradient visible through sidebar.
6. `pnpm gates` (or `npm run gates` in apps/console) passes; grayscale legible.

## File touch list

- `apps/console/src/components/shell/Sidebar.tsx` (new)
- `apps/console/src/components/shell/IntuiShell.tsx`
- `apps/console/src/components/shell/icons.tsx`
- `apps/console/src/lib/workspace-seed.ts`
- `apps/console/src/lib/console-host.ts` (landmarks query helpers if needed)
- `apps/console/src/views/registry.tsx` (`stripe` mounts)
- `apps/console/src/styles/register-bridge.css` (+ light overrides as needed)
- `apps/console/src/styles/int-ui-register.css` (`--ij-stripe-w` base)
- `apps/console/src/styles/token-manifest.json` (regenerated)
- `apps/console/src/motion/motion-tokens.ts` (collapse inventory row)
- `apps/console/e2e/*.spec.ts` (surface count 5; collapse; landmarks)
- `docs/plans/console/sidebar/paper-extract-sidebar.md`

## Out of scope (handoff)

Chat surface and composer, StatusBar changes, MainToolbar changes, new block
renderers beyond landmark rows.
