# Execute Report: theorem-chat-register CR-001 / CR-002

Plan: `plan-theorem-chat-register-20260805a`

## Summary
- Final condition: Copilot product host retired on live Studio; sticky empty `/workspace/repo` reseeding works.
- Goal achieved: **yes** for CR-001 and CR-002.
- Biggest remaining risk: `THEOREM_GIT_TOKEN` appeared in Docker build logs (rotate). CR-003+ (Theorem register) still open — Copilot UI hole is intentional until that lands.
- Next action: CR-003 package contract for Studio + `/chat` Theorem register.

## Checklist Reconciliation
| ID | Task | Status | Evidence | Validation | Notes |
|---|---|---|---|---|---|
| CR-000 | Plan + checklist | done | PLAN.md + checklist on main | artifact | local_projection_only |
| CR-001 | Copilot retirement + redeploy | done | PR #190 + #191; deploy `4e69fb85` SUCCESS @ `9363e542` | live | product.json + no copilot + walkthrough strings |
| CR-002 | Sticky empty repo repair | done | entrypoint + `WORKSPACE_REPO`; live HEAD `9363e542` + `package.json` | live | reseed on boot |
| CR-003..007 | Register /chat / OpenWork | pending | — | — | next |

## Changes Made
| Area | Files | Summary | Why |
|---|---|---|---|
| Studio product | overlay, patch 0003, build/smoke/ledger | Delete Copilot host keys; null-checks; strip `extensions/copilot` | CR-001 |
| Patch fix | 0003 regen | `chatStatusEntry` narrow + drop unused `assertDefined` | first build TS fail |
| Workspace | entrypoint, railway.toml | Compose clone from `WORKSPACE_REPO`+token; reseed sticky empty | CR-002 |
| Ops | Railway var | `WORKSPACE_REPO=Travis-Gilbert/CommonPlace` | CR-002 |
| Plan | theorem-chat-register docs + checklist | Board for dual-mount register | CR-000 |

## Validation
| Check | Result | Notes |
|---|---|---|
| `ledger-gate.sh` | pass | 3 patches |
| PR #190 / #191 merge | pass | retirement + TS fix |
| Deploy `4e69fb85` | SUCCESS | healthcheck green |
| Live `product.json` | pass | no `defaultChatAgent`, no `voiceWsUrl`; name Commonplace Studio |
| Live `extensions/copilot` | pass | `copilot_names []` |
| Live walkthrough nls | pass | `Setup Commonplace Studio` / `Get Started with Commonplace Studio` |
| Live `/workspace/repo` | pass | `package.json` + HEAD `9363e542` |

## Remaining Work
- What remains: CR-003–007 (Theorem chat register package, Studio mount, `/chat` cutover, OpenWork retire, final report).
- Why: retirement leaves an empty Copilot-shaped hole by design until Theorem fills it.
- Next step: execute CR-003 SPEC package contract.

## Ops notes
- Prefer GitHub-triggered deploys for `commonplace-workspace`; do not `railway up` from repo root.
- Rotate `THEOREM_GIT_TOKEN` — build logs embedded the secret in a Dockerfile `RUN` string.
