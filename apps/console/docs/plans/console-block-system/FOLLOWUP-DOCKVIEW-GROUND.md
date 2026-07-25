# FOLLOWUP: Dockview ground canvas

Repo `Travis-Gilbert/CommonPlace`. Ground layout after the one-block contract
(`HANDOFF-CONSOLE-ONE-BLOCK-MODEL` OB3 / `BlockCanvas.tsx`).

## Decision

Adopt [dockview](https://github.com/mathuo/dockview) (`dockview-react`) as the
upstream for ground block geometry: split, dock, serialize, and drag of panels
with a fixed gutter. Do not adopt `react-grid-layout`.

## Why not react-grid-layout

RGL is a tile grid with margin math. Dockview is a layout manager (grid +
groups + tabs + floating) that matches one-block placement (ground / dock /
full) and keeps native drag without inventing a second kanban layer.

## Constraints that stay

1. **6px gutter.** `--ij-island-gutter` remains the register gap between ground
   blocks. Dockview theme / separator size must bind to that token.
2. **One drag law for cards.** Nested kanban card and column movement stays on
   `@dnd-kit` inside container blocks (`acceptsChildren`), per choice 7 and the
   vendored recursive-dnd-kanban reference. Dockview owns *block* arrange;
   dnd-kit owns *card* arrange inside a kanban block.
3. **Receipts.** Every ground rearrange still writes `view-instance` geometry
   through `emit` (or the serialized dockview layout mapped onto
   `BlockGeometry` / placement fields).
4. **Paint.** Dockview chrome is reskinned through Int UI / island tokens only.
   No dockview default theme colors in product.

## Deliverable

Replace the hand-rolled CSS-grid + sortable cell path in `BlockCanvas.tsx` with
a thin `DockviewComponent` adapter. Keep promotion zones (rail / dock / full)
and container nesting collision detection. Delete
`snapToDeclaredSize` leftovers if any remain after free geometry.

## Out of scope here

Full dockview rewrite lands in its own PR after chat surface + Paper sidebar
reconcile on the block contract tip.
