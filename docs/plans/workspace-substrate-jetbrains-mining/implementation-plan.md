# SPEC-WORKSPACE-SUBSTRATE-JETBRAINS-MINING-1.0: implementation plan

Register: execution handoff for the JetBrains-mined workspace substrate.
Canonical UI host is CommonPlace `apps/console` (not `apps/web`). Spec
sections with no checklist row below are a planning bug.

Source spec: `SPEC-WORKSPACE-SUBSTRATE-JETBRAINS-MINING-1.0` (Downloads copy
dated for this session). Companions in force:

- `apps/console/CLAUDE.md` (console constitution; Workspace substrate ledger row)
- `docs/learnings/2026-07-20-two-divergent-commonplace-forks.md` (live API fork)
- `Website/Theorem/docs/records/2026-07-18-workspace-substrate-goal-stack.md`
  (prior completion record for B1-B6 + F1-F4)

## Grounded findings (confirmed against source before writing)

1. **Backend crates already exist on the live Theorem tree.**
   `Website/Theorem/rustyredcore_THG/crates/rustyred-thg-vfs` and
   `rustyred-thg-workspace` implement B1-B4. MCP tools land in
   `rustyred-thg-mcp/src/workspace_tools.rs` (B6). GraphQL lives in
   `Website/Theorem/apps/commonplace-api/src/workspace.rs` plus schema fields
   (B5). The live deployable API is Theorem's fork (`railway.toml`,
   `Dockerfile`, `schema.graphql`, SDL drift gate).

2. **CommonPlace `apps/commonplace-api` is not the workspace GraphQL host.**
   That fork lacks `workspace.rs` and binds the richer local `crates/commonplace`
   object model. Wiring workspace into it would reintroduce the dual-Collection
   scar. Console proxies `/api/workspace` through `CONSOLE_DATA_API_URL` /
   `THEOREM_OBJECTS_URL` to whatever GraphQL host is configured; production
   must point at Theorem's commonplace-api.

3. **F1-F4 already ship in `apps/console`.**
   `WorkspaceSubstrateView.tsx` binds project tree, readiness chip/popover,
   Project Find with degraded badges, local history + CodeMirror merge diff,
   create/import path input, and 1500ms poll (not a subscription). Client
   contract: `packages/theorem-acp/src/workspace-state.ts`. Same-origin proxy:
   `apps/console/src/app/api/workspace/route.ts`. E2E:
   `e2e/workspace-goal-stack.spec.ts` (mocked upstream). Ask degradation
   badges: `ThreadView` + `askDegradation` in `thread-store.ts`.

4. **Spec path `apps/web` is superseded for this surface.**
   Console constitution names `https://v2.theoremharness.com` as the product
   host and bans `apps/web` imports. F1-F4 land here; that is the intent met
   on the real surface, not a reduction.

5. **Local `api:dev` currently points at the wrong fork.**
   Root `package.json` runs CommonPlace `apps/commonplace-api`, which cannot
   satisfy `createProject` / `projectTree` / `readiness`. Fix: point
   `api:dev` and `api:test` at `../Theorem/apps/commonplace-api`.

## Repository split

| Deliverable | Repo | Path | Status at plan time |
|---|---|---|---|
| B1 VFS | Theorem | `rustyredcore_THG/crates/rustyred-thg-vfs` | Implemented |
| B2 local history | Theorem | `rustyred-thg-vfs` module `history` | Implemented |
| B3 workspace model | Theorem | `rustyredcore_THG/crates/rustyred-thg-workspace` | Implemented |
| B4 readiness | Theorem | `rustyred-thg-workspace` module `readiness` | Implemented |
| B5 GraphQL | Theorem | `apps/commonplace-api` (`workspace.rs` + schema) | Implemented on live fork |
| B6 MCP | Theorem | `rustyred-thg-mcp` `workspace_tools.rs` | Implemented |
| F1-F4 UI | CommonPlace | `apps/console` + `packages/theorem-acp` | Implemented |
| Dev host script | CommonPlace | root `package.json` `api:dev` / `api:test` | Gap: wrong fork |

## Checklist (every row backreferences a spec section)

| ID | Task | Spec | Acceptance | Proof |
|---|---|---|---|---|
| PT-RECON | Reconcile live paths and hosts | Mining list + Named choices | Crates, console host, Theorem GraphQL host named with paths | Path existence checks in report |
| PT-DEVHOST | Point `api:dev`/`api:test` at Theorem commonplace-api | B5 host confirmation | Scripts use `../Theorem/apps/commonplace-api/Cargo.toml` | `rg` on package.json |
| PT-B1B2 | Prove VFS + local history | B1, B2 | Event order, snapshot immutability, journal reopen, revisions/restore | `cargo test -p rustyred-thg-vfs` |
| PT-B3B4 | Prove workspace model + readiness | B3, B4 | Atomic apply, membrane floor, cold degraded trigram, scoped invalidation | `cargo test -p rustyred-thg-workspace` |
| PT-B5 | Prove GraphQL HTTP | B5 | createProject → projectTree; readiness flip; history/restore; key auth | `cargo test --test workspace_http_acceptance --test workspace_tenant_isolation` (Theorem API) |
| PT-B6 | Prove MCP tools | B6 | tools/list has three tools; readiness parity | `cargo test -p rustyred-thg-mcp workspace_tools` |
| PT-F1F4 | Prove Console surfaces | F1-F4 | Tree, readiness chip, history/diff/restore, import; poll named | vitest workspace-state + Playwright `workspace-goal-stack.spec.ts` |
| PT-REPORT | Acceptance report leading with gaps | Reporting | Scannable B1-B6 / F1-F4 table | `docs/plans/workspace-substrate-jetbrains-mining/report.md` |

## Explicit non-goals (from the spec; no consent required)

Editor component, terminal pane, browser shell composition, PSI/stub mining,
inspections.

## Update strategy named for F1

Console refreshes workspace surface and readiness by **polling**
`WorkspaceSurface` / `WorkspaceReadiness` every 1500ms
(`WorkspaceSubstrateView` `POLL_MS`). No GraphQL subscription.

## Deferrals requiring consent

None proposed. Full B1-B6 and F1-F4 remain in scope. The only executable gap
in the CommonPlace checkout is the local `api:dev` host script; engine and UI
code already live on the paths above.

## Harness plan note

`plan create` against the Theorem MCP was attempted this session and failed
(upstream 502 / source error). This markdown file is the operational checklist
until the substrate Plan node can be minted. Do not treat a missing Plan id as
missing work.
