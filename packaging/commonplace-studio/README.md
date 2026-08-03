# Commonplace Studio

The product pipeline for SPEC-COMMONPLACE-VSCODE-SURFACE-1.0 V7. VSCodium-shaped:
an upstream tag checked out clean, a patch queue applied in order, a `product.json`
overlay, the Theorem pack preinstalled, and CI producing the desktop app and the
web workbench.

**This is packaging, not a fork of the codebase.** Named choice 1: every capability
the extension API can express lives in `apps/theorem-vscode` and runs unmodified in
stock VS Code, code-server, and Cursor. A capability reaches `patches/` only after a
written finding that the API cannot express it, and that finding is a `LEDGER.md`
entry with the upstream issue linked. Divergence is measured in patch count and
reported at every rebase.

## Why the fork exists at all

Four reasons, and nothing else justifies a patch:

1. Product identity: name, icons, updater endpoints, none of them Microsoft's.
2. The preinstalled pack.
3. Default settings, including telemetry off and OpenVSX as the registry.
4. Proposed-API grants to first-party extensions, which is how the Copilot
   extensions get proposed API in a shipped build, and how V4 search binds to the
   index spine before `textSearchProvider2` and `fileSearchProvider2` finalize.

## Identity

| Field | Value |
| --- | --- |
| Product name | Commonplace Studio |
| Application name | commonplace-studio |
| Data folder | `.commonplace-studio` |
| URL protocol | `commonplace-studio` |
| Registry | Open VSX |
| Telemetry | off |

`microsoft/vscode` is Code OSS under MIT and that is what is built here. The VS Code
name, the icons, and the Marketplace are Microsoft's, do not travel, and appear
nowhere in this tree or in any build output.

## The web output

`code serve-web` from the fork tree, not code-server's patch set. The pipeline
already carries one patch queue against upstream; carrying code-server means a
second queue against the same upstream, plus its auth and TLS layer, which
duplicates the console session auth the pack already speaks. TLS and authentication
terminate at the edge, exactly as the console deploy does today.

The oracle for that decision is the V7 web smoke run: the web output serving the
OW5 workspace container. Until that passes, SPEC-COMMONPLACE-OPENWORK-FORK-1.0 OW5
stays on stock code-server and the amendment stays drafted, not landed.

## Build

```bash
# Desktop app for the host platform.
./scripts/build.sh desktop

# Web workbench.
./scripts/build.sh web
```

Both read `UPSTREAM_TAG`, clone or update `build/vscode` at that tag, apply
`patches/*.patch` in order, merge `product.overlay.json` into upstream's
`product.json`, stage the packaged extension from `apps/theorem-vscode`, and build.

## Rebase

```bash
./scripts/rebase.sh 1.108.0
```

Checks the new tag out clean, replays the queue, reports which patches no longer
apply, and prints the patch count for the ledger. See `RUNBOOK.md`.

## State

The queue is empty. Everything the spec asks for so far is expressible through the
`product.json` overlay and the preinstalled pack, so there is nothing to patch and
nothing to owe. `LEDGER.md` records that, along with the candidates that would
require a patch if they are ever asked for.
