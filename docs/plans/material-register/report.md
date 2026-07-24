# Material register: status report

Spec: SPEC-MATERIAL-REGISTER-1.0. App: `apps/console`.

## Not done

- Nesting-radius lint (parent minus gap) not automated; raw px radius lint shipped.
- `DischargeState` textures beyond `Deterministic` (FORME backend absent).
- Playwright grayscale rail screenshot as CI artifact.
- Pane content-sizing between declared min/max (named choice 9 height rule) not fully rewired across island shell.

## Shipped

### D1 Elevation tiers
Five tiers: `sunken`, `ground`, `raised`, `floating`, `scrim`. Structural surfaces remapped.

Dark OKLCH L% (approx):

| Role | Before | After |
|---|---|---|
| editor (sunken) | 23.95 | 17.69 |
| frame (ground) | 35.23 | 22.23 |
| chrome (raised) | 29.63 | ~30 |
| raised (floating) | 35.23 | 40.15 |
| spread (sunken→floating) | ~11.3pp | ~20.7pp |

Keylines on raised+; shadow only on floating/scrim (`--ij-floating-shadow`, `--ij-popover-shadow`).
Paper fixture: artboard "Material elevation tiers" (Island Shells file).

### D2 Radius scale
`--ij-radius-xs|sm|md|lg|xl`, `corner-shape: squircle` on raised/floating, `gate:radius` with seeded probe.

### D3 Contrast gate
Extended `check-contrast.mjs`: rail floors (Int UI), selection two-of-four rule, fill-only probe, decorative keyline registry.

### D4 Kind hues
`--ij-kind-*` in register-bridge (fixed L/C ramp); `kind-hues.ts` returns `var(--ij-kind-*)`; glyph coloring + `kindEdgeStyle`.

### D5 Rail
`Sidebar` ground tier, raised rows, selection = fill + accent keyline + weight; shortcuts at disabled/small tier.

### D6 ShaderSurface
Vanilla `@paper-design/shaders@0.0.77` (pinned), owns `getContext` in-file, context budget 4, reduced-motion / offscreen pause, token-derived colors. `CanvasPaperGround` re-expressed; declared on `DECLARED_PAINT_SURFACES` (motion gate: 4 surfaces).

### D7 Empty states
`EmptyRegion` primitive: sunken floor, named cause (`no-results` | `not-loaded` | `not-connected`), optional resolving action. Wired through `ViewState` (empty + unavailable), `IslandEmptyBody`, canvas empty, and not-loaded call sites (`CodeFileView`, `CardView`, `GalleyDocView`).

## Verification

- `npm run gates`: pass (fence, register, contrast, radius, motion, icons, tokens, islands)
- `src/lib/material` + `ViewStates` + canvas tests: pass
