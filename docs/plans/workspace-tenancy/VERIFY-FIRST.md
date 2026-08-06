# Verify-first: SPEC-COMMONPLACE-WORKSPACE-TENANCY-1.0

Recorded 2026-08-06 from source + live packaging, before WT4 mechanism choice.

## 1. Studio folder selection

**Finding:** Launch-time only. Entrypoint starts one Studio process with
`--default-folder "${WORKSPACE_DIR}"`. No packaging smoke or docs prove
`?folder=` for `commonplace-studio-server` (reh-web). Console edge preserves
query strings (`edge-proxy.mjs`) but does not construct or verify folder
tenancy.

**Implication for WT4:** Near-term posture (WT9) = single instance + provision
API cloning into `/workspace/{workspace_id}` + session open via
`--default-folder` swap or documented `?folder=` after a live oracle. Do not
assume query-param tenancy until proven.

**Evidence:** [Explore chat register seams](bb581c43-9969-4150-aeff-85d59b9501d6)
style search of `packaging/workspace/entrypoint.sh`,
`packaging/commonplace-studio/scripts/smoke-server.sh`.

## 2. Shared user-data / extensions

**Finding:** One volume-backed `--user-data-dir` and `--extensions-dir` per
container. #199 proved settings merge is real and shared. WT4 requires
per-workspace user-data and extensions dirs under
`/workspace/state/workspaces/{workspace_id}/…`.

## 3. Identity surface (WorkOS claim in SPEC)

**Finding:** CommonPlace console has **no WorkOS**. Identity is Auth.js +
GitHub OAuth → `githubTenantSlug(login)` (`packages/theorem-acp/src/identity.ts`,
`apps/console/src/lib/auth.ts`). SPEC named choice 3 says WorkOS; implement
against the **existing GitHub identity lane** for WT1–WT8 and record WorkOS as
a later identity-provider swap that must not change the workspace-object
contract.

## 4. Single-user inventory (seed for WT8)

| Pattern | Class | Owner |
|---|---|---|
| `WORKSPACE_REPO` / `WORKSPACE_REPO_URL` + boot clone | fail-law (product) | WT4 |
| `THEOREM_GIT_TOKEN` composing product clone URL | fail-law | WT4 / WT3 |
| `/workspace/repo` ACP cwd fallback | fail-law | WT4 / pack |
| `CONSOLE_HARNESS_TENANT` legacy principal | fail-law | WT8 burn |
| `tenantAtom = 'Travis-Gilbert'` shell-state | fail-law | WT8 burn |
| mobile/desktop `Travis-Gilbert` defaults | fail-law | WT8 burn |
| Shared `User/settings.json` | needs-owner | WT4 |
| `COMMONPLACE_SERVICE_ALLOWED_TENANTS` default | packaging → fail-law | WT4/WT6 |
| Dockerfile Theorem clone via token | packaging-ok (build) | — |
| `room:ungrouped` in harness checklists | fixture-ok | — |

## 5. GitHub App permissions (minimum)

Contents (clone/fetch), Metadata, Repository listing for picker. Webhooks:
`installation`, `installation_repositories`. Nothing beyond deliverable use.

## 6. Railway isolation ceiling

Single `commonplace-workspace` service + one volume is today's deploy. WT9
records near-term multi-workspace-object on one instance; revisit when
per-workspace process isolation or volume caps force a swap.
