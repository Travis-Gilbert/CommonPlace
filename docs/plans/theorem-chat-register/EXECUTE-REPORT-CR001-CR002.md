# Execute Report: theorem-chat-register CR-001 / CR-002

Plan: `plan-theorem-chat-register-20260805a`

## Summary
- Final condition: [PR #190](https://github.com/Travis-Gilbert/CommonPlace/pull/190) merged; first Studio builds failed on patch-0003 TypeScript (chatStatusEntry `string|undefined`, unused `assertDefined`). Fix regenerating in follow-up PR. Live image is still pre-retirement `706bea01` (old commit SUCCESS) with `WORKSPACE_REPO` set but old entrypoint that does not compose the clone URL.
- Goal achieved: **partial** — source + env wired; live Copilot retirement and volume reseed still blocked on a green Studio image.
- Biggest remaining risk: further compile fallout from making `defaultChatAgent` optional; token leak in Docker build logs (rotate `THEOREM_GIT_TOKEN`).
- Next action: land patch-0003 TS fix, wait for SUCCESS, then prove product.json + `/workspace/repo` HEAD.

## Checklist Reconciliation
| ID | Task | Status | Evidence | Validation | Notes |
|---|---|---|---|---|---|
| CR-000 | Plan + checklist | done | PLAN.md + checklist JSON on main | artifact | local_projection_only |
| CR-001 | Copilot retirement + redeploy | verifying | PR #190 squash `644d1ba8`; ledger-gate green pre-merge | live pending | wait for SUCCESS image |
| CR-002 | Sticky empty repo repair | verifying | entrypoint compose URL + HEAD repair; `WORKSPACE_REPO` set | live pending | needs new entrypoint + clone |
| CR-003..007 | Register /chat / OpenWork | pending | — | — | not started this slice |

## Changes Made
| Area | Files | Summary | Why |
|---|---|---|---|
| Studio product | `product.overlay.json`, patch `0003`, `build.sh`, smoke/ledger | Delete Copilot host keys, strip `extensions/copilot`, seed `chat.disableAIFeatures` | CR-001 |
| Workspace | `entrypoint.sh`, `railway.toml` | Compose clone from `WORKSPACE_REPO`+token; reseed sticky empty git | CR-002 |
| Plan | `docs/plans/theorem-chat-register/*`, checklist | Durable board for dual-mount Theorem chat | CR-000 |

## Validation
| Check | Result | Notes |
|---|---|---|
| `ledger-gate.sh` | pass (pre-merge) | 3 patches |
| Overlay null-delete | pass (pre-merge) | `defaultChatAgent` key absent |
| PR merge | pass | #190 squash to main |
| `WORKSPACE_REPO` on Railway | pass | `Travis-Gilbert/CommonPlace` |
| Live product.json / no copilot | not-run | build in flight |
| Live `/workspace/repo` HEAD | not-run | needs new entrypoint boot |

## Remaining Work
- What remains: deploy SUCCESS + live oracles for CR-001/CR-002; then CR-003+ Theorem register.
- Why: Studio image rebuild is the live gate.
- Next step: poll Railway; smoke `product.json`, `extensions/copilot`, `git rev-parse HEAD` in `/workspace/repo`.

## Ops notes
- Prefer GitHub-triggered deploys for this service; do not `railway up` from repo root (wrong toml trap).
- Rotate `THEOREM_GIT_TOKEN` if it was exposed in operator logs; do not paste it into reports.
