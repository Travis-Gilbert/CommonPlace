# Planning-Theorem: Theorem chat register + Studio Copilot hole

- **Plan id:** `plan-theorem-chat-register-20260805a`
- **Tenant:** `Travis-Gilbert`
- **Created:** 2026-08-05
- **Parent scars:** [`ide-substrate-wire/FOLLOW-UP-CODE-SERVE-WEB.md`](../ide-substrate-wire/FOLLOW-UP-CODE-SERVE-WEB.md) (CS-007 host live; Copilot product keys still present until CR-001), [`console/SPEC-COMMONPLACE-OPENWORK-FORK-1.0.md`](../console/SPEC-COMMONPLACE-OPENWORK-FORK-1.0.md) (openwork.chat is today's `/chat` register), [`docs/records/013-vscode-surface.md`](../../records/013-vscode-surface.md) (Theorem ships thin over ACP, not a third-party chat extension)
- **Harness:** `user-theorems-harness-local` `plan create` timed out this session; `plugin-theorems-harness` discovery 404. This file + `.harness/checklists/theorem-chat-register--plan-local-20260805a.json` are the executable board until `plan import`.

## Executive summary

- **Goal:** One Theorem chat register fills the agent hole Copilot leaves in Commonplace Studio **and** replaces OpenWork at console `/chat`, over the same repaired workspace checkout.
- **Intent:** Do not fake Theorem into `IDefaultChatAgent` until a Chat-participant host exists. Retire Microsoft Copilot product wiring first; mount a real Theorem register package in both doors; then delete OpenWork / residual LLM hosts.
- **Sequence:** Copilot retirement → volume repair → register contract → package → Studio mount → `/chat` swap + OpenWork retirement → debt cleanup.

## Current condition (grounded)

| Fact | Evidence |
|---|---|
| Studio host is live (`IDE_HOST=studio`, deploy `c4636818`) | FOLLOW-UP CS-007; entrypoint log `IDE host is Commonplace Studio` |
| Copilot still in product.json + `extensions/copilot` | Live SSH; CHAT Agent panel + “VS Code for the Web” in session smoke |
| Copilot retirement **implemented on branch**, not yet on main | `feat/studio-overlay-retire-copilot` (overlay null-delete, patch 0003, strip copilot, `chat.disableAIFeatures`) |
| `/workspace/repo` is sticky empty `git init` | Entrypoint only clones when `.git` absent; volume init'd without `WORKSPACE_REPO_URL` |
| `/chat` is `openwork.chat` | `OpenworkChatRegister`, middleware stamps, production cutover EXECUTE-REPORT |
| Theorem pack agent path is ACP | `apps/theorem-vscode` → `@commonplace/theorem-acp`; no VS Code Chat participant |

## Goal

Authenticated users get:

1. **Studio** without GitHub Copilot / Microsoft chat product host.
2. **Theorem chat UI** in Studio’s agent/chat region (fills the hole).
3. **Same Theorem chat UI** at `https://v2.theoremharness.com/chat` (register swap).
4. **Same real checkout** under `/workspace/repo` for IDE Explorer and chat.
5. **OpenWork / opencode LLM door** off the product path once the register is live.

## Non-goals

- Stuffing `commonplace.theorem-vscode` into `defaultChatAgent` without Chat participant / entitlement-shaped APIs (that labels Copilot machinery “Theorem” and lies).
- Keeping OpenWork as a long-term parallel chat register “just in case.”
- Desktop Studio distribution.
- Repairing every historical OpenWork fork doc in one pass (CR-007 records supersession; full archive can follow).

## Named decisions (load-bearing)

1. **Two mounts, one package.** Studio panel and console `/chat` import the same register package. Divergence is a regression.
2. **ACP / Theorem heads are the transport.** Not OpenWork→opencode as the product happy path.
3. **Copilot hole ≠ `defaultChatAgent` Theorem.** Product keys are deleted; UI is our register. A future Chat-participant deliverable may later earn a real `defaultChatAgent` binding — out of scope here except as a deferral.
4. **Volume repair before dual-mount proof.** Empty repo makes Studio+chat “same checkout” unfalsifiable.
5. **OpenWork retirement is a deliverable, not a hope.** Register stamp, middleware, workspace image chat door, and doctor must stop advertising `openwork.chat`.

## Checklist

| ID | Task | Grounding | Proof | Status |
|---|---|---|---|---|
| CR-000 | Durable plan + checklist (this file) | `PLAN.md`, checklist JSON | files exist; plan_id named | **done** |
| CR-001 | Land Copilot retirement (`feat/studio-overlay-retire-copilot`) + redeploy | overlay, patch 0003, entrypoint, smoke | ledger-gate; live product.json; `/IDE` smoke | **done** |
| CR-002 | Repair sticky empty `/workspace/repo` | `packaging/workspace/entrypoint.sh`, Railway volume | `package.json` + `git rev-parse HEAD` on live volume; Explorer non-empty | **done** |
| CR-003 | Register contract: package path, `register_impl`, dual seams, retirement inventory | SPEC draft under this plan | named ids + non-goal on `IDefaultChatAgent` | **done** |
| CR-004 | Implement Theorem chat register package | new package + pack/console adapters | package tests; no openworklabs/opencode on happy path | **done** |
| CR-005 | Mount register in Studio agent/chat panel | theorem-vscode + Studio product settings | signed-in `/IDE` shows Theorem register; no Copilot sign-in wall | **done** (pack); live smoke after seed |
| CR-006 | Mount register at `/chat`; retire OpenWork door | `OpenworkChatRegister`, middleware, `.commonplace-canonical`, workspace image | stamp ≠ `openwork.chat`; doctor + register-manifest | **done** |
| CR-007 | Retire residual LLM / OpenWork surface debt + EXECUTE-REPORT | docs + deletions | EXECUTE-REPORT; no product route serves OpenWork as chat | **done** |

## Sequence

```
1. CR-000 board                → verify: PLAN + checklist
2. CR-001 Copilot retirement   → verify: live Studio product identity
3. CR-002 volume repair        → verify: real shared checkout
4. CR-003 contract             → verify: named package + register_impl + retirement map
5. CR-004 package              → verify: package tests
6. CR-005 Studio mount         → verify: /IDE panel
7. CR-006 /chat + OpenWork out → verify: stamp + doctor
8. CR-007 debt + report        → verify: EXECUTE-REPORT
```

## Validation commands

```bash
# Copilot retirement
cd packaging/commonplace-studio && ./scripts/ledger-gate.sh
# after deploy:
railway ssh --service commonplace-workspace -- \
  'node -e "const p=require(\"/opt/commonplace/studio-server/product.json\"); if(p.defaultChatAgent) process.exit(1);"' \
  && test ! -d /opt/commonplace/studio-server/extensions/copilot

# Volume
railway ssh --service commonplace-workspace -- \
  'test -f /workspace/repo/package.json && git -C /workspace/repo rev-parse HEAD'

# Register / console
node scripts/check-register-manifest.mjs
node scripts/doctor.mjs
```

## Deferrals

| ID | Title | Reason |
|---|---|---|
| D1 | Theorem as real `defaultChatAgent` | Requires Chat participant / host APIs over ACP; CR retires Copilot and mounts our register instead |
| D2 | Full OpenWork fork archive cleanup | CR-007 supersedes product path; historical OW* specs stay as record until a dedicated archive pass |

## Import

When harness MCP recovers:

```text
plan import  (plan_id=plan-theorem-chat-register-20260805a, source=docs/plans/theorem-chat-register/PLAN.md)
```
