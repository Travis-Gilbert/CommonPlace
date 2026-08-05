# Execute Report: theorem-chat-register (CR-001..007)

Plan: `plan-theorem-chat-register-20260805a`

## Summary
- Final condition: Copilot retired; sticky `/workspace/repo` repaired; Theorem chat register package mounted at console `/chat` and in the live Studio pack as `Theorem: Open Chat`.
- Goal achieved: **yes** for CR-001..007 (live evidence for CR-005 is pack command + `theorem.chat` in seeded extension bundles on deploy `a0f49841`; interactive signed-in panel click still a human smoke if desired).
- Biggest remaining risk: rotate leaked Git/workspace tokens from prior Studio build/SSH surfaces; prefer GitHub-triggered deploys over `railway up` from repo root.
- Next action: optional signed-in `/IDE` → Command Palette → Theorem: Open Chat; archive OpenWork leftovers after `2026-09-01` (D2).

## Checklist Reconciliation
| ID | Task | Status | Evidence | Validation | Notes |
|---|---|---|---|---|---|
| CR-000 | Plan board | done | PLAN + checklist | artifact | |
| CR-001 | Copilot retirement | done | PR #190/#191; deploy `4e69fb85` | live | |
| CR-002 | Volume repair | done | package.json + HEAD on volume | live | |
| CR-003 | Register contract | done | SPEC-THEOREM-CHAT-REGISTER-1.0 | artifact | |
| CR-004 | Package | done | `@commonplace/theorem-chat-register` | 3/3 tests | |
| CR-005 | Studio mount | done | PR #196; deploy `a0f49841` SUCCESS | live pack `theorem.openChat` + `theorem.chat` in dist | prior `1537b625` FAILED missing COPY |
| CR-006 | `/chat` + OpenWork out | done | console `a4ae048d`; doctor 26/26 | live | rollback `CONSOLE_OPENWORK_CHAT_PROXY=1` |
| CR-007 | Debt + report | done | this file + supersession | artifact | D2 deferred |

## Changes Made (final execute pass)
| Area | Files | Summary | Why |
|---|---|---|---|
| Workspace pack | `packaging/workspace/Dockerfile` | COPY `packages/theorem-chat-register` in `vscode-pack` | fix esbuild resolve |
| Watch | `packaging/workspace/railway.toml` | watch package path | rebuild on register edits |
| PRs | #196 merged; #195 closed | clean main-based fix | avoid add/add conflicts |

## Validation
| Check | Result | Notes |
|---|---|---|
| `pnpm --filter @commonplace/theorem-chat-register test` | pass | 3 tests |
| `pnpm --filter theorem-vscode build` | pass | local |
| `node scripts/doctor.mjs` | pass | 26/26 |
| Live console `/chat` | pass | no `openwork.chat` host |
| Live workspace deploy | pass | `a0f49841` SUCCESS @ `81a3ada1` |
| Live pack Open Chat | pass | `/opt/commonplace/extensions/theorem-vscode` contributes `theorem.openChat`; dist mentions `theorem.chat` ×9 |

## Remaining Work
- What remains: optional interactive `/IDE` palette smoke; token rotation; D2 archive pass later.
- Why: pack/command contribution is the deploy oracle; UI click needs a signed-in browser session.
- Next step: rotate secrets; human smoke if wanted.

## Rollback
- `CONSOLE_OPENWORK_CHAT_PROXY=1` restores `/chat` → workspace `:8787` OpenWork proxy.
- Do not restore Copilot `defaultChatAgent` keys.
