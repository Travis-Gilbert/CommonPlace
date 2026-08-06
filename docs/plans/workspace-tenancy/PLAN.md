# Planning-Theorem: CommonPlace workspace tenancy

- **Plan id:** `plan-commonplace-workspace-tenancy-20260806a`
- **Tenant:** identity-derived (not env)
- **Created:** 2026-08-06
- **Spec:** [`SPEC-COMMONPLACE-WORKSPACE-TENANCY-1.0.md`](./SPEC-COMMONPLACE-WORKSPACE-TENANCY-1.0.md)
- **Supersedes:** service `WORKSPACE_REPO` / `WORKSPACE_REPO_URL` / boot clone into `/workspace/repo` (dissolves CR-002 sticky-singleton posture)

## Executive summary

- **Goal:** A workspace is a graph object resolved per session. Users Connect GitHub (vendor App), pick a repo, get `/workspace/{workspace_id}` shared by IDE, chat, and agents. Env never names tenant, repo, or user.
- **Law:** Environment carries how to reach a service, never which tenant, repo, or user.
- **Sequence:** Verify-first → WT9 isolation decision → WT4 remove boot clone → WT8 gate scaffold → WT1–WT3 App/picker/tokens → WT5–WT7 shared tree + cascade.

## Checklist

| ID | Task | Status |
|---|---|---|
| WT0 | Durable SPEC + PLAN + checklist + Verify-first record | in progress |
| WT9 | `DECISION-ISOLATION.md` | pending |
| WT4 | Remove boot clone; per-workspace paths; delete repo env contract | pending |
| WT8 | `gate:multitenant` + inventory burn-down | pending |
| WT1 | GitHub App + Connect flow | pending |
| WT2 | Repo picker → workspace object | pending |
| WT3 | Installation token mint + git credential helper | pending |
| WT5 | One tree three doors (live non-CommonPlace fixture) | pending |
| WT6 | Tenant keying through substrate | pending |
| WT7 | Disconnect cascade + receipt | pending |

## Validation (acceptance oracles from SPEC)

See SPEC §§ WT1–WT9 Accepted when. Leading with what is not done in EXECUTE-REPORT.
