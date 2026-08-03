# IDE substrate wire — execute report

Plan: `plan-ide-substrate-wire-20260803a`  
Projection: `.harness/checklists/ide-substrate-wire--plan-ide-substrate-wire-20260803a.json`  
Source: `docs/plans/ide-substrate-wire/PLAN.md`

| ID | Status | Evidence |
|---|---|---|
| IDE-000 | **done** | PLAN.md + checklist; local projection (Harness MCP plan create was down at planning) |
| IDE-001 | **done** | `x-api-key`; env overrides; vitest 60/60 |
| IDE-002 | **done** | `project_id` SSE; fetch stream; no-timers gate |
| IDE-003 | **done** | `HostedAcpClient.connect` |
| IDE-004 | **done** | Dockerfile stages pack; Railway image live with extension seeded |
| IDE-005 | **done** | entrypoint seeds + settings + proposed APIs |
| IDE-006 | **done** | Co-located `commonplace-api` on `:50090`; `createProject(/workspace/repo)` → `project:sha256:0f9f…`; save → `refreshPath` |
| IDE-007 | **done** | `/api/doctor` substrate `healthz` + `readiness` green (`generation=2`) |
| IDE-008 | **done** | `.commonplace-canonical` notes + `CONSOLE_EDITOR_SUBSTRATE_URL` |

## Deferral
D1 Studio `code serve-web` remains parked. Follow-up: [`FOLLOW-UP-CODE-SERVE-WEB.md`](./FOLLOW-UP-CODE-SERVE-WEB.md) (CS-000…CS-008).

## Live deploys
- **console** `5b595fe5` SUCCESS — doctor substrate probes + `CONSOLE_EDITOR_SUBSTRATE_URL`
- **workspace** `e90ab0cc` SUCCESS — co-located API, bootstrap, pack, ACP env

## Runtime proof (2026-08-03)
```
workspace: editor substrate on :50090
commonplace-api listening on [::]:50090
editor-substrate: wrote …/editor.env project_id=project:sha256:0f9f55167a8191e21cd37ecf74a80c88fd2f93f6bd5faeb2336ce0ae1261a435
workspace: seeded theorem-vscode …
OpenWork server listening on http://0.0.0.0:8787
```
Doctor: `substrate.healthz=200`, `substrate.readiness=generation=2`, `substrate.ok=true`.  
`/IDE` still 302 without session cookie (auth edge) — expected for unauthenticated doctor HTML stamp.

## Ops notes
- Build clones private Theorem with Railway var `THEOREM_GIT_TOKEN` (replace oauth token with a fine-grained PAT when convenient; rotate the one used this session).
- `COMMONPLACE_WORKSPACE_TENANT_ALLOWED_ROOTS={"Travis-Gilbert":["/workspace/repo"]}` required for `createProject`.
- Pack points at loopback GraphQL via bootstrap `editor.env`; ACP uses Railway `THEOREM_ACP_*`.
