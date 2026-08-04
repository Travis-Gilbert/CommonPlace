# Patch ledger

Oracle-debt style: one entry per patch, its reason, the upstream link, and what
would let it be deleted. A patch with no entry fails `scripts/ledger-gate.sh`, and
the gate runs in CI.

**Patch count: 1.**

Named choice 1 still holds for capability. Everything V1 through V8 asks for is
either extension API, which ships in `apps/theorem-vscode` and runs in stock
hosts, or `product.json`, which is an overlay rather than a patch. The one patch
below buys no capability at all: it is a build-break in upstream's own tree, and
it exists only because the minified target does not compile without it.

## Entries

### 0001-mangler-keep-session-changes-overrides-protected.patch

**Finding.** `vscode-reh-web-linux-x64-min` fails at the mangle step on 1.131.0:

```
[mangler] WARN: 'updateChecked' from src/vs/base/browser/ui/toggle/toggle.ts:497
  became PUBLIC because of: src/vs/sessions/contrib/changes/browser/sessionChangesEditor.ts:460
[mangler] WARN: 'updateChecked' from src/vs/base/browser/ui/actionbar/actionViewItems.ts:258
  became PUBLIC because of: src/vs/sessions/contrib/changes/browser/sessionChangesEditor.ts:460
[mangler] WARN: 'getTooltip' from src/vs/base/browser/ui/actionbar/actionViewItems.ts:224
  became PUBLIC because of: src/vs/sessions/contrib/changes/browser/sessionChangesEditor.ts:467
[mangler] ERROR: Protected fields have been made PUBLIC. This hurts minification
  and is therefore not allowed.
```

`ChangesetReviewActionViewItem` overrides `updateChecked()` and `getTooltip()`
without a visibility modifier. TypeScript defaults a bare override to public, so
both widen from the `protected` the base classes declare, and the mangler treats
a widened member as unmanglable and fails the build.

**Why no API expresses this.** It is not a capability question. There is no
extension API and no `product.json` key for "compile upstream's own source", and
the alternative is shipping the unminified target to browsers over the network.
Every site is upstream source; nothing in `apps/theorem-vscode` or the overlay is
involved, and the queue was empty when it was found.

**The patch.** Two words. `protected` added to the two overrides in
`sessionChangesEditor.ts`, matching what the base classes already declare. No
behaviour change: TypeScript visibility is erased at runtime.

**Upstream.** Not filed. Reproduced against the pinned tag on 2026-08-03 with
node 24.18.0; the correct fix is the same two words, so this is a candidate to
send upstream rather than carry.

**Delete it when** upstream adds the modifiers, or when `UPSTREAM_TAG` moves to a
tag whose `-min` target compiles clean. Check by dropping the patch and running
`./scripts/build.sh server`.

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
