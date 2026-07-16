---
title: "Preserving another agent's uncommitted WIP across a branch merge: backup-verbatim beats stash pop"
kind: method
date: 2026-07-12
area: multi-agent git hygiene
rule_short: "Before switching/merging under another agent's uncommitted WIP: copy every dirty path (tracked + untracked) to scratchpad FIRST, then stash. Restore by cp-ing the backup back verbatim, not by `git stash pop` (pop merge-conflicts on any file the incoming commits also touched)."
---

## trigger_case

To merge `origin/main` into `commonplace-v2-porcelain-surface`, the working tree held another agent's 12-file uncommitted WIP (mobile app + root package.json/lock + docs). Two failure modes hit during the session:

1. `git stash pop` onto the WRONG branch (a scratch branch off origin, 54 commits ahead of where the stash was created) applied partially and left `UU` conflict markers in `package.json`/`package-lock.json`. The stash was correctly created "On commonplace-v2-porcelain-surface" but popped elsewhere.
2. Even popping on the correct branch after the merge, `git stash pop` conflicted on root `package.json`, `package-lock.json`, and a doc, because the main-merge commit had also modified those exact files (overlap pre-checked: `comm -12` of WIP files vs `git diff --name-only base...origin/main`).

What worked, zero loss, byte-identical restore:
- `git status --porcelain | awk '{print $2}' | rsync -aR --files-from=- ./ "$BK/"` to snapshot all dirty paths (the `-R` keeps directory structure).
- `git stash push -u` to park, do the merge cleanly.
- After merge + push: `git reset -q` (clear the conflicted pop's index), then `cp` each tracked WIP file from `$BK` back over the working tree, `git checkout -- apps/web/next-env.d.ts` (discard generated noise), `git stash drop`.
- Verified with `diff -q "$BK/$f" "$f"` per file (all OK) — the other agent's WIP returned as unstaged `M`, theirs to rebase.

## rule

- Snapshot dirty paths to scratchpad BEFORE stashing when another agent's uncommitted work is in the tree. The backup, not the stash, is the authoritative restore source.
- Pre-check overlap: `comm -12 <sorted WIP files> <sorted incoming-commit files>`. Overlap predicts exactly which files the pop will conflict on.
- Restore uncommitted WIP by cp-from-backup + `git reset`, not `git stash pop`, when incoming commits touched overlapping files. You return the other agent's work verbatim (their rebase to do), rather than auto-merging it.
- Never `git stash pop` on a different branch than the stash was created on.
