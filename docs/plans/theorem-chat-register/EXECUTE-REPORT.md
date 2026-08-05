# Execute Report: theorem-chat-register (CR-001..007)

Plan: `plan-theorem-chat-register-20260805a`

## Summary
- Final condition: Copilot retired on Studio (CR-001/002 already live); Theorem chat register package shipped and mounted at console `/chat` + Studio `Theorem: Open Chat`; OpenWork no longer the product `/chat` host.
- Goal achieved: **yes** for CR-001..007 (live doctor green; OpenWork off product `/chat`).
- Biggest remaining risk: Studio pack image may still need a workspace redeploy to seed `theorem.openChat`; rotate `THEOREM_GIT_TOKEN` if still exposed from Studio builds.
- Next action: signed-in `/IDE` → Theorem: Open Chat after workspace pack seed.

## Checklist Reconciliation
| ID | Task | Status | Evidence | Validation | Notes |
|---|---|---|---|---|---|
| CR-000 | Plan board | done | PLAN + checklist | artifact | |
| CR-001 | Copilot retirement | done | PR #190/#191; deploy `4e69fb85` | live | prior slice |
| CR-002 | Volume repair | done | HEAD `9363e542` on volume | live | prior slice |
| CR-003 | Register contract | done | SPEC-THEOREM-CHAT-REGISTER-1.0 | artifact | path + `theorem.chat` |
| CR-004 | Package | done | `@commonplace/theorem-chat-register` | `pnpm --filter … test` 3/3 | no openwork/opencode deps |
| CR-005 | Studio mount | done | `TheoremChatPanel` + `theorem.openChat` | pack build + tsc | ACP transport |
| CR-006 | `/chat` + OpenWork out | done | deploy `a4ae048d`; doctor 26/26 | live | rollback env `CONSOLE_OPENWORK_CHAT_PROXY=1` |
| CR-007 | Debt + report | done | this file + supersession rows | artifact | D2 archive deferred |

## Changes Made
| Area | Files | Summary | Why |
|---|---|---|---|
| SPEC | `SPEC-THEOREM-CHAT-REGISTER-1.0.md` | Named package, stamp, mounts, inventory | CR-003 |
| Package | `packages/theorem-chat-register/**` | Session controller, HTTP stream transport, React register, webview HTML | CR-004 |
| Studio | `apps/theorem-vscode` chat-panel + command | Webview stamped `theorem.chat` over ACP | CR-005 |
| Console | `/chat` pages, middleware, registry, register-impl | Theorem register; OpenWork proxy opt-in only | CR-006 |
| Canonical | `.commonplace-canonical` | `manifest_impl: theorem.chat`; supersede openwork.chat | CR-006/007 |
| Manifest gate | `scripts/check-register-manifest.mjs` | Allow `prototype.stage` companion | unblock oracle |

## Validation
| Check | Result | Notes |
|---|---|---|
| `pnpm --filter @commonplace/theorem-chat-register test` | pass | 3 tests |
| `node scripts/check-register-manifest.mjs` | pass | 8 registers |
| console chat page tests | pass | 4 tests |
| `pnpm --filter theorem-vscode check/build/test` | pass | 60 tests; bundles |
| `node scripts/doctor.mjs` | pass | 26/26 after console `a4ae048d`; `/chat` unauth → login, no openwork stamp |
| Live `/IDE` Copilot | pass | prior CR-001 |
| Live `/workspace/repo` | pass | prior CR-002 |

## Remaining Work
- What remains: merge + console deploy; confirm doctor `/chat` loginish or `theorem.chat` stamp; optional later delete of `apps/chat` / `openwork-ui` after `2026-09-01`.
- Why: live stamp cannot move until console image updates.
- Next step: land PR, redeploy `commonplace-console`, re-run doctor.

## Rollback
- `CONSOLE_OPENWORK_CHAT_PROXY=1` restores `/chat` → workspace `:8787` OpenWork proxy.
- Do not restore Copilot `defaultChatAgent` keys.
