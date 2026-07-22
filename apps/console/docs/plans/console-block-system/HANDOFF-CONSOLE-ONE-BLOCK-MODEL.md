# HANDOFF-CONSOLE-ONE-BLOCK-MODEL

Repo `Travis-Gilbert/CommonPlace`, app `apps/console`, package `packages/block-view`. Register:
execution handoff; named choices are requirements. Decided with Travis 2026-07-21 after operating
the deployed console.

Supersedes, in part: HANDOFF-CONSOLE-BLOCK-SYSTEM choice 2 (`MountPoint`, `BlockSize` as the
constraint set), HANDOFF-CONSOLE-ISLAND-SHELL choices 1 and 8 (shell naming, preset size grammar),
HANDOFF-CONSOLE-SIDEBAR choice 1 (frame-resident column). Everything else in those handoffs stands.
AMENDMENT-01 stands unchanged.

Writing rules: no em dashes anywhere. No invented numbers. Status leads with what is not done.

## What this is

One noun. There is no island and no block; there is a block. Operating the deployed console made
the distinction indefensible: every visible thing is a block, and "island" turned out to name a
paint treatment, not a kind of thing. This handoff collapses the vocabulary, then fixes the four
structural defects that the collapse makes tractable, because all four live in the same shell
container and cannot be fixed independently without conflict.

## Verify first

Read before writing a line. Paths verified on `main` 2026-07-21:

- `packages/block-view/src/types.ts` (`MountPoint`, `BlockSize`, `BlockPresentation`,
  `IslandSurfaceClass`, `IslandKindGlyph`, `IslandBodyBleed`, `ViewDescriptor`)
- `packages/block-view/src/registry.ts` (`blocksForMount`), `surface-tree.ts`, `addressing.ts`
- `apps/console/src/lib/island-grid.ts` (`BLOCK_SIZE_SPAN`, `snapToDeclaredSize`,
  `gridStyleForSize`, `sizesFailingHeaderFit`)
- `apps/console/src/lib/island-promotion.ts`, `island-grid.test.ts`, `island-promotion.test.ts`
- `apps/console/src/components/blocks/IslandShell.tsx`, `IslandGrid.tsx`,
  `IslandArrangementHost.tsx`, `kind-glyph.tsx`, `IslandShell.test.tsx`
- `apps/console/src/components/shell/IntuiShell.tsx`, `MainToolbar.tsx`, `StatusBar.tsx`,
  `ViewInstanceHost.tsx`
- `apps/console/src/lib/state/shell-state.ts`, `view-instance-state.ts`, `layout-cache.ts`
- `apps/console/scripts/check-island-classes.mjs`, `check-register-lint.mjs`
- `apps/console/src/views/registry.tsx`, `views/blocks/DeclaredBlocks.tsx`
- `apps/console/docs/vendor/recursive-dnd-kanban-board/` (the nesting reference)

Search before asserting absence. Listings truncate.

## The diagnosis

Four defects, each with its verified mechanism. None is a color problem; the light elevation
decompression from AMENDMENT-01 A1 already landed and the surfaces still compose badly, which is
the evidence that these are structural.

1. **Blocks resize horizontally but not vertically.** `snapToDeclaredSize` in `island-grid.ts`
   snaps a freeform drag to the nearest entry in the descriptor's declared `sizes` list. A block
   declaring `["m", "w", "full"]` can only be 4x3, 6x3, or 12x12; `m` and `w` share `rows: 3`, so
   dragging between them changes width and never height. Height is only reachable by jumping to
   `full`. The preset grammar is the constraint set, and that is the bug.

2. **The rail steals width instead of being ground.** The sidebar renders as a layout column, so
   content begins to its right and the rail is stuck at one width. What it should be: painted
   ground on the bottom layer, with the content region growing into that space when the rail
   collapses.

3. **Two chrome strips burn a row each.** The top strip carries a surface switcher (duplicating
   the rail), a person icon (duplicating the rail footer), and Run (the only load-bearing item).
   The bottom strip carries connection state and a tenant name already shown in the rail footer.

4. **Block bodies have no internal information architecture.** The shell specified header, body,
   and footer, and never specified what happens inside the body. The workspace substrate crams an
   import form, three columns, a membrane card, and a readiness heading into one undesigned body;
   `CardView` predates the material layer and was never laid out for a block context.

## Named choices

### 1. One noun

`block` is the only structural noun. `island` survives in exactly one place: the material and
token layer, where it names a paint treatment inherited from the JetBrains Islands theme
(`--ij-island-*` tokens, `data-paint-region="island-*"`, the shader's island paint). A block
placed on the ground is *painted as an island*. Nothing else is an island.

Renames, mechanical and complete:
- `IslandShell.tsx` becomes `BlockShell.tsx`; `IslandShellProps` becomes `BlockShellProps`.
- `IslandGrid.tsx` becomes `BlockCanvas.tsx`; `IslandArrangementHost.tsx` becomes
  `BlockArrangementHost.tsx`.
- `island-grid.ts` becomes `block-geometry.ts`; `island-promotion.ts` becomes
  `block-placement.ts`.
- `IslandSurfaceClass` becomes `BlockSurfaceClass`; `IslandKindGlyph` becomes `BlockKindGlyph`;
  `IslandBodyBleed` becomes `BlockBodyBleed`.
- `check-island-classes.mjs` becomes `check-block-classes.mjs`.
- Test files follow their subjects.

No compatibility aliases and no deprecation window. A grep for `Island` outside the material and
token layer returns nothing when this lands.

### 2. Placement replaces mount

`MountPoint` today mixes three vocabularies: JetBrains chrome names (`stripe`, `chrome`), a paint
name (`island`), and placement names (`surface`, `companion`). Replace with placement, which is
what the field actually means:

```ts
export type BlockPlacement = "rail" | "dock" | "ground" | "full";
```

- `rail` — the left strip. Rail blocks stack vertically at rail density.
- `dock` — an edge strip. Which edge (`left | right | bottom`) is instance data, not a separate
  kind, so a block can be docked anywhere without redeclaring.
- `ground` — free placement on the canvas, painted as an island.
- `full` — the block owns the whole content region.

`blocksForMount` becomes `blocksForPlacement`. The old `companion` and `chrome` kinds both map to
`dock`; `stripe` maps to `rail`; `island` maps to `ground`; `surface` maps to `full`.

### 3. Free geometry, presets demoted to defaults

The instance owns its geometry; the descriptor owns its limits.

```ts
export interface BlockGeometry {
  readonly col: number;      // 1-based, 12-column canvas
  readonly row: number;      // 1-based, free row count
  readonly colSpan: number;
  readonly rowSpan: number;
}

export interface BlockLimits {
  readonly minCols: number;
  readonly minRows: number;
  readonly maxCols?: number;
  readonly maxRows?: number;
}
```

`BlockPresentation` keeps `sizes` renamed to `defaultSize: BlockSize` (one value, the shape it
takes when first placed) and gains `limits?: BlockLimits`. `minRows` defaults to the header-fit
minimum already computed by `sizesFailingHeaderFit`; that guard moves to a limits check.

`snapToDeclaredSize` is deleted. Resize drags any edge or corner, snaps to grid cells (not to
preset shapes), and is clamped by limits. The named `BlockSize` values survive as a "reset to
size" affordance in the block menu and as the initial-placement default, never as the constraint
set. Vertical resize works because rows are free.

### 4. The rail is ground

The window is one canvas painted by the material layer. It has regions, not columns:

- Rail region: a width (264 expanded, 44 collapsed, 0 hidden), painted by the ground, no border,
  no shadow, no background of its own.
- Dock regions: edge strips, same painting rule.
- Ground region: everything else, where the 12-column canvas lives.

Collapsing or hiding the rail widens the ground region and the canvas reflows into the reclaimed
space. That is what "the sidebar is just background" means mechanically: the rail contributes
region width, not chrome, and content grows into it when it yields. The rail casts nothing and
draws nothing; blocks in the rail are painted at rail density with no island treatment.

### 5. Chrome strips deleted

Both strips are removed from `IntuiShell.tsx`.

- Run relocates to a fixed action zone at the top of the rail, above the surfaces group.
- The surface switcher is deleted (the rail is the switcher).
- The person icon is deleted (the rail footer carries tenant and identity).
- Connection state becomes an ambient indicator in the rail footer beside the tenant: a dot plus
  a reconnect action when disconnected, nothing when connected.
- The duplicated operator name is deleted.

`MainToolbar.tsx` and `StatusBar.tsx` are removed or reduced to the rail footer indicator. Two
full rows return to content.

### 6. Whole-block drag

dnd-kit moves from handle-only to whole-block. The block is draggable by its header band and by
any non-interactive area of its chrome, the way a window is dragged by its frame; interactive
body content keeps its own pointer events. The explicit handle stays as a discoverable
affordance and as the keyboard-accessible drag entry.

Drag targets every placement: rail to ground, ground to dock, dock to ground, ground to full and
back. Each drop writes `view-instance` mutations through `emit` and returns a receipt, so every
arrangement change is recorded exactly as the block system requires.

### 7. Container blocks, with one drop-priority rule

Blocks may contain blocks, opt in only.

```ts
readonly acceptsChildren?: {
  readonly layout: "grid" | "stack" | "split" | "columns";
  readonly accepts?: readonly string[]; // descriptor ids or "*"
};
```

Only descriptors declaring `acceptsChildren` are drop targets for other blocks. The kanban block
declares `columns`; split and stack containers declare theirs. Everything else is inert to block
drops, which is what keeps nested drag systems from fighting, per the standing law.

Drop-target priority is one rule: the innermost declaring container under the pointer that
accepts the dragged descriptor wins; if none accepts, the drop falls through to the ground
canvas. dnd-kit collision detection is configured to that rule in one place, not per container.

The vendored `recursive-dnd-kanban-board` is the reference implementation for the nesting
mechanics.

### 8. Block body information architecture

The body gains a specified internal grammar so bodies stop being freeform. A body is composed of
sections, and a section is a labeled group with an optional action row:

- Section label: IBM Plex Sans 12/600, sentence case, one per group, omitted when the body has a
  single group.
- Rows and cards sit directly on the block base; no nested raised surfaces without a named
  reason.
- Forms inside a body align to one column grid and never span the full body width when the body
  exceeds a readable measure.
- A body with more than three sections is a defect; it wants to be more than one block.

Two migration proofs carry this: `CardView` (the object card, laid out for the block context, per
the Capacities-style object family) and the workspace substrate body (currently four unrelated
groups in one body, which resolves into separate blocks under the three-section rule).

## Deliverables

**OB1. Contract.** `packages/block-view/src/types.ts` gains `BlockPlacement`, `BlockGeometry`,
`BlockLimits`, `acceptsChildren`; `BlockPresentation.mounts` becomes `placements`, `sizes` becomes
`defaultSize` plus `limits`; `Island*` types renamed per choice 1. `registry.ts` gains
`blocksForPlacement`. Package tests cover placement filtering, limits clamping, and container
acceptance.

**OB2. Renames.** Choice 1, complete, including tests, gate scripts, and the `data-*` attributes
that name components rather than paint regions. Paint-region attributes and `--ij-island-*` tokens
are untouched.

**OB3. Geometry.** `block-geometry.ts` replaces `island-grid.ts`: free `col/row/colSpan/rowSpan`,
grid-cell snapping, limits clamping, `snapToDeclaredSize` deleted. `BlockCanvas.tsx` renders the
12-column canvas with free row spans and edge plus corner resize handles.

**OB4. Regions.** `IntuiShell.tsx` becomes a region host: rail, docks, ground, all painted by the
material layer, none carrying its own background or border. Rail width states drive ground width;
the canvas reflows on rail collapse.

**OB5. Chrome deletion.** Choice 5, including the rail top action zone for Run and the rail footer
connection indicator.

**OB6. Drag.** Choice 6 wiring: whole-block drag, cross-placement drops, receipts through `emit`,
keyboard drag preserved through the handle.

**OB7. Containers.** Choice 7: `acceptsChildren` honored by the canvas, one collision-detection
configuration implementing the innermost-accepting-container rule, kanban registered as the first
container block.

**OB8. Body IA.** Choice 8 applied to `CardView` and the workspace substrate body, with the
workspace body split into separate blocks where the three-section rule requires it.

## Acceptance

Report status as a scannable list leading with what is not done.

1. Grep for `Island` outside `src/styles` and paint-region attributes returns nothing.
2. A ground block resizes vertically by dragging its bottom edge, in single grid-row steps, and
   stops at its declared `minRows`.
3. Collapsing the rail widens the ground region and the canvas reflows; the rail draws no border
   and casts no shadow in either theme, with the ground gradient continuous beneath it.
4. No top strip and no bottom strip render on any surface; Run is reachable from the rail;
   disconnection shows one indicator in the rail footer and nowhere else.
5. Dragging a block from the rail onto the ground and back produces two `ObjectActionReceipt`s;
   the arrangement survives a reload with localStorage cleared.
6. A block dropped over a kanban container lands in that container; the same block dropped over a
   non-container block lands on the ground beneath it.
7. Dragging a block by its header moves it; clicking a button inside its body does not start a
   drag.
8. `CardView` and the workspace bodies each render three or fewer sections, with no nested raised
   surfaces lacking a named reason.
9. `pnpm gates` passes, including the renamed `check-block-classes.mjs`.

## Out of scope

The chat surface (its own handoff, unchanged), the Remotion and pdfx render pipelines, the native
shell and GPUI editions, the correspondence block family, Paper file authoring, and any change to
the material layer beyond consuming existing region attributes.

## Decisions to encode

One structural noun (block); island retained only as a paint treatment; placement replaces mount
with dock edges as instance data; geometry is free and presets are defaults; the rail is a ground
region, not a column; both chrome strips deleted with Run on the rail and connection in the rail
footer; whole-block drag across placements with receipts; container blocks opt in with an
innermost-accepting-container drop rule; block bodies carry a three-section limit.
