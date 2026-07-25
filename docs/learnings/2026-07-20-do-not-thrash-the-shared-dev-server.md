---
title: Killing port 3010 between Playwright runs manufactures failures that look like flaky tests
kind: anti_pattern
date: 2026-07-20
scope: apps/console e2e (playwright.config.ts reuseExistingServer)
---

## trigger_case (the real scar)

Iterating on a new e2e spec, I prefixed every run with
`lsof -ti:3010 | xargs kill -9` to "start clean". Four consecutive runs of the
*same* spec against the *same* code:

| run | result | failure shown |
|---|---|---|
| 1 | 5 passed, 3 failed | fixture bug (real) |
| 2 | 6 passed, 2 failed | popover z-index (real) + cold-compile timeout |
| 3 | 4 passed, 4 failed | `[data-surface-nav]` never appeared |
| 4 (warm, no kill) | **8 passed in 13.8s** | none |

Run 3's failures were a different set of tests than run 2's, which is what a
flaky suite looks like. It was not flake. `playwright.config.ts` sets
`reuseExistingServer: true`, so killing the port meant each run raced a fresh
`next dev` cold compile against a 5-second default `expect` timeout, and
whichever test happened to land first lost.

Worse variant later in the same session: the preview tool owned 3010, Playwright
*reused* that server, and the preview server pointed at a data API that was not
running. Every test failed with `toBeVisible()` on the shell itself. I briefly
read 8/8-failing as a regression in code that had passed minutes earlier.

## rule_short

Do not kill the dev server between e2e runs, and do not let two harnesses share
one server when they need different env.

```bash
# Warm it once, then iterate against it.
npm run dev &            # or preview_start
curl -s -o /dev/null -w "%{http_code}\n" localhost:3010/   # wait for 200
npx playwright test <spec>          # repeat freely, ~14s per run

# Before an e2e run, stop the preview server so Playwright starts its OWN
# with playwright.config.ts's env (stub on 50591, AUTH_SECRET, identity).
preview_stop(...)
```

Give the first navigation in a spec's setup helper an explicit long timeout, so
a cold compile costs seconds rather than a false failure:

```ts
await expect(page.locator('[data-filing-index]')).toBeVisible({ timeout: 30_000 });
```

## why

`reuseExistingServer: true` means "whatever is on 3010 is the system under
test." That is fine when the thing on 3010 is Playwright's own server with
Playwright's own env. It is actively misleading when the thing on 3010 is a
preview server configured for a different backend, because the resulting
failures are indistinguishable from product regressions.

The tell that a failure is environmental rather than real: **the failing set
changes between identical runs**, or the failure is on the shell's own chrome
(`[data-surface-nav]`, the toolbar) rather than on the feature under test. A
real defect fails the same assertion every time.

Corollary that paid off: runs 1 and 2 *did* surface real defects (a fixture
anchored to the wrong timestamp, and a popover portaling behind its own
scroll container). Warming the server did not hide those. It only removed the
noise that was making them hard to see.
