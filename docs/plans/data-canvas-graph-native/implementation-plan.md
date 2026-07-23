# Data Canvas Graph Native: implementation plan

Implements SPEC-DATA-CANVAS-GRAPH-NATIVE-1.0 in `apps/console`,
`packages/block-view`, and new `packages/json-canvas`. Spec copy:
`SPEC-DATA-CANVAS-GRAPH-NATIVE-1.0.md`.

## Verify-first results (required by the spec)

1. Arrangement: no canvas object type or `CanvasPlacement` exists. Goal Stack
   pins via `localStorage` + harness `pin_position`; `view-instance` has no
   spatial contract. D1 defines `CanvasPlacement` keyed by
   `(canvas_id, object_id)` and a `CanvasStore` seam (fixture v0, same pattern
   as proactivity). Spec: Verify first 1, Named choice 2, D1.
2. Block vocabulary on main: `MountPoint`
   (`stripe|chrome|island|surface|companion`), not AMENDMENT-02
   dimensionality. Spec: Verify first 2, Named choice 4.
3. Obsidian sync: absent. D6 is file import/export. Spec: Verify first 3,
   Named choice 8, D6, Out of scope.
4. Block contract confirmed in `packages/block-view/src/types.ts`. Spec:
   Verify first 4.
5. Registry: `CANVAS` descriptor exists but renders `IslandEmptyBody`. Spec:
   Verify first 5, D3.

## Clarification: commit-graph

jal-co `commit-graph` is already adopted for automation history and the
proactivity commit language. This spec's renderer is React Flow (Named choice
5). The programmable DAG (Goal Stack) stays its own descriptor (Named choice
7). Commit-graph is not the data-canvas node language.

## Deliverables

- [x] D1 Canvas object model + `CanvasStore` arrangement persistence. Spec: D1.
- [x] D2 `packages/json-canvas` types, validator, to/from mapping, round-trip
      tests. Spec: D2.
- [x] D3 `CanvasView` + registry mounts `surface`+`companion`, sizes `v`+`full`.
      Spec: D3, Named choice 4–5.
- [x] D4 Agent authorship: direct ObjectActions + apply validated JSON Canvas.
      Spec: D4, Named choice 6.
- [x] D5 Preset 1–6 to `--ij-*` tokens; hex preserved round-trip. Spec: D5.
- [x] D6 `canvas` glyph + `.canvas` import/export API edge. Spec: D6.

## Sequencing

1. D2 + D5 package (pure TS, tests first).
2. D1 store + host routing.
3. D3 view + registry + glyph.
4. D4 apply seam + D6 file edge.
5. Gates.
