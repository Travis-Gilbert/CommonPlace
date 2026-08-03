# 013. The VS Code surface

SPEC-COMMONPLACE-VSCODE-SURFACE-1.0, deliverables V1 through V8. Plan and
evidence live in `.harness/checklists/vscode-surface-1-0--plan-local.json`.

## What shipped

| | Deliverable | Status |
| --- | --- | --- |
| V1 | Substrate client | Verified. Standing queries over the changefeed, stale generations discarded, degradation as a value, no timers. |
| V2 | Intelligence providers | Verified against the EDITOR-DX fixture. The live half waits on EDITOR-DX; see below. |
| V3 | Timeline and local history | Implemented and unit-verified. Provider gated (see the deviation), quick-pick fallback on stable API. Restore-to-exact-bytes needs the live substrate. |
| V4 | Search over the spine | Implemented, gate verified closed. The granted-build half needs a fork build. |
| V5 | `theorem://` documents | Implemented and unit-verified. Harness receipt retrieval needs the live seam. |
| V6 | Agent presence | Implemented, ship-thin over `packages/theorem-acp`. Live session unverified. |
| V7 | Product pipeline | Authored and gated. **No build has been run.** |
| V8 | Parity fixture | Verified, running in CI, proven to fail on drift. |

## Layout

- `apps/theorem-vscode` — the pack. One extension, two hosts (Node and web).
- `packages/block-view-contracts/src/editor-intelligence.ts` and its fixture —
  the shape both fronts read.
- `apps/console/src/lib/editor-intelligence/cm6-adapter.ts` — the console front,
  for V8's comparison.
- `packaging/commonplace-studio` — the fork pipeline.
- `.github/workflows/vscode-surface-ci.yml` — parity, no-timers, and ledger gates.

## Decisions

**Ship thin over ACP.** `packages/theorem-acp` already holds the client, session
manager, and bridge. Adopting a third-party ACP extension would add a config
surface and identity path we do not own.

**`code serve-web` from the fork tree, not code-server.** One patch queue instead
of two against the same upstream, and no second auth layer duplicating the console
session auth. Unverified until the V7 web smoke run.

**Commonplace Studio** as the product identity. No Microsoft marks anywhere;
`scripts/ledger-gate.sh` enforces it and was verified to fail on a planted
`update.code.visualstudio.com` endpoint.

**Patch count is zero.** Everything so far is extension API or a `product.json`
overlay. A patch requires a written finding first; `LEDGER.md` records the
candidates that would need one.

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

## What is not done

**V7 has never been built.** The pipeline is authored, the gates pass, and no
desktop app, web workbench, OpenVSX registry check in a running build, upstream
rebase, or OW5 smoke run has happened. That needs a machine that can clone and
build `microsoft/vscode`. Per V7's own acceptance the OW5 amendment stays
undrafted until the web smoke passes. The pack is also not published to OpenVSX.

**The intelligence surface EDITOR-DX owns does not exist yet.**
`apps/commonplace-api` builds with `EmptySubscription` and has no
`fileIntelligence`, `editorReadiness`, or `applyFix`. V2 is verified against the
fixture the spec names as its oracle; against the live store the client returns
the honest degradation, which is V1's tested path. Building that surface is
EDITOR-DX's deliverable and was deliberately not done here.

The same absence blocks the live halves of V3 (`restoreRevision`), V5
(`writeObjectDocument` and receipts through the harness), and V6 (a live session
landing context in the graph).
