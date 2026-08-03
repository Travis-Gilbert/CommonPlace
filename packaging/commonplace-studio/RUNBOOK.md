# Rebase runbook

Upstream ships monthly. This is what happens when it does.

## 0. Disk, before anything else

`build.sh` checks two volumes and refuses with a figure rather than filling
either: the one holding `build/`, and the one holding the npm cache, which is
usually the boot volume. A build that runs the boot volume to zero takes the
machine's tooling down with it, which is a worse failure than not starting.

| Step | Build volume | npm cache volume |
| --- | --- | --- |
| `prepare` | 3GiB | 1GiB |
| `web` | 15GiB | 8GiB |
| `desktop` | 25GiB | 8GiB |

The shallow checkout at 1.131.0 measures about 800MiB before `npm ci`. If the
cache volume is the binding constraint, `npm_config_cache` moves it.

## 1. Read what changed before touching anything

- The release notes, for anything that moves the extension API surface the pack
  depends on: diagnostics, semantic tokens, inlay hints, code actions, timeline,
  file system providers, and the two search proposals.
- `src/vscode-dts/vscode.proposed.fileSearchProvider2.d.ts` and
  `...textSearchProvider2.d.ts`. If either is gone from `vscode.proposed.*`, the
  proposal finalized: drop it from `extensionEnabledApiProposals`, delete the
  gate's fork-only caveat, and record it. V4 then works everywhere.
- `product.json` in the new tag, for keys the overlay sets that upstream renamed.

## 2. Replay the queue

```bash
./scripts/rebase.sh <new-tag>
```

It refuses to advance `UPSTREAM_TAG` if the queue does not apply. That refusal is
the point: a half-applied queue that still builds is how a packaging pipeline
turns into a fork without anyone deciding to.

## 3. Update the ledger

Every patch that needed adjusting gets its entry updated with what moved. Every
patch that no longer applies gets one of two outcomes, written down:

- Upstream absorbed it, so the patch is deleted and the row moves to a "retired"
  line with the upstream commit.
- Upstream changed shape, so the patch is rewritten and the entry says why it is
  still owed.

Then `./scripts/ledger-gate.sh` must pass. CI runs it too.

Run it *after* `prepare`, not before: with a build tree present it also checks
the `product.json` that actually ships, which is the only thing that proves the
overlay merged rather than silently no-opping. Verified 2026-08-03 to fail on a
planted `nameShort` and a surviving `update.code.visualstudio.com`.

## 4. Build both outputs

```bash
./scripts/build.sh prepare   # clone, patch queue, overlay, stage the pack
./scripts/build.sh desktop
./scripts/build.sh web
```

`prepare` is idempotent and hard-resets the checkout before applying the queue,
so the patch count means something. Verified end to end against upstream 1.131.0
on 2026-08-03: 0 patches, overlay merged, pack staged at
`extensions/theorem-vscode`.

## 5. Smoke the outputs

- Desktop boots, `Help > About` shows Commonplace Studio and no Microsoft marks,
  the extensions view reaches Open VSX, telemetry settings read off, and the
  Theorem pack is present without being installed by hand.
- Web boots through `code serve-web`, the pack activates in the browser host, and
  the OW5 workspace container loads. Until this passes on a given tag, OW5 stays
  on stock code-server; the amendment is drafted and does not land.
- Quick open in the desktop build ranks an inside-project fixture hit above an
  equal outside one. If it does not, the proposal grant did not take, and the
  pack should be logging that it fell back to ripgrep.

## 6. Report

Patch count, ledger diff, and which of the smoke checks passed. Divergence is
the number that matters; if it is climbing, the reason for each new patch is the
conversation, not the count itself.
