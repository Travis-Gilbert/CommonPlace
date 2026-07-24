# Data Canvas Graph Native: status report

Spec: SPEC-DATA-CANVAS-GRAPH-NATIVE-1.0.

## Not done / not verified

- Live Obsidian two-way sync: no seam exists; file import/export is the edge (spec out of scope).
- Harness-backed canvas object types: v0 is `CanvasStore` (tenant-scoped localStorage) behind BlockHost, same fixture-seam pattern as proactivity. v1 swap is not shipped.
- Playwright visual baseline for the canvas surface: not run in this session.
- Full `pnpm gates` / console e2e suite: fence + register + icons + unit tests run; contrast/motion/islands/tokens not re-run end-to-end here.
- Paper MCP design extraction: Island Shells `ShaderDotGrid` (BA-0) exported via Paper MCP. Geometry: size 0.7, gapX/Y 32, shape triangle, strokeWidth 0. Wired through `ShaderSurface` + `CanvasPaperGround` with register colors (`--ij-editor` / `--ij-seam-raised`); Paper's light fill + CSS invert stack stays design-tool presentation.
- `CanvasPaperGround` is declared via `ShaderSurface` (owns `getContext` in-file). Inventory row "Data canvas paper ground" documents the static Paper DotGrid paint.

## Shipped

- **D2** `packages/json-canvas`: JSON Canvas 1.0 types, validator, serialize, `toJsonCanvas` / `fromJsonCanvas`, round-trip tests (6/6).
- **D5** Preset 1-6 to `--ij-*` tokens in `colors.ts`; hex preserved in package round-trip tests.
- **D1** `CanvasStore` + object bridge: arrangement as GraphCanvas with placements, groups, connections; unlink leaves object; missing tenant refuses.
- **D3** `CanvasView` + registry: mounts `surface`+`companion`, sizes `v`+`full`, `kindGlyph: canvas`, React Flow renderer.
- **D4** Agent path: `invoke_tool` `canvas.apply_json` / `canvas.import_json` applies validated documents as receipted store mutations; `/api/canvas/validate` validates without applying.
- **D6** `canvas` added to `IslandKindGlyph`; client Import/Export of `.canvas` files; validate route for the edge.
- **Paper amendment** `CanvasPaperGround`: Paper Island Shells DotGrid extract via `ShaderSurface` (`dotGridFragmentShader`, size 0.7, gap 32, triangle, speed 0, register colors). Replaces xyflow `Background` dots.

## Clarification: commit-graph

jal-co commit-graph remains the automation-history / proactivity commit language. This data canvas uses React Flow cards (Named choice 5). The programmable DAG (Goal Stack) is untouched (Named choice 7).

## Clarification: isometric register

`SPEC-ISOMETRIC-REGISTER` is a **visual reference** for graph node paint (hard keylines, one accent, extruded edge language, flat text plane). It is not an `apps/web` product register to adopt on Index/Growth chrome.

## Verification

- `packages/json-canvas` vitest: 6/6 pass
- `apps/console` vitest `src/lib/canvas`: 5/5 pass
- `packages/json-canvas` tsc: pass
- `gate:fence`, `gate:register`, `gate:icons`: pass
