# Execute Report: theorem-chat-register (CR-001..007)

Plan: `plan-theorem-chat-register-20260805a`

## Summary
- Final condition: Copilot retired; sticky `/workspace/repo` repaired; Theorem chat register package mounted at console `/chat` and in the live Studio pack as `Theorem: Open Chat`. Spec-review completion pass closed Studio ACP streaming stub, ACP-URL command hide, and doc/health residual honesty.
- Goal achieved: **yes** for CR-001..007 product cutover; interactive signed-in `/IDE` Open Chat + authenticated `/chat` HTML stamp remain the strongest remaining live smokes (doctor accepts loginish for `/chat`).
- Biggest remaining risk: rotate leaked Git/workspace tokens from prior Studio build/SSH surfaces; OpenWork `:8787` still owns container HEALTHCHECK (not product `/chat`).
- Next action: optional signed-in `/IDE` → Theorem: Open Chat one-turn; signed-in `/chat` stamp screenshot.

## Checklist Reconciliation
| ID | Task | Status | Evidence | Validation | Notes |
|---|---|---|---|---|---|
| CR-000 | Plan board | done | PLAN + checklist | artifact | |
| CR-001 | Copilot retirement | done | PR #190/#191; deploy `4e69fb85` | live | |
| CR-002 | Volume repair | done | package.json + HEAD on volume | live | |
| CR-003 | Register contract | done | SPEC-THEOREM-CHAT-REGISTER-1.0 | artifact | ChatTransport shape amended to shipped API |
| CR-004 | Package | done | `@commonplace/theorem-chat-register` | 3/3 tests | |
| CR-005 | Studio mount | done | PR #196; deploy `a0f49841`; ACP chunk forward + `acpConfigured` hide | pack + unit tests | interactive panel smoke optional |
| CR-006 | `/chat` + OpenWork out | done | console `a4ae048d`; doctor 26/26 | live | auth HTML stamp optional |
| CR-007 | Debt + report | done | this file + supersession | artifact | `:8787` health residual recorded |

## Spec-review completion (Passes A–D)
| Pass | Change | Proof |
|---|---|---|
| B | Studio `session.prompt(..., onDelta)` forwards `agent_message_chunk` | `acp-chunks.ts` + `acp-chat.test.ts`; theorem-acp `agentMessageTextFromUpdate` |
| C | Hide `theorem.openChat` unless `THEOREM_ACP_WS_URL` / `theorem.agentUrl` | `acpConfigured` + package.json `when` |
| D | SPEC ChatTransport amend; PLAN CR-006 done; Dockerfile health comment; this report | docs |
| A | Live unauth `/chat` 307 login (no OpenWork proxy); pack `openChat` present | signed-in UI still human |

## Rollback
- `CONSOLE_OPENWORK_CHAT_PROXY=1` restores `/chat` → workspace `:8787` OpenWork proxy.
- Do not restore Copilot `defaultChatAgent` keys.
- Workspace HEALTHCHECK remains on OpenWork `:8787` until a follow-up moves it.
