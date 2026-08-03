# Patch ledger

Oracle-debt style: one entry per patch, its reason, the upstream link, and what
would let it be deleted. A patch with no entry fails `scripts/ledger-gate.sh`, and
the gate runs in CI.

**Patch count: 0.**

Named choice 1 is why. Everything V1 through V8 asks for is either extension API,
which ships in `apps/theorem-vscode` and runs in stock hosts, or `product.json`,
which is an overlay rather than a patch. Nothing yet requires editing upstream
source, so nothing does.

## Entries

_None._

## Candidates, not yet owed

Recorded here so that if one is ever asked for, the finding is already half
written and the temptation to patch first is smaller.

| Candidate | Would need a patch because | Delete it when | Upstream |
| --- | --- | --- | --- |
| Hiding the stock chat and agent UI | Unknown. `product.json` and default settings may already cover it, and every needed patch is a ledger entry before it is written, so this stays a Verify-first item until someone checks a build. | Configuration is confirmed sufficient, or upstream adds a supported way to hide it. | (to be recorded when checked) |
| Custom updater endpoint | `updateUrl` is null today, so the app never checks for updates. Wiring our own service is configuration; changing update *behaviour* would not be. | An updater service exists and `product.json` alone drives it. | n/a |
| Welcome and walkthrough branding beyond `product.json` | Some first-run surfaces read from in-tree resources rather than product configuration. | Upstream exposes them as product configuration. | (to be recorded when checked) |

## Rule

Before writing a patch:

1. Write the finding: which API was tried, and why it cannot express the capability.
2. Link the upstream issue, or file one.
3. Add the row above with the deletion condition.
4. Only then write `patches/NNNN-short-name.patch`.

A patch queue that grows without this ritual is a fork, and a fork is the thing
this pipeline exists to avoid.
