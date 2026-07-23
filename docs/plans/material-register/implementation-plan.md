# Material register: implementation plan

Spec: [SPEC-MATERIAL-REGISTER-1.0.md](./SPEC-MATERIAL-REGISTER-1.0.md). App: `apps/console`.

## Not done (status lead)

- Nesting-radius lint (parent minus gap) not automated; raw px radius lint shipped
- `DischargeState` texture states beyond `Deterministic` (FORME backend absent)
- Playwright grayscale rail screenshot as CI artifact
- Pane content-sizing between min/max (named choice 9 height rule) not fully rewired across island shell

## Verify-first

| Check | Finding |
|---|---|
| V1 | 161 `--ij-*`; surfaces are frame/editor/chrome/raised (not five tiers). Dark L spread ~24%–35% (~11pp). |
| V2 | `gate:contrast` exists (`scripts/check-contrast.mjs`); D3 extends it. |
| V3 | `CanvasPaperGround` undeclared; React DotGrid hides `getContext`. D6 requires `ShaderSurface`. |
| V4 | `IslandKindGlyph` closed set of 15 in `packages/block-view`. |
| V5 | `MountPoint` + `BlockSize` live; `BlockPlacement` not shipped. Radius scale keys off `BlockSize`. |

## Deliverable checklist

- [x] D1 Five elevation tiers + measured lightness retune (spec D1)
- [x] D2 Radius scale, nesting lint deferred, `corner-shape: squircle` (spec D2)
- [x] D3 Contrast gate floors + selection two-of-four (spec D3)
- [x] D4 Kind hue generator from enum (spec D4)
- [x] D5 Rail tiers, contrast, selection edge marker (spec D5)
- [x] D6 `ShaderSurface`, material map, declare `CanvasPaperGround` (spec D6)
- [x] D7 Empty-state causes + `EmptyRegion` at sunken; content-height rule still partial (spec D7)

## Named adaptations

1. Package API is `ShaderMount` (vanilla `@paper-design/shaders`), not `createShader(canvas, opts)`. `ShaderSurface` owns a host, calls `getContext` on the mount canvas in-file, and caps live contexts.
2. Texture axis: only `Deterministic` reachable until FORME handoff lands.
3. Paper MCP used for a side-by-side tier fixture artboard after D1, not as the token source of truth.
