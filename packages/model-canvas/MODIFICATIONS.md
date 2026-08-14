# Modifications to OWOX/models

Upstream: https://github.com/OWOX/models (Apache-2.0). Vendored from
commit `1d12fae4001e99f4e6486e695945279e2c5ad553` into
`packages/model-canvas` and `packages/okf` under CommonPlace.

Remote retained for cherry-picks: add with
`git remote add owox-models https://github.com/OWOX/models.git` when missing.

## Day-one gut (SPEC-COMMONPLACE-MODEL-CANVAS-FORK-1.0 MF1)

Removed from this fork:

- Entire `packages/server` (never copied)
- Supabase optional accounts (`lib/supabase.ts`, `lib/account.tsx`, `lib/auth.tsx`, `lib/models.ts` blob store)
- PostHog (`analytics/posthog.ts`)
- Gemini insight-questions call (`lib/questions.ts`, `QuestionsPanel`)
- Push-to-OWOX (`sync/push*`, `PushConfirmDialog`, `OwoxImportDialog`, `OwoxDataMartsHero`)
- URL-blob sharing (`share/*`, `ShareButton`)
- Sign-in / welcome / template gallery SPA chrome that depended on the above
- Vite SPA entry (`main.tsx`, `App.tsx`, `index.html`)

## Gap-closure gut (2026-07-29)

- `okf/github.ts` -- remote fetch hard-refuses; no Contents API / raw host calls
- `okf/bundlesIndex.ts` -- verified gallery fetch hard-refuses
- `lib/links.ts` -- signup URLs emptied
- Inspector copy retokened from product push to Declare / registry language

## Studio re-vendor (2026-08-07)

Re-vendored OWOX `packages/web` surface organs into this package:

- `components/canvas/Dock.tsx`
- `components/inspector/*` (QuestionsPanel omitted)
- `components/rail/{ModelSheet,RightRail,HistoryPanel,MyModelsPanel,useRightPanel}`
- `components/TopBar.tsx` (OWOX logo / Push / Share / EnableControl removed; Declare + OKF remain)
- `components/ClearCanvasDialog.tsx`
- Composition: `components/studio/OwoxStudio.tsx` (Canvas+Dock+Inspector+rail+TopBar)

History binds to registry version rows via props, not `model_versions`.
My Models lists host-provided scopes, not Supabase SavedModel rows.

## Replacements

- Package names: `@mc/okf` → `@commonplace/okf`, `@mc/web` → `@commonplace/model-canvas`
- Peer React 19 to match the CommonPlace console
- `ModelCanvasShell` / `OwoxStudio` mounts the OWOX-shaped studio with zero third-party product calls
- Persistence through the console object seam (`canvas.model.*`), not Supabase
- Semantic truth lives in the Theorem schema registry; this package holds layout and canvas UI only
- React Flow measurement changes are ignored; only changed node coordinates emit layout updates
- Repeated React Flow selection notifications are deduplicated before they reach a controlled host
- Position commits happen on drag-end only (mid-drag streams stay local to React Flow)
- `fitView` runs once on init, not continuously while the controlled graph rebuilds

LICENSE and NOTICE from upstream are preserved beside this file.
