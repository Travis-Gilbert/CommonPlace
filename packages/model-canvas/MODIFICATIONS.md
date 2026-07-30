# Modifications to OWOX/models

Upstream: https://github.com/OWOX/models (Apache-2.0). Vendored from
`models-main.zip` (commit `f92db098bfcbae22f2f78eec43310b6ab9f6a564`) into
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

## Replacements

- Package names: `@mc/okf` → `@commonplace/okf`, `@mc/web` → `@commonplace/model-canvas`
- Peer React 19 to match the CommonPlace console
- `ModelCanvasShell` mounts an empty in-memory ERD with zero network
- Persistence through the console object seam (`canvas.model.*`), not Supabase
- Semantic truth lives in the Theorem schema registry; this package holds layout and canvas UI only

LICENSE and NOTICE from upstream are preserved beside this file.
