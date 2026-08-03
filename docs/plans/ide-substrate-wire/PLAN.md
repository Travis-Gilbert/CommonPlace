# Planning-Theorem: IDE substrate wire (`/IDE` + theorem-vscode + PR #436)

## Executive Summary
- **Goal:** `/IDE` is a Cursor-shaped VS Code door: code-server hosts `apps/theorem-vscode`, authenticated to Theorem editor GraphQL / invalidations / ACP from [PR #436](https://github.com/Travis-Gilbert/Theorem/pull/436) (merged).
- **Intent:** Filesystem sharing with OpenWork stays; add substrate channels the pack already models.
- **Summary:** Fix pack contracts (auth, SSE, ACP), install the pack into the workspace image, generate settings from env, then close the inode reachability gap (co-located substrate or equivalent).

## Substrate note
Harness MCP `plan create` was unavailable this session (`user-theorems-harness-local` discovery failed). Plan id `plan-ide-substrate-wire-20260803a` is local. Import into the graph with `plan import` when MCP is back. Checklist projection: `.harness/checklists/ide-substrate-wire--plan-ide-substrate-wire-20260803a.json`.

## Current Condition
- `/IDE` edge proxy + rail place exist (code-server filesystem door).
- Pack exists (`apps/theorem-vscode`) but is **not** in `packaging/workspace`.
- Backend editor surface is on Theorem `main` via #436 (`/graphql` intelligence + `/v1/editor/invalidations`).
- Pack sends `Authorization: Bearer`; API wants `x-api-key`.
- Pack SSE uses unauthenticated `EventSource` and `?projectId=`; server wants auth + `?project_id=`.
- ACP opener calls missing `createHostedAcpClient`; package exports `HostedAcpClient.connect`.
- Remote `commonplace-api` cannot see `/workspace/repo` inodes without co-location or sync.

## Intent
Make `/IDE` feel like Cursor wired to Theorem: extension + auth + live intelligence + agent, not a bare remote editor.

## Goal
- **User-visible:** Open `/IDE`, get workbench with Theorem providers and ACP session against the same checkout as Chat.
- **System:** Pack installed; settings/env point at #436 doors; doctor observes substrate readiness beyond HTML stamp.
- **Must not regress:** `/chat` two-door contract, `/workspace` CM6, console cookie secret never in workspace container.

## Explicit deferral (consent)
**Defer replacing stock code-server with Commonplace Studio `code serve-web` (V7).** This plan ships the pack on the live code-server door; Studio remains parked until V7 smoke. Say if you want Studio in-scope instead.

## Checklist

| ID | Task | Grounding | Proof | Status |
|---|---|---|---|---|
| IDE-000 | Durable plan + checklist projection | `.harness/checklists/ide-substrate-wire--…`, `docs/plans/ide-substrate-wire/` | files exist | doing |
| IDE-001 | Pack GraphQL auth: `x-api-key` (+ config/env split) | `apps/theorem-vscode/src/substrate/client.ts`, `extension.ts`, `package.json` | `pnpm --filter theorem-vscode test` | pending |
| IDE-002 | Authenticated SSE + `project_id` query | `client.ts`, `invalidationsUrlFrom`, substrate tests | same | pending |
| IDE-003 | ACP: `HostedAcpClient.connect` + explicit url/token | `session-opener.ts`, `packages/theorem-acp/src/hosted-client.ts` | pack check + ACP unit if present | pending |
| IDE-004 | Build/stage pack into workspace image | `packaging/workspace/Dockerfile` | image builds; extension under `/opt/commonplace/extensions` | done |
| IDE-005 | Entrypoint: extensions-dir, product.json proposals, settings from env | `entrypoint.sh`, `railway.toml` | code-server flags + settings keys present | done |
| IDE-006 | Substrate reachability: co-locate editor/VFS or named sync seam | Theorem `commonplace-api` workspace roots + workspace volume | smoke: diagnostics on `/workspace/repo` file | done |
| IDE-007 | Doctor / live smoke for substrate-wired `/IDE` | `doctor.mjs`, `/api/doctor`, manifest | doctor green for ide + extension activation note | done |
| IDE-008 | Manifest: `code-server.ide` notes pack live; Studio still parked | `.commonplace-canonical` | register-manifest check | done |

## Validation
- `pnpm --filter theorem-vscode run check && test && gate:no-timers && build`
- `node --test apps/console/scripts/edge-proxy.test.mjs`
- `node scripts/check-register-manifest.mjs`
- Workspace image build (when Docker available)
- Live: authenticated `/IDE` activates pack; GraphQL + SSE + one ACP prompt (IDE-006/007)

## Rollback
- Image without pack stage; `/IDE` remains filesystem-only.
- Pack settings empty → honest degraded providers (existing behavior).
