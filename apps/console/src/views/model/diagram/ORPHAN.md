# Orphaned pre-fork diagram components

`SPEC-COMMONPLACE-MODEL-CANVAS-FORK-1.0` supersedes the hand-rolled MC1 canvas.

Live surface: `ForkDiagramCanvas.tsx` + `@commonplace/model-canvas`
(`MartNode` / `RelEdge` / `ModelCanvasShell`).

These files remain for anatomy reference only and are **not** exported from
`diagram/index.ts`:

- `ObjectTypeCard.tsx`
- `GhostCard.tsx`
- `RelationEdge.tsx`

Do not extend them as the long-term model canvas. Apply MC2–MC5 customization
to the fork package components instead.
