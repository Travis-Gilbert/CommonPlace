# Isometric register: visual reference for the graph (not a product delivery)

Canonical text: [SPEC-ISOMETRIC-REGISTER.md](./SPEC-ISOMETRIC-REGISTER.md).

## Correction

SPEC-ISOMETRIC-REGISTER is **not** an `apps/web` chrome / Index / Growth adoption
spec for this track. It is a **visual reference** for how graph nodes and graph
chrome should paint: extruded solids, hard keylines, one warm accent, halftone
edge language, and **flat content planes** (no tilted body text).

An earlier pass incorrectly started I1–I3 as a product register in `apps/web`.
That code is removed. The data canvas / graph work in `apps/console` remains the
implementation target (see `docs/plans/data-canvas-graph-native/`).

## What to take from the reference

| Cue from the iso spec | Graph application |
|---|---|
| Hard keyline (`--iso-keyline` weight idea) | Card / node stroke from register (`--ij-*`), heavier than a 1px Notion card |
| One accent hue | Selected / accented nodes use `--ij-accent` (or preset color map), not a second palette |
| Extruded edge / depth | Optional offset edge or raised token on **node chrome only**; never transform the text plane |
| Halftone on the edge | Optional Paper / CSS texture on node side or canvas ground; not required as SVG product chrome |
| contentFlat / isometric-for-chrome | React Flow nodes stay axis-aligned; pan/zoom is the only transform on the work plane |
| Separable skin | Graph paint stays register tokens; no bespoke hex |

## What not to build from this file

- `[data-register="isometric"]` product register on porcelain / Index / Growth
- `IsometricSurface` as an apps/web UI framework
- I3 chrome adoption set (register switcher, Index tile grid, etc.)
- Tilted transforms on card body text

## Linked implementation

- Graph / data canvas: `docs/plans/data-canvas-graph-native/`
- Console canvas view: `apps/console/src/views/canvas/`
- Paper ground (already on canvas): `CanvasPaperGround` via `@paper-design/shaders-react`
