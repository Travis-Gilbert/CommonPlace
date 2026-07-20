# Islands Material Layer: acceptance report

Harness plan: `plan:cab62c608af28b18`
Date: 2026-07-20

## Literal state

**Shipped:** WebGL Material Layer with quieter layered terracotta (ground glow ~0.32, island tint hint), stripe as frame-resident activity bar (not an island), editor chrome-band + well hierarchy, Compact density in Appearance, gutter accent on hover/drag. Shell fills stay transparent; paint audit inverted for shell regions. Grain lowered; island headers read slightly richer than flatter island bodies. Toolbar search field removed (Shift Shift / Cmd K still open Search).

**Not shipped:** Terminal / bottom dock (removed from the web console until a desktop shell designs it); fuller light material retune.

## Checklist

| ID | Status | Evidence |
|---|---|---|
| PT-DOCS | done | `docs/plans/console/35-AMENDMENT-MATERIAL-REVIEW.md`, `islands-material/implementation-plan.md`, decisions row 23 |
| PT-SHADER | done | `apps/console/src/components/ground/MaterialLayer.tsx` |
| PT-SPACING | done | `ConsoleApp`, `IntuiShell`, frame-resident toolbar/status, `data-island` |
| PT-ANATOMY | done | Manrope headers, overlay scrollbars in `app.css`, `h-ij-nav-row` |
| PT-GATES | done | `npm run gates` clean (fence, register, contrast, motion, icons, tokens) |

## Proof sketch

`docs/plans/console/islands-material/islands-material-v2.html`
