# Patch ledger

Oracle-debt style: one entry per patch, its reason, the upstream link, and what
would let it be deleted. A patch with no entry fails `scripts/ledger-gate.sh`, and
the gate runs in CI.

**Patch count: 3.**

Named choice 1 still holds for capability. Everything V1 through V8 asks for is
either extension API, which ships in `apps/theorem-vscode` and runs in stock
hosts, or `product.json`, which is an overlay rather than a patch. The patches
below buy no capability at all for the pack: they are build-breaks, builder
memory limits, or the null-checks required once the overlay *deletes*
upstream's Copilot product host.

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
`./scripts/build.sh server` with `STUDIO_MINIFY=1`.

### 0002-reh-web-unminified-skip-mangler.patch

**Finding.** Deploy `7c2690ab` (after #185) ran `vscode-reh-web-linux-x64`
without `-min` and still OOM'd in the mangler:

```
[mangler] Done collecting. Classes: 12414. Exported symbols: 15761
FATAL ERROR: MarkCompactCollector: young object promotion failed
Allocation failed - JavaScript heap out of memory
```

`build/gulpfile.reh.ts` wires **both** the minified and unminified
`vscode-reh-web-*` tasks through `compileBuildWithManglingTask`. Dropping
`-min` only skips `minify-vscode-reh-web`; it does not skip private-field
mangling. Upstream already exports `compileBuildWithoutManglingTask` in
`gulpfile.compile.ts` as the local/PR compile path; reh-web never used it.

**Why no API expresses this.** Builder memory is not a `product.json` key and
not an extension capability. Raising `--max-old-space-size` was tried three
times (default, 12288, 6144, then unminified with 8192 from npm's gulp script)
and only moved the abort. The mangler is the peak.

**The patch.** One conditional in `gulpfile.reh.ts`: unminified tasks use
`compileBuildWithoutManglingTask`; `-min` keeps mangling. No runtime behaviour
change for the workbench.

**Upstream.** Not filed. Reproduced on Railway against 1.131.0 on 2026-08-04.
Ideal upstream change: reh-web non-min tasks should match
`compile-build-without-mangling` the way desktop local builds already do.

**Delete it when** Railway (or a larger builder) can finish
`vscode-reh-web-linux-x64-min` with mangling, and `STUDIO_MINIFY=1` is the
default again; or when upstream routes unminified reh-web through
without-mangling itself.

### 0003-retire-default-chat-agent-copilot.patch

**Finding.** CS-007 live smoke on deploy `c4636818` (`IDE_HOST=studio`) proved
the name overlay alone does not retire Microsoft Copilot from the workbench:

- Welcome still featured "Get Started with VS Code for the Web".
- The CHAT Agent panel still targeted GitHub Copilot and GitHub auth.
- Shipped `product.json` still carried `defaultChatAgent` (aka.ms Copilot
  URLs), `builtInExtensionsEnabledWithAutoUpdates: ["GitHub.copilot-chat"]`,
  `trustedExtensionAuthAccess` for GitHub Copilot Chat, and
  `voiceWsUrl` on `falcon-caas.mai.microsoft.com`.
- The reh-web artifact still contained `extensions/copilot`.

Deleting `defaultChatAgent` via the overlay is configuration. Booting without
it is not: at pinned `1.131.0`, dozens of call sites read
`productService.defaultChatAgent.*` without a guard (extension gallery,
accounts, chat widget, chat status, onboarding module top-level, …). Setting
the key to `null` without deleting it, or deleting it without null-checks,
either leaves Copilot wired or crashes the workbench. Phonon IDE's public
diff against upstream used the same shape (remove the key + null-checks).

**Why no API expresses this.** There is no supported `product.json` value that
means "no default chat agent" while the TypeScript contract still requires the
object. `chat.disableAIFeatures` hides UI but leaves the Copilot product host
and Microsoft endpoints in the shipped file. The Theorem pack is ACP, not a
replacement for `IDefaultChatAgent`.

**The patch.** Against `1.131.0` (`3a03d6f7`):

1. Make `IProductConfiguration.defaultChatAgent` optional.
2. Guard the crash-on-boot call sites (gallery, abstract extension management,
   extensions workbench, language-model tools, chat widget, chat status,
   agent-sessions welcome, default-account contribution).
3. Stub onboarding's module-level `defaultChat` when the key is absent so the
   module can load; drop the unused `assertDefined` import (TS6133).
4. Guard `chatStatusEntry`'s `affectsConfiguration(...)` call: optional
   `defaultChatAgent` makes `?.completionsEnablementSetting` a
   `string | undefined`, which tsgo rejects (TS2345). Narrow before the call.
5. Retitle the web getting-started walkthrough from "VS Code for the Web" to
   "Commonplace Studio".

First Railway build of the retirement commit failed on (3)+(4); the patch was
regenerated against a clean `1.131.0` apply before re-merge.

Companion configuration (not this patch): overlay deletes `defaultChatAgent`
and `voiceWsUrl`, clears Copilot auto-update/auth grants, `build.sh` removes
`extensions/copilot` from the server artifact, and the workspace entrypoint
always forces `chat.disableAIFeatures: true` (and
`chat.commandCenter.enabled: false`) on boot, plus welcome
`.vscode/settings.json`, so a browser click on "Use AI Features" does not
stick across restarts. Stock CHAT may still appear if the secondary sidebar
layout restores that view — close it; agent path is Theorem: Open Chat.

**Upstream.** Pattern matches public fork work that removes `defaultChatAgent`
and adds null-checks. Not filed as a microsoft/vscode PR: upstream wants the
OSS product to ship with Copilot development config.

**Delete it when** upstream makes `defaultChatAgent` optional end-to-end and
ships a supported "no default agent" product shape, or when
`UPSTREAM_TAG` moves to a tree that already null-checks every site this patch
touches. Check by dropping the patch, deleting the key in the overlay, and
booting reh-web.

## Candidates, not yet owed

Recorded here so that if one is ever asked for, the finding is already half
written and the temptation to patch first is smaller.

| Candidate | Would need a patch because | Delete it when | Upstream |
| --- | --- | --- | --- |
| Custom updater endpoint | `updateUrl` is null today, so the app never checks for updates. Wiring our own service is configuration; changing update *behaviour* would not be. | An updater service exists and `product.json` alone drives it. | n/a |
| Deeper welcome media beyond walkthrough titles | Some first-run markdown/media still say "VS Code" inside `media/` trees. Titles are covered by 0003. | Upstream exposes remaining copy as product configuration, or we accept residual media strings. | (re-check after next tag) |

## Rule

Before writing a patch:

1. Write the finding: which API was tried, and why it cannot express the capability.
2. Link the upstream issue, or file one.
3. Add the row above with the deletion condition.
4. Only then write `patches/NNNN-short-name.patch`.

A patch queue that grows without this ritual is a fork, and a fork is the thing
this pipeline exists to avoid.
