# Islands Material Layer: implementation plan

Register: execution checklist for Spec 34 + `35-AMENDMENT-MATERIAL-REVIEW.md`.
Canonical host: CommonPlace `apps/console`. Harness plan id: `plan:cab62c608af28b18`.
Visual proof: `docs/plans/console/islands-material/islands-material-v2.html`.

## Gap at plan time (literal)

Not shipped: WebGL Material Layer. Current `GroundCanvas` is a Canvas2D drifting-dot field. Shell paint is still CSS (`bg-ij-chrome`, `bg-ij-editor`, single bordered wrapper in `ConsoleApp`). Toolbar and status are islands inside that wrapper, not frame-resident. Gutters are ~4px (`p-1`), not ~10px. Island radius follows `--ij-arc` (8px), not ~10px.

## Checklist

| ID | Task | Spec | Acceptance | Proof |
|---|---|---|---|---|
| PT-DOCS | Amendment + this plan + decisions row | 35 all laws | Files on disk; decisions cite plan id | Path existence |
| PT-SHADER | WebGL MaterialLayer | Laws 1–4, 7 | SDF islands; terracotta ground; edge falloff ~4%; grain; register tokens only | `gate:register` |
| PT-SPACING | Frame chrome + gutters | Laws 5, spacing | Transparent toolbar/status; `data-island`; ~10px gutters; ~r10; wordmark gone | `gate:fence` + visual |
| PT-ANATOMY | Headers, scrollbars, nav | Laws 6, typography, scrollbars, nav | Manrope 600 headers; overlay scrollbars; stripe 36–40px | `gate:register` |
| PT-GATES | Invert paint audit + ledger | Law 7 | Shell islands expected transparent; MaterialLayer ledger row | `npm run gates` |

## Explicit deferrals (banked, not silently dropped)

1. **Light material retune.** Dark-first; light terracotta/falloff needs its own pass. (Amendment: Dark-first.)
2. **Full sidebar rethink.** Banked with Claude sidebar reference. Only the 36–40px nav row law ships now.

## Do Not Downgrade

See amendment. CSS gradients or Canvas2D dots are not the Material Layer.
