---
title: "apps/web standalone lockfile: file: protocol installs, workspace:* does not"
kind: gotcha
date: 2026-07-12
area: CommonPlace monorepo / npm / Railway deploy
rule_short: "For a standalone lockfile regenerated with `npm ... --workspaces=false` (the Railway install path), the workspace dep MUST use `file:../../packages/<x>`, NOT `workspace:*`. npm 10.9.8 throws EUNSUPPORTEDPROTOCOL on `workspace:*` when workspaces are hidden."
---

## trigger_case

While rebasing `feat/cobrowse-presence`, `PresenceMark` needed `textmode.js` added to `apps/web/package.json`, so `apps/web/package-lock.json` had to be regenerated. `cd apps/web && npm install --package-lock-only --workspaces=false` failed with:

```
npm error code EUNSUPPORTEDPROTOCOL
npm error Unsupported URL Type "workspace:": workspace:*
```

Cause: `apps/web/package.json` on `commonplace-v2-porcelain-surface` declared `"@commonplace/block-view-contracts": "workspace:*"`. The Railway deploy installs via `npm --prefix apps/web ci --legacy-peer-deps --workspaces=false` (see root `install:railway`), which hides the workspace, so npm cannot resolve `workspace:*`. The standalone `apps/web/package-lock.json` also does not track the workspace dep at all, so there was no local method to regenerate it while `workspace:*` was in the manifest.

`origin/main` had already fixed this: it used `"@commonplace/block-view-contracts": "file:../../packages/block-view-contracts"`, which npm 10 resolves fine under `--workspaces=false`. Taking main's `file:` side during the main->porcelain merge both resolved the conflict and unblocked the standalone lockfile regeneration.

## rule

- The standalone `apps/web` lockfile (Railway install, `--workspaces=false`) requires `file:` protocol for local packages, not `workspace:*`.
- If you hit `EUNSUPPORTEDPROTOCOL ... workspace:` on a lockfile regen, check the manifest for `workspace:*` and switch to `file:`; do not hand-build the lockfile.
- `workspace:*` is fine for a root workspace install, but it silently breaks the standalone deploy path. Both must resolve; `file:` satisfies both.
