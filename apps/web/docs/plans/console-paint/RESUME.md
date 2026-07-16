# RESUME: console-paint

Start here after a context reset. Design: `design.md`. Plan: `implementation-plan.md`.

## Branch state

Branch `claude/console-paint-spec-a98159`, rebased onto `origin/main` @ `2015aaa` (17 commits current with main; the Chat and Index inquiry-layer / ACP work is included). My 4 commits on top, all verified live against the running dev server:

- `3363144` docs: design + implementation plan
- `2755b80` HP1: console chrome headings resolve to the UI sans face
- `a23dc03` HP2: widen console ground plane, gate AA on both planes
- `48272ea` HP5 + HP4: tighten Index stream density; lock divider + empty-state oracles

## Done (verified live on /index at 1440x900)

- **HP1 (font):** the site-wide unlayered `h1..h6 { font-family: var(--font-title) }` (global.css) outranks Tailwind's layered `.font-cr-ui` utility (unlayered beats layered), so console headings rendered serif. Fix: `.porcelain :is(h1,h2,h3,h4,h5,h6) { font-family: inherit }` in `src/styles/console-shell.css`. Verified: `h2` now computes `IBM Plex Sans`.
- **HP2 (planes):** stock ground-to-surface step was 0.022 OKLCH L (bled together). Widened ground by `GROUND_DROP = 0.03` in `scripts/build-register.mjs` (the package Axes expose no plane-step knob; the ground does not feed ink solving, so on-surface pairs are untouched). Added an on-ground AA gate (ink/ink2 at 4.5, ink3/signal/link at 3). Regenerated `src/styles/console-register.css`: ground now `oklch(91.5%)`, delta 0.052 L, AA green both planes. Verified: rendered delta ~0.060.
- **HP5 (empty states + density):** the inspector empty state (`IndexDetail.tsx:168`) is already `text-cr-small text-cr-ink-3`, and the files reader hint (`files.module.css .readerHint`) is already `--text-xs`, so both were already compliant at HEAD. Tightened Index stream density in `StreamLens.tsx` (`py-cr-1`, `gap-cr-2`).
- **HP4 (oracles):** authored in `apps/web/e2e/console-paint.spec.ts`: font resolution, plane separation, divider subordination, empty-state restraint. All green at HEAD. NOT yet wired into CI (see remaining).

## Remaining

1. **HP3 canvas ground (design-gated; user approved the direction).** Build `src/components/v2/ConsoleGroundCanvas.tsx` adapting `src/components/commonplace/shared/DotField.tsx` (djb2 + mulberry32 PRNG, dimension guards, ResizeObserver containment) and add: one rAF drift loop, IntersectionObserver + `visibilitychange` suspension, `usePrefersReducedMotion` single static frame, oklch token read (`src/lib/v2/oklch-read.ts`, since the existing `hexToRgb` cannot parse oklch), seed from `djb2(process.env.NEXT_PUBLIC_COMMONPLACE_TENANT ?? 'Travis-Gilbert')`. Color: `--cr-ink-3` low opacity over `--cr-ground`. Mount as the first child of the `.porcelain` div in `src/app/(console)/layout.tsx`, behind `V2Shell`, `aria-hidden`, `pointer-events:none`, `z-index:0`. Edit `DESIGN.md` motion section (delete "No ambient motion in the monitoring shell"; the user authorized this). Verify: reduced-motion single frame, idle-tab suspension, DOM identical with/without.

2. **HP5 chat affordance row (design-gated; user approved the direction) — RE-READ FIRST.** The chat surface changed on main. `src/app/(console)/chat/page.tsx` now renders `TheoremAgentThread` from `src/components/agent/theorem-agent-thread.tsx` (ACP assistant-UI bridge; also `head-contribution.tsx`, `permission-prompt.tsx`), NOT the old `Omnibar`. The bare-Omnibar basis for HP5 is stale. Re-read `theorem-agent-thread.tsx` to find the real composer + whether real thread/message state now exists (the ACP work added assistant-transport ThreadMessage state, so real "recent threads" may now be wireable). Then add the affordance row above the composer: real controls only (No Fake UI), backed by real thread state or the agent's real modes; no hardcoded prompt arrays. Add the empty-state oracle target if the new surface exposes one.

3. **HP4 CI wiring.** Add a merge-blocking Playwright step to `.github/workflows/commonplace-ci.yml` (`npx playwright install --with-deps chromium` then `npm run test:e2e` in `apps/web`). Note: `@playwright/test` is not resolvable from the offline pnpm store locally, so the suite runs in CI; local proof is the Browser pane probe. Extend `scripts/lint-console-register.mjs` `MIGRATED_COMPONENTS` with the new files (`components/v2/ConsoleGroundCanvas.tsx`, the affordance-row component).

## Key facts

- Dev server: `preview_start({name:'web'})` (port 3000). After the rebase it must be restarted to pick up the new tree; re-verify HP1/HP2 hold. Console index route is `/index` (route groups do not show in the URL). The preview pane tab drifts to the public site on idle/screenshot; navigate to `/index` immediately before probing.
- Register: `@travis-gilbert/markdown-theory@0.1.2`. `wcagContrast(a,b)` takes Oklch `{l,c,h}` (l in [0,1]). `defaultBands(axes)` returns ink/accent search bands, NOT plane anchors. `DEFAULT_TARGETS = {ink:4.5, ink2:4.5, ink3:3, signal:4.5, link:4.5}`.
- Design gate: HP3 and the HP5 affordance row are new visual surfaces; per project rules run the design specialists and keep them register-native. The user approved the proposed direction for both in this session.
- No em or en dashes in any file (project rule). No Fake UI in shipped surfaces.
