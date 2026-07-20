# HANDOFF-CONSOLE-SIDEBAR

Repo `Travis-Gilbert/CommonPlace`, app `apps/console`. Register: execution handoff; named
choices are requirements. Decided with Travis 2026-07-20.

Companions: HANDOFF-CONSOLE-BLOCK-SYSTEM (B1 mounts, B3 routes, B6 layout persistence, B10
promotion are dependencies), HANDOFF-CONSOLE-ISLAND-SHELL, the console pivot decision log
(stripe splits into Surfaces and Companions; primary navigation rows 36 to 40px with 14 to 15px
labels is already law; the Claude app sidebar screenshot is the banked reference).

Writing rules: no em dashes anywhere. No invented numbers. Status reports lead with what is not
done.

## What this is

The structural rethink the decision log deferred. The reference is the claude.ai web app
sidebar (not desktop): always-visible labels, content-shaped landmarks, one accent, flat. The
fitting is Theorem: JetBrains proportions, register tokens, painted by the ground, and rows
that are blocks.

## Verify first

- `apps/console/src/components/shell/IntuiShell.tsx` (the stripe renders here today; find its
  exact extent before extraction)
- `apps/console/src/components/shell/icons.tsx` and `scripts/check-icon-svg.mjs` (the icon
  pipeline; the current duplicate-glyph problem lives here)
- `apps/console/src/lib/shell-store.ts` (the surface radio state this replaces with routes)
- `apps/console/src/components/shell/StatusBar.tsx` (identity and connection stay there, not in
  the sidebar footer)
- `packages/block-view/src/registry.ts` (`blocksForMount("stripe")` from B1)
- The registers and `token-manifest.json`

Search before asserting absence. Listings truncate.

## Claude reference, then the Theorem fitting

Reference qualities to preserve exactly: labels always visible when expanded; landmarks are
content-shaped (real object titles, not categories); a single accent marks active; surfaces are
flat with a hover wash, no shadows; generous full-row hit areas.

Fitted values (requirements): expanded width 264px; collapsed rail 44px; row height 36px; label
IBM Plex Sans 14/500, active 14/600; icons 16px from the icons pipeline; item radius 8px; hover
is a wash token, never a shadow; the sidebar casts no shadow at all.

## Named choices

1. **Frame-resident.** The sidebar is base, not island: painted by the ground, no border (the
   JetBrains Islands guidance of fully transparent stripe borders), no elevation. It sits with
   the toolbar and status bar as wraparound frame; islands begin to its right.

2. **Extraction.** The stripe leaves `IntuiShell.tsx` into
   `apps/console/src/components/shell/Sidebar.tsx`. IntuiShell keeps frame composition;
   Sidebar owns rows, zones, collapse, and drag.

3. **Zones, top to bottom.** Surfaces (radio, five rows: Chat, Workspace, Index, Documents,
   Cards; each navigates its B3 route); divider; Companions (toggles: Files, Context, Thread);
   divider; Landmarks (pinned and recent objects as content-shaped rows, fed by an
   `ObjectQuery` over recent and pinned items, titles truncated end, kind glyph leading);
   footer (profile and tenant from the session; connection and identity state remain in the
   StatusBar).

4. **Rows are blocks.** Sidebar rows resolve through `blocksForMount("stripe")`. A landmark row
   dragged onto the ground becomes an island (B10 promotion, receipt through `emit`); rows can
   be pinned, reordered, and removed; the arrangement persists as `view-instance` objects per
   B6. This is the "decide what lives in my sidebar versus my islands" requirement, delivered
   by the contract rather than by settings.

5. **Icon distinctness.** One glyph per surface and per companion, no two alike; the current
   duplicate-glyph state is a named defect. The review checklist includes a side-by-side of all
   rail icons at 16px; any pair a reviewer cannot tell apart at a glance fails.

6. **Collapse.** Toggle to the 44px rail: icons centered, labels move to tooltips carrying
   label plus shortcut, active state is a leading accent pip plus glyph tint. Width animates;
   labels fade; nothing reflows inside rows. Keyboard: Cmd/Ctrl-B toggles collapse;
   Cmd/Ctrl-1 through 5 select surfaces.

7. **Typography.** All sidebar labels are IBM Plex Sans per the authorship amendment (they are
   chrome). Counts and shortcuts are JetBrains Mono 11, tabular-nums, muted.

8. **Paper stage.** Expanded and collapsed states, all zones, designed in Paper against live
   landmark data (Paper MCP plus harness MCP, heads-local), extracted with `get_jsx` and
   `get_computed_styles`. Register stays canonical.

## Deliverables

**SB1.** `Sidebar.tsx` extracted from IntuiShell with zones, values, and frame-resident paint;
IntuiShell reduced accordingly.

**SB2.** Sidebar tokens (widths, row, wash, pip) in the registers and bridge;
`token-manifest.json` regenerated.

**SB3.** Landmarks zone on a live `ObjectQuery` (pinned plus recents), rendering through the
stripe density of the block contract.

**SB4.** Stripe mount wiring: rows resolve via `blocksForMount("stripe")`; pin, remove,
reorder, and the promotion drag write `view-instance` mutations through `emit`.

**SB5.** Collapse and keyboard: rail state, tooltips, Cmd/Ctrl-B, Cmd/Ctrl-1..5; collapse
state persists per B6 alongside the layout.

## Acceptance

1. Expanded, every row shows its label; nothing requires hover to identify.
2. The all-icons side-by-side contains no two glyphs a reviewer confuses at 16px.
3. Dragging a landmark to the ground creates an island and returns a receipt; reload with
   cleared localStorage restores both the island and the changed sidebar arrangement from the
   server.
4. Collapsed rail navigation reaches all five surfaces by mouse and by Cmd/Ctrl-1..5.
5. The sidebar casts no shadow and draws no border in either theme; the ground gradient is
   visible flowing through it.
6. `pnpm gates` passes; grayscale capture keeps every zone legible.

## Out of scope

Chat surface and composer (own handoff), StatusBar changes, MainToolbar changes, any new block
renderers beyond the landmarks rows.
