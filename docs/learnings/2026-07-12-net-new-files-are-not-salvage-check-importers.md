---
title: "\"Net-new files\" on a superseded branch are not salvage until you check importers"
kind: anti_pattern
date: 2026-07-12
area: branch triage / cherry-pick
rule_short: "Before cherry-picking 'net-new' files off a dead/superseded branch, grep the TARGET branch for importers of those files. No importer on target = orphan dead code; the value lived in the branch's component edits, which are the superseded part."
---

## trigger_case

Triaging 6 straggler branches for merge into `main`. Five were fully superseded (0 net-new files). `operator-live-backend-gaps` was flagged NEEDS-HUMAN because it had 4 genuinely net-new files: `apps/web/src/components/commonplace/views/WeaveSpinner.{tsx,module.css}` and `apps/web/src/components/island/WeaveSpinner.{tsx,module.css}`, absent everywhere on `main`/porcelain. The obvious move (approved by the user) was "cherry-pick the 4 WeaveSpinner files."

Verification before executing: `git grep` on porcelain HEAD for `views/WeaveSpinner` / `island/WeaveSpinner` importers returned nothing. The only importers (`AgentThreadView.tsx`, island `Omnibar.tsx` referencing `./WeaveSpinner`) existed ONLY on the superseded straggler, and porcelain's current versions of those components differ. Cherry-picking just the 4 files would have added orphan dead code — which the repo's "No Fake UI / no orphan scaffolding" rule forbids. Salvage is only real if the component is also WIRED, which requires the superseded component edits.

## rule

- "Net-new file exists nowhere on target" is necessary but NOT sufficient for cherry-pick. Also confirm an importer exists (or will exist) on the target.
- If importers live only on the dead branch, the artifact is orphan-on-arrival. Either wire it deliberately into the target's current components (a real change), or drop it. Do not commit it unreferenced.
- Preserve the source files (scratchpad / hold the branch) before deleting, so the "wire it properly" option stays open.
