# Execute Report: workspace-tenancy (SPEC-COMMONPLACE-WORKSPACE-TENANCY-1.0)

Plan: `plan-commonplace-workspace-tenancy-20260806a`

## Summary
- Final condition: Spec boarded; Verify-first recorded; WT9 isolation decision accepted (single instance, multi workspace object); **WT4 source** removes boot clone and refuses `WORKSPACE_REPO` / `WORKSPACE_REPO_URL`; WT8 first-cut gate added; workspace path types package added. **WT1–WT3, WT5–WT7 not done.**
- Goal achieved: **partial** — product no longer *designed* to open CommonPlace via env; Connect GitHub + provision API still required before users can open arbitrary repos.
- Biggest remaining risk: Railway still has `WORKSPACE_REPO=Travis-Gilbert/CommonPlace` — **must delete before deploying WT4 entrypoint** or the container exits 78.
- Next action: unset Railway `WORKSPACE_REPO`; deploy workspace; then WT1 App registration.

## Checklist Reconciliation
| ID | Status | Evidence |
|---|---|---|
| WT0 | done | SPEC, PLAN, VERIFY-FIRST, checklist |
| WT9 | done | DECISION-ISOLATION.md |
| WT4 | verifying | entrypoint/Dockerfile/railway; live pending |
| WT8 | partial | `node scripts/check-multitenant.mjs` |
| WT1–WT3 | pending | App/picker/tokens |
| WT5–WT7 | pending | shared tree, tenant keys, cascade |

## Verify-first (leading findings)
1. Studio folder = launch `--default-folder` only; `?folder=` unproven.
2. Shared user-data dir today; WT4 needs per-workspace profiles.
3. Identity is GitHub OAuth (`githubTenantSlug`), not WorkOS (SPEC named WorkOS — record divergence).
4. Inventory: see VERIFY-FIRST.md §4.

## Changes Made
| Area | Summary |
|---|---|
| `packaging/workspace/entrypoint.sh` | No boot clone; refuse repo env; welcome dir |
| `packaging/workspace/Dockerfile` | `/workspace/welcome`; drop tenant/repo ENV defaults |
| `packaging/workspace/railway.toml` | Document retirement |
| `apps/theorem-vscode/.../session-opener.ts` | No `/workspace/repo` fallback |
| `packages/workspace-tenancy` | `workspacePath` + types |
| `scripts/check-multitenant.mjs` | WT8 first cut |

## Validation
| Check | Result |
|---|---|
| `node scripts/check-multitenant.mjs` | run in session |
| `pnpm --filter @commonplace/workspace-tenancy test` | run in session |
| Live `/IDE` empty welcome | **not run** until deploy + unset WORKSPACE_REPO |
| WT1 connect one-click | **not run** |

## Remaining Work
WT1 App + console connect; WT2 picker; WT3 credential helper; WT4 live proof + per-workspace user-data; WT5–WT7; finish WT8 inventory burn-down (shell-state, mobile, `CONSOLE_HARNESS_TENANT`).
