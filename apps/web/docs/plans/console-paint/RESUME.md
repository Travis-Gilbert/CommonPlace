# RESUME: console-paint

Status: COMPLETE. All five HP deliverables are implemented and verified; see the PR from branch `claude/console-paint-spec-a98159`. Design: `design.md`. Plan: `implementation-plan.md`.

## What shipped

- **HP1 (font):** `.porcelain :is(h1..h6) { font-family: inherit }` in `src/styles/console-shell.css`; console headings compute IBM Plex Sans (unlayered rule outranks the layered utility).
- **HP2 (planes):** ground widened by `GROUND_DROP = 0.03` in `scripts/build-register.mjs` with an on-ground AA gate; regenerated register; live delta ~0.060 OKLCH L.
- **HP3 (canvas ground):** `src/components/v2/ConsoleGroundCanvas.tsx` (tenant-seeded dot field, one throttled rAF loop, visibilitychange + IntersectionObserver suspension, reduced-motion single frame) painting ink-3 over the layout's `bg-cr-ground`, mounted at `z-index -1` inside the now `relative isolate` porcelain div in `src/app/(console)/layout.tsx`. OKLCH token read via `src/lib/v2/oklch-read.ts`, delegating to `@travis-gilbert/markdown-theory/tokens` `oklchToSrgb` (pinned by `oklch-read.test.ts`). Root `DESIGN.md` motion policy updated to the quiet ambient ground policy.
- **HP4 (oracles + CI):** `apps/web/e2e/console-paint.spec.ts` covers font resolution, plane separation, divider subordination, empty-state restraint (index + chat), ground-canvas drift, and reduced-motion static frame. `lint:register` added to the CI quality job (was never wired); `MIGRATED_COMPONENTS` extended with `ConsoleGroundCanvas.tsx` and `agent-mode-row.tsx`; the e2e job's step names the console-paint oracles.
- **HP5 (chat + density + empty states):** Index density and inspector empty state landed earlier. Against the rebuilt `TheoremAgentThread`: `src/components/agent/agent-mode-row.tsx` is the affordance row: real single/composed mode controls keyed to the ACP process, binding + session facts, and no recent-threads region because no session-history source exists. Thread welcome quieted to small ink-3. Mode switch remounts the runtime via React key and is offered only on an empty thread.

## Repairs made along the way (pre-existing breakage found while verifying)

- `/chat` 500'd on direct load at HEAD: `useAssistantTransportState` throws while the transport is unbound (SSR and mode-switch remount). Fixed with `src/components/agent/use-theorem-agent-state.ts` (defensive extras read); `permission-prompt.tsx` and the contribution ledger moved onto it, and the ledger's selector no longer filters inside getSnapshot (uncached-snapshot loop).
- CI lint errors in `(published)` pages (bare `<a href="/">`): converted to `next/link`.
- The D7/WL-5 e2e suite failed 6/7 because the CommandBar placeholder was renamed by the inquiry-layer work; `e2e/support/measure.ts` `CAPTURE_PLACEHOLDER` updated.

## Known remaining CI reds on main (named, out of console-paint scope)

- Bundle size budget exceeded by ~12 MB (ACP/assistant-ui dependency weight; product decision needed).
- `quality:commonplace` fails on legacy porcelain surfaces (5 contrast pairs, 2 motion durations, 5 typography values in `--cp-*` files); legacy porcelain is explicitly out of register-migration scope until those surfaces migrate.
