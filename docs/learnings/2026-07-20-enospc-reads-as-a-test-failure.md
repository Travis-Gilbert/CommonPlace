---
title: A full disk reads as a cargo test failure; check df before believing exit 1
kind: postmortem
date: 2026-07-20
scope: this machine (Rust builds across CommonPlace + Theorem)
---

## trigger_case (the real scar)

Verifying a delegated agent's B7 door work. `cargo test -p rustyred-thg-mcp`
returned exit 1. I was one sentence from reporting "the delegated GraphQL and
MCP doors fail their tests."

The next command returned the truth:

```
ENOSPC: no space left on device, open '/private/tmp/.../tasks/bkqw5wpik.output'
```

```
$ df -h /System/Volumes/Data
/dev/disk3s5   460Gi   418Gi   121Mi   100%   /System/Volumes/Data
```

**121 MiB free on a 460 GiB volume.** rustc could not write object files, so the
build failed, so the test command exited non-zero. Nothing was wrong with the
code. After reclaiming 24 GiB, `cargo check -p rustyred-thg-mcp` passed clean.

Two Rust `target/` dirs held 41 GiB between them:

```
24G  Theorem/rustyredcore_THG/target
17G  Theorem/apps/commonplace-api/target
```

## rule_short

Before attributing a Rust build or test failure to code, run `df -h`. If the
data volume is above ~97 percent, the failure is the disk until proven
otherwise. Reclaim with `rm -rf <workspace>/target` (gitignored, regenerable)
and re-run before diagnosing anything.

Do **not** delete `.claude/worktrees/*` to reclaim space without asking. There
were 14 of them (3.1 GiB) and they can hold uncommitted work from other
sessions. `target/` is pure cache; a worktree is not.

## why

Cargo surfaces ENOSPC as an ordinary build failure, and if the output is piped
through `grep` or `tail` the ENOSPC line is often the part that gets filtered
out. The failure then looks exactly like a compile error you cannot see.

`du` on a full disk is slow enough to time out, which is why the check has to be
`df` (constant time, reads the volume header) rather than `du` (walks the tree).

## companion rule: do not let a pipeline eat the verdict

This session lost the real result twice to shell plumbing:

```bash
# WRONG: $? and PIPESTATUS both belong to grep/tail, not cargo.
cargo test -p foo 2>&1 | grep -E "^error" | head -20; echo "exit ${PIPESTATUS[0]}"
cargo test -p foo 2>&1 | tail -30 > /tmp/out.txt; echo "EXIT=$?"   # wrote nothing
```

Both printed an empty or misleading verdict while the underlying command had
genuinely failed. When a command's exit status is the thing being validated,
run it unpiped, or capture status explicitly before filtering.
