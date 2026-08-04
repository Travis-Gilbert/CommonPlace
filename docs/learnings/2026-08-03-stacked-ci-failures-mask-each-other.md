---
title: One red CI job can hide three separate failures, and all three can predate the PR
kind: gotcha
date: 2026-08-03
scope: CI (Console lint/tests/constitutions, Gates/unit-tests/build) + any PR triage
---

## trigger_case (the real scar)

PR #173 showed two failing jobs. Both traced to a single eslint error at
`apps/console/src/views/OpenworkChatRegister.tsx:22`. Fixing it and pushing
turned up a *different* failure in the same job: a stale vitest assertion in
`src/app/chat/page.test.tsx` that `eslint` had been failing before. Fixing
that turned up a *third*: `error TS2352` in
`src/editor-model/document-store.test.ts` at the Typecheck step, which had
never run because the earlier steps exited first.

Three pushes, three "the blocker is cleared" claims, before the job was
actually green. Worse, none of the three came from the PR:
`git diff --stat origin/main...origin/feat/ide-substrate-wire -- <file>`
returned empty for all of them. `main` had been red on these since
`b367aaea` ("Land production cutover"), which changed `app/chat/page.tsx`
without updating its test.

## rule_short

A CI job is a step sequence with `-e -o pipefail`: the first failing step
hides every step after it. Never report a job as unblocked after fixing one
step. Read the job's failing *step name*
(`gh api repos/O/R/actions/jobs/<id> --jq '[.steps[]|select(.conclusion=="failure")|.name]'`),
fix it, and expect the next step to fail too until the job actually reports
pass.

Before attributing any failure to the PR, check whether the branch even
touches the file:
`git diff --stat origin/main...origin/<branch> -- <path>`. Empty output means
it is a `main` regression the PR merely surfaced, and it belongs in the
report as such, not as "my change broke this."
