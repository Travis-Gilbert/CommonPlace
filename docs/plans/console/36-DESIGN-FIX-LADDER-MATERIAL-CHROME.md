# Console design fix: ladder, MaterialLayer, chrome, rail IA

Plan id: `plan:b208c222ff5bbfb0`
Source: Claude design diagnosis (shader scale, dark ladder, chrome redundancy, rail IA).
Workspace: `Creative/Website/CommonPlace` (island MaterialLayer lives here).

## Order (executed)

1. **Dark ladder** — both island fills darker than frame; compress spread; root `background: var(--ij-frame)`; header bands retuned; contrast gate updated.
2. **MaterialLayer scale** — per-`data-block-size` radius; gutter/gradient/sheen scale with island coverage.
3. **Chrome deletion** — hide single-tab strips; full blocks omit BlockShell title header.
4. **Rail / layout IA** — monochrome rail icons; layout switcher grouped Work / Objects / Tools / System.
5. **Overstuffed surfaces** — Appearance nested raised cards flattened. No Models surface in this tree; multi-block Models split deferred.

## Proof

- `npm run gate:contrast`
- `npm run gate:tokens`
- `npm run gate:radius`
- `npm run gate:icons`
- `npm run gate:fence`
- `npm run gate:blocks`
- `vitest` BlockShell + theme-engine

Reverified on 2026-07-27 during the PR #110 merge repair: all 12 Console gates,
the full Console unit suite, and the clean Playwright suite pass.

## Follow-up

- Visual e2e / screenshot pass against islands-material proof.
- When a Models (or similar four-section) surface exists, split into ≤3 ground blocks so gutters reappear.
- Plan substrate transitions for this plan may need reclaim (lease expired mid-run).
