# 013. The VS Code surface

SPEC-COMMONPLACE-VSCODE-SURFACE-1.0, deliverables V1 through V8, wired onto the
EDITOR-DX surface that landed after the first round. Plan and evidence live in
`.harness/checklists/vscode-surface-1-0--plan-local.json`.

Amendment (SPEC-COMMONPLACE-PRODUCTION-CUTOVER-1.0 GL9): the final deliverable of this surface is its `.commonplace-canonical` manifest row flipped and its production smoke green at a named URL; superseding a prior editor surface carries that deletion as a deliverable with its own acceptance.

## What shipped

| | Deliverable | Status |
| --- | --- | --- |
| V1 | Substrate client | Verified. Standing queries over `/v1/editor/invalidations`, per-path refresh, stale generations discarded, degradation as a value, no timers. |
| V2 | Intelligence providers | Verified against the live wire's shapes. Four queries in one operation, `previewFix` before `applyFix`, published enums, reduced-vs-unavailable split. |
| V3 | Timeline and local history | Verified. Generation-keyed over `fileHistory` / `restoreRevision`. Provider gated (see the deviation), quick-pick fallback on stable API. |
| V4 | Search over the spine | Implemented, gate verified closed. The granted-build half needs a fork build. |
| V5 | `theorem://` documents | Verified. Reads `item`, writes `writeItemBody` with a declared base hash, surfaces a refusal as a refusal. |
| V6 | Agent presence | Implemented, ship-thin over `packages/theorem-acp`. Session now opens rooted at the workspace folder. Live session against a running agent unverified. |
| V7 | Product pipeline | Prepared against real upstream 1.131.0. The compile step is blocked on disk; see below. |
| V8 | Parity fixture | Verified, running in CI, proven to fail on drift, and now compared against an independent oracle. |

## Layout

- `apps/theorem-vscode` — the pack. One extension, two hosts (Node and web).
- `packages/block-view-contracts/src/editor-intelligence.ts` — the wire both
  fronts read, plus `editor-offsets.ts` (byte to UTF-16) and
  `editor-content-hash.ts` (the client half of `ContentHash`).
- `apps/console/src/lib/editor-intelligence/cm6-adapter.ts` — the console front.
- `packaging/commonplace-studio` — the fork pipeline.
- `.github/workflows/vscode-surface-ci.yml` — parity, no-timers, and ledger gates.

## Decisions

**Ship thin over ACP.** `packages/theorem-acp` already holds the client, session
manager, and bridge. Adopting a third-party ACP extension would add a config
surface and identity path we do not own.

**`code serve-web` from the fork tree, not code-server.** One patch queue instead
of two against the same upstream, and no second auth layer duplicating the console
session auth. Unverified until the V7 web compile runs.

**Commonplace Studio** as the product identity. No Microsoft marks anywhere;
`scripts/ledger-gate.sh` enforces it and was verified to fail on a planted
`update.code.visualstudio.com` endpoint.

**Patch count is zero.** Everything so far is extension API or a `product.json`
overlay. A patch requires a written finding first; `LEDGER.md` records the
candidates that would need one.

**One conversion, not two.** Both fronts convert UTF-8 byte offsets to UTF-16
through `editor-offsets.ts` rather than each carrying its own arithmetic. That
weakens a front-versus-front parity test, because a bug in the shared module
cancels out, so the parity test now compares both fronts against an independent
oracle that encodes and decodes the text directly. Slow and obviously correct is
the right shape for an oracle.

**Content identity by string equality, except for item bodies.** For files the
read payloads carry `content`, so comparing it to the buffer settles identity
exactly and needs no hash implementation in the client. `writeItemBody` has no
such escape: it compares against `ContentHash::of(text)` for an inline body and
`ItemGql` publishes no hash of that text, so the pack computes `blake3:<hex>`
with `@noble/hashes` — already in the workspace, and the alternative was leaving
V5's save path unreachable for exactly the documents it opens.

## Deviation from the spec

**`TimelineProvider` is proposed API.** The spec treats V3 as ungated and V4 as
the only gated deliverable. It is not:
`src/vscode-dts/vscode.proposed.timeline.d.ts` is live at microsoft/vscode main
and `TimelineProvider` appears nowhere in stable `vscode.d.ts` (checked
2026-08-02). The Timeline *view* has been stable for years, which is what makes
this easy to assume otherwise.

V3 therefore takes V4's shape: the provider registers only where the proposal is
granted, `timeline` joins the two search proposals in
`extensionEnabledApiProposals`, and on stable API the same revisions are reachable
through `Theorem: Show History`. The capability exists in stock VS Code,
code-server, and Cursor, as the extension-first law requires; only its placement
in the Timeline view is fork-gated.

The typecheck found this, not the plan. Worth remembering that "the view is
stable" says nothing about the provider.

## Corrections the live wire forced

The first round guessed this contract while EDITOR-DX was being built. Four of
those guesses were wrong in ways worth recording, because each was a plausible
reading that a fixture alone could not have caught.

1. **Spans are UTF-8 byte offsets, not line and character.** Both consumers
   address text in UTF-16 code units, so every span crosses an encoding boundary.
   The fixture is deliberately non-ASCII now; on ASCII the bug is invisible.
2. **`degraded: true` is the steady state.** The acceptance test asserts it with
   `missingIndexes: ["compute_code"]` for a freshly mounted project while tokens
   and fixes still answer. The first build rendered any degradation as a warning
   with a slashed-circle chip, which would have shipped a permanent error badge
   on a healthy install.
3. **Block actions are `editor.send_selection_to_composer` and
   `editor.save_selection_to_graph`.** The first build branched on an invented
   `int-save-graph`.
4. **`writeObjectDocument` does not exist.** Item bodies write through
   `writeItemBody`; creating one from a selection is `putNote`.

## What is not done

**V7's compile has not run.** `scripts/build.sh prepare` now runs against a real
upstream 1.131.0 checkout, which is what verifies the clone, the (empty) patch
queue, the `product.json` overlay, and the pack staging. The `npm ci` plus
`gulp`/`compile-web` step is blocked on disk: this machine has roughly 11GiB free
on both the build volume and the boot volume, and the upstream install needs an
order of magnitude more across the checkout and the npm cache. `build.sh` now
refuses with a named figure rather than filling either volume, so the blocker is
reported instead of discovered halfway through. No desktop app, web workbench,
OpenVSX registry check in a running build, upstream rebase, or OW5 smoke run has
happened, and per V7's own acceptance the OW5 amendment stays undrafted until the
web smoke passes. The pack is also not published to OpenVSX.

**The live agent session is unverified.** V6 opens a session against the
configured door and now passes the workspace root, but nothing here has talked to
a running agent.

**One gap remains open on the editor surface.** `ItemGql` publishes `bodyText`
and `blobHash` but no content hash for an inline body, which is why the pack
computes one. A `bodyContentHash` field would remove the client-side hash
entirely, matching what `contentHash` already did for files.
