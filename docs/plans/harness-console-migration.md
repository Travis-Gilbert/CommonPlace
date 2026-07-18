# Plan: migrate the legacy harness-console onto CommonPlace (app.theoremharness.com)

Status: SUPERSEDED, DO NOT EXECUTE. Author: Claude Code, 2026-07-06. Retained as historical audit and backend-contract context.

> Superseded for execution by `docs/plans/frontend-ownership-migration/implementation-plan.md`. This file remains the July 6 harness-console commit ledger and backend-contract background. The newer plan covers all Theorem frontend surfaces, the post-July-6 drift, specialty clients, ownership prevention, and final teardown.

> Canonical host correction, July 18: `https://v2.theoremharness.com` serving `apps/console` is the primary CommonPlace frontend. References below that call `https://app.theoremharness.com` or `apps/web` canonical are historical and must not guide new product work.

> Marketing decision update, July 11: the landing page moves into the CommonPlace repository but remains a standalone public page at `https://theoremharness.com`. It must not be folded into the `app.theoremharness.com` product shell, and its public URL must not change during migration.

> Path note: references below to Theorem crates, apps, and tests are relative to the sibling Theorem repository at the historical snapshot, not to this CommonPlace checkout. The checklist below is archival and must not be used for execution.

> Fixture warning: every fixture-first, fixture-to-live, soft-fail, or fail-open
> instruction below describes historical behavior and is non-normative. It is
> prohibited on user-reachable routes by the canonical plan. Production routes
> must use live contracts and show an honest unavailable or error state when
> those contracts fail. Fixtures are allowed only in explicitly isolated tests
> and development previews.

## Executive summary

`app.theoremharness.com` is served by **CommonPlace `apps/web`** (Next 16, npm, the "Theorem's Harness" operator UI: porcelain tokens, `/v2/*` strangler shell). A second app — **Theorem `apps/harness-console`** (nav Home/Memory/Skills/Canvas/Rooms/Runs) — is a legacy bleed-through site **slated for deletion**. Real product work kept landing there by accident. This plan moves the real surfaces onto CommonPlace, rewires them to the existing backend routes (no backend rebuild), and deletes the legacy app.

## Method (decided with Travis)

Two lenses, combined:
1. **Git spine (completeness):** the legacy app is only ~3 weeks / **26 non-merge commits** old, all path-isolable via `git log origin/main --no-merges -- apps/harness-console` (monorepo is not a barrier). Every feature commit = one thing that landed, with its diff as the rebuild spec. Nothing gets missed.
2. **Audit judgment (real-vs-cruft + target mapping):** two read-only audits (2026-07-06) classified each surface real-vs-cruft, captured the backend contract, and mapped CommonPlace's current stub state.

Caveat: **not a `git cherry-pick`.** harness-console (`/memory`, `/skills`, Next-app wrapper, its own design tokens) and CommonPlace v2 (`/v2/*`, porcelain tokens, fixture→live seam) have different structures. Each commit is a **re-implement in the v2 shell**, not a replay.

## The backend contract (what CommonPlace must consume — do NOT rebuild)

harness-console talks to the harness backend two ways:
- **MCP over `HARNESS_URL/mcp`** (Bearer token): `graphql_query`, `graphql_mutate`, `self_archive`, `forget`, `skill_publish`, `skill_apply`, plus rooms/runs/keys/providers/inbox/tasks/usage reads. This is the harness client in `apps/harness-console/src/lib/harness/{client,mcp,types}.ts`.
- **HTTP proxy `POST /api/theorem/agent`** → Theorem agent backend (Railway `rustyredcore-theorem-production…/v1/theorem/agent/run`).

CommonPlace already has the seam to consume this:
- **Historical `/api/theorem/graphql` behavior:** the proxy (`apps/web/src/app/api/theorem/graphql/route.ts`) used `THEOREM_GRAPHQL_URL` with `x-api-key` and soft-failed in development so fixtures took over. This fallback is not an execution instruction.
- **`/api/theorem/operator`**, **`/api/theorem/agent`**, **`/api/theorem/control-center`** route handlers already exist.
- **Historical fixture-to-live pattern:** `src/lib/commonplace/index-queries.ts` (`FIXTURE_BANDS`, `useIndexData()`, `fetchLiveIndexData()`, `source.mode: fixture|live|error`) rendered a fixture first and failed open. The canonical plan replaces this with live-only production behavior and explicit unavailable/error states.

Historically, the proposed rewire connected CommonPlace's fixture-to-live seam to the harness MCP/GraphQL routes. For current execution, use those backend contracts without exposing fixture fallback on user-reachable routes.

## CRITICAL — how surfaces are added in CommonPlace v2 (object-contract-v2)

From harness memory (Codex, doc_940eed924a2c8e0e, branch `Travis-Gilbert/object-contract-v2`, spec `SPEC-OBJECT-CONTRACT-V2.md`): **do NOT hand-build `/v2/<route>` pages for ported surfaces.** CommonPlace v2 uses an **object-contract surface interpreter**:
- surface / region / view-instance / view-descriptor are **CommonplaceObject graph nodes** (`crates/commonplace/src/block_view.rs`); CONTAINS edges carry order; `ViewRegistry::load_from_store` seeds default descriptors.
- Web seam: **`apps/web/src/components/commonplace/surface`** — a `SurfaceRenderer` queries a live `BlockHost`, builds the surface tree, and resolves view-instances through a **single dynamic renderer map**, with fallback cards for un-seeded views. Insert/move/config all go through `ObjectAction`.
- So **a ported surface = register a ViewDescriptor + add its renderer to the dynamic renderer map** (my markdown-theory `GalleyReader` = one such renderer for a document/notes view). This is **Codex's active lane — coordinate, don't fork it.**
- **Operator is renderer-ready and task-node-routed.** The earlier block was the missing Theorem unified GraphQL task-node contract; PT-010 now wires `workGraph(runId)` live and Theorem exposes `workGraph.tasks` as typed `TaskNode` objects. "Do not invent local task substrate fields" still holds: wire real Theorem GraphQL, don't stub.

Consequence: PT-020..PT-050 are re-scoped from "build a route" to "register a view-descriptor + renderer against the object-contract SurfaceRenderer," coordinated with Codex's object-contract-v2 branch.

## Commit → disposition (the spine)

| Commit | What landed | Disposition |
|---|---|---|
| 668a7d494, 239a2ab14, c981032d7, f2d32ccf7 | harness-console app scaffold + Next 16 bump + lint | **DROP** (wrapper being deleted; CommonPlace has its own Next app) |
| d79c215d4, fd459f2c8 | Dockerize + Railway token build | **DROP** (legacy deploy; CommonPlace has railpack.json) |
| cd21ba807, 92be8ec27 | Parametric design-system tokens + code-surface pty backend | **RECONCILE** (CommonPlace uses porcelain tokens; keep the pty backend idea only if not already present) |
| 80a91e392, 1d39ab412 | SPEC-2 Item domain + live changefeed, SPEC-3 space-type registry, item feed + console | **PORT** → CommonPlace Index/Tables (live changefeed is real backend value) |
| 756d61029 | Memory: render similar memory graph | **PORT** → CommonPlace Graph/Notes |
| 9c7de1c31, aa46e6805 | Omnibar: run theorem agent | **PORT** → CommonPlace Operator/Chat (uses `/api/theorem/agent`) |
| 9e7d0e4cb, 4e5dc0094 | Marketing landing page and current copy | **PORT** to a standalone CommonPlace-owned marketing entrypoint; preserve `https://theoremharness.com` and keep it outside the product shell |
| 75140059c, 6a6750337 | Browser: memory graph search | **DROP** (audit: experimental substrate browser, no live wiring) |
| b41b694f0, 2bf417353, de97c7526, 78867f425, 7d9dabf8b, ae43532ba, 82a21881d | `feat(commonplace)`: durable api + substrate surfaces, governance memory contracts, code contract shell, rustyred data contracts, compiler + block-view substrate, coding agent workspace (#43), commonplace-desktop-through-Next | **RECONCILE** — these are CommonPlace features that bled into the wrong app. Check if already in CommonPlace; port only the delta, discard duplicates. **Highest-value + highest-risk cluster (parallel-dev divergence).** |
| ccd69699c, 538f7f84b, fbcf9963a | `acp` transports | **SKIP** (merge/incidental; 0 real harness-console files) |

## Surfaces to port (from the audit — the 11 real product features)

Historical proposal: reimplement each surface in the porcelain system. The
fixture-to-live wiring described in the original proposal is superseded;
current execution requires live contracts and honest unavailable/error states.

memory, skills, agent, keys, claim(onboarding), inbox+tasks, rooms, runs, connections, providers, usage.

**Open decision D1 — surface→nav mapping is NOT 1:1** and needs Travis's call. Candidate mapping:
- Memory → **Notes** (unbuilt) + Graph
- Skills → new `/v2/skills` (no CommonPlace equivalent)
- Agent/omnibar → **Operator** / **Chat** (unbuilt)
- Rooms → **Workrooms** (stub exists)
- Runs → new `/v2/runs`
- Keys / Providers / Connections / Usage / Inbox → a settings/admin cluster (no CommonPlace equivalent yet)
- Item feed → **Index** / **Tables**

## Checklist (stable IDs)

Order: backend client first (unblocks all), then ports, then reconcile, then teardown.

| ID | Item | Acceptance | Route/risk |
|---|---|---|---|
| PT-000 | Reconcile the 26-commit inventory into a per-item disposition sheet (this table, ratified with Travis) | Every commit has PORT/RECONCILE/DROP/SKIP + a target; D1–D4 answered | planning; low |
| PT-010 | Historical task-node wiring item; superseded by FO-010 and the canonical live-only production rule | `workGraph(runId?)` returns typed task nodes; production shows an honest unavailable/error state when live data fails; fixtures remain isolated to tests and development previews | `apps/web/src/lib/theorem-operator-live.ts` + `apps/commonplace-api/src/schema.rs`; **med** |
| PT-020 | Port **memory** → v2 (list/filter/search/graph/cluster + atom read/edit) | Surface renders live atoms; search works; edit round-trips via `graphql_mutate`/`self_archive`/`forget` | high |
| PT-021 | Port **skills** (author/publish/apply SKILL.md) | Publish hits `skill_publish`; apply hits `skill_apply` | med |
| PT-022 | Port **agent/omnibar** (run theorem agent) | Prompt runs via `/api/theorem/agent`; thread renders | med |
| PT-023 | Port **rooms → Workrooms** (read-only feed/presence) | Live rooms + events render | low |
| PT-024 | Port **runs** (history + replay) | Live runs + event ledger render | low |
| PT-025 | Port **inbox + tasks** | Inbox list + task board live; mark-read/state mutations work | med |
| PT-026 | Port **keys / providers / connections / usage** (admin cluster) | Each reads live; key CRUD + provider validate work | med |
| PT-027 | Port **claim** onboarding (anon register + key) | Anonymous provision + claim flow works | low |
| PT-028 | Port **item domain + live changefeed** → Index/Tables | Changefeed streams; item feed live | med |
| PT-040 | **Reconcile the commonplace-bleed cluster** (7 commits): diff each against current CommonPlace; port delta, drop duplicates | No feature regressed; no duplicate surface; divergence documented | **high** (parallel-dev) |
| PT-050 | Re-home the **markdown-theory read surface**: add `@travis-gilbert/markdown-theory`, drop a `GalleyReader` (porcelain register) into the Notes/document read view | A note body renders typeset via `<Galley>` on porcelain | low (already built once for harness-console) |
| PT-060 | Confirm + execute the **DROP list** (canvas, browser, workspace, /Commonplace-preview, legacy design tokens, theseus/* experimental api) | Travis consents to each drop; nothing real discarded; marketing is excluded because it ports to CommonPlace | needs consent |
| PT-070 | **Publish markdown-theory 0.1.1** (T2 Slice B family CSS) + relock consumers | npm has 0.1.1 with `.galley-family-*`; CommonPlace + Theorem/apps/desktop resolve it | outward-facing |
| PT-080 | **Delete `apps/harness-console`** + its Railway service; repoint app.theoremharness.com at the CommonPlace deploy | Legacy app gone; domain serves CommonPlace; all ports verified live first | **irreversible; last** |

## Evidence update — 2026-07-06 (CC session, live introspection + source read)

The plan above was written pre-inspection. Direct evidence changed three things:

1. **PT-010 was mis-framed as greenfield.** `apps/web/src/lib/` already shipped `theorem-agent.ts`, `theorem-operator.ts` (+ `-client`), `theorem-control-center.ts` (+ `-client`), `theorem-gateway.ts`, and `commonplace-graphql.ts`. The historical adapters used a fixture-to-live seam; the canonical migration keeps the transport and DTOs but removes fixture fallback from production routes.
2. **The task-node GraphQL schema Operator was "blocked on" EXISTS live.** `graphql_query` introspection of the Theorem harness GraphQL returned exactly the reads `theorem-operator.ts`'s live-wiring map names: `workGraph`, `nextTaskNode`, `taskRef`, `coordinationStream`, `roomDigest`, `openPings`, `relatedEvents`, `harnessRun`, `skillList`/`skillGet`, `memory`/`memoryDoc`. Operator is unblocked on the read side.
3. **apps/web has TWO backends + two live patterns (verified against `theorem-control-center.ts`).**
   - **Harness MCP GraphQL** remains the agent/coordination transport for memory, skills, rooms, runs, and head-to-head coordination.
   - **commonplace-api GraphQL** is the frontend-facing product door: reached via `THEOREM_GRAPHQL_URL` + server-only `THEOREM_API_KEY` (`x-api-key`), with the browser proxy `/api/theorem/graphql` only used from browser code. The Operator route posts server-to-server directly to the same HTTP GraphQL door.
   - **Historical PT-010 evidence:** `apps/web/src/lib/theorem-operator-live.ts` `buildOperatorStateLive(env, now, fetch)` queried `workGraph(runId)` on `commonplace-api`. `runId` was optional: present meant one run; absent meant an aggregate Operator board across all `TaskNode` records. The route's former missing/empty/error fixture fallback is prohibited for current production execution.
     - **Mapper is faithful to the authoritative `TaskNode` serde shape** (source of truth: `theorem-harness-core/src/work_graph.rs`): `NodeStatus` (open|claimed|patch_proposed|verifying|accepted|rejected) -> Operator status/lane; `ClaimLease.owner` -> head and `granted_at` -> claimedAt; prerequisites are resolved against accepted nodes; `node_type` -> laneChip; `file_scope` -> fileScope. TaskNode has no title/lane/priority/checklist timestamp fields; those are derived or left absent.
     - **Closed gap review 2026-07-06:** CommonPlace API exposed typed `workGraph(runId: String)` with optional `runId`; the web adapter no longer required `THEOREM_OPERATOR_RUN_ID`; live gate, drawer, and shift state derived from live `TaskNode` records rather than fixture sections; `apps/commonplace-api/tests/operator_work_graph_acceptance.rs` proved run-scoped and aggregate reads through the real schema. Historical fail-open tests are not authority for current production behavior.
     - **Remaining enrichment, not a live-blocker:** richer drawer chat/tails and shift urgency should later read typed `coordinationStream`, `roomDigest`, and `openPings` once those JSON surfaces are promoted. The current Operator no longer relies on fixture gate/drawer/shift data after a live `workGraph` answers.

## Backend result: typed `workGraph.tasks`

Recorded here (not over the coordination room) because the coordination substrate is degraded this session (`Coordination Context: remote_unavailable`); git + this plan are the durable fallback per the harness-first-coordination rule.

**Original problem.** `workGraph(runId){ tasks }` was declared as an opaque `Json` scalar in `rustyred-thg-mcp/src/graphql/coordination.rs` (`WorkGraphView.tasks: Json`), and `lib.rs:13230` serialized raw `TaskNode` structs through it verbatim (`graph.nodes.values().collect()`). So the contract was fully determined by Rust but **invisible to GraphQL introspection / codegen**; every client saw `tasks: any` and had to hand-mirror the struct. This is what made the operator mapper mis-map twice.

**Completed 2026-07-06.** Theorem `rustyred-thg-mcp/src/graphql/coordination.rs` now exposes `workGraph.tasks` as typed async-graphql `TaskNode` objects (fields: `id, runId, parentId, nodeType, goal, prerequisites, fileScope, status: TaskNodeStatus, claim { owner, epoch, grantedAt, expiresAt, lastHeartbeat }, claimEpoch, receipts, createdBy, reviewRequiredBy`). `nextTaskNode` / `createTaskNode` / `claimTaskNode` intentionally still return `Json` and can follow later. CommonPlace `theorem-operator-live.ts` now selects these typed task fields.
- GraphQL codegen carries the contract; `theorem-harness-schema.ts` becomes *generated*, not hand-maintained.
- Every present + future consumer (TS or otherwise) drops its hand-mirror + tolerant parser.
- The mis-map class of bug is structurally impossible.

**Compatibility guard:** `apps/web/src/lib/theorem-harness-schema.ts` remains the single reviewed parser while deployed backends catch up; it accepts both the old raw serde shape and the new typed GraphQL camelCase selection shape.

**Also worth typing** (same rationale, when their surfaces get wired): `coordinationStream.events`, `roomDigest`, `openPings` are `Json` too — the drawer/shift ports will hit the same guessing tax. Prefer typing at the schema over adding more hand-mirrors.

## Open decisions (per planning discipline, surfaced not buried)

- **D1 — surface→v2-nav mapping. STILL open (Travis's product call), default ADOPTED to unblock.** Working default = the mapping proposed above (Memory→Notes+Graph, Skills→new `/v2/skills`, Agent→Operator/Chat, Rooms→Workrooms, Runs→new `/v2/runs`, Keys/Providers/Connections/Usage/Inbox→admin cluster, Item feed→Index/Tables). PT-010 (backend client) is nav-agnostic, so it does not block on D1; the ports (PT-02x) adopt this default unless Travis redirects.
- **D2 — UPDATED (Travis, 2026-07-11):** the marketing/landing page moves to CommonPlace ownership while remaining a separate public page at `https://theoremharness.com`. It is not folded into the operator app or `app.theoremharness.com` product shell. The URL is preserved through cutover.
- **D3 — RESOLVED by evidence (2026-07-06):** the commonplace-bleed already landed in apps/web as the `theorem-*` client layer + object-contract surface (Codex's `object-contract-v2` merged into `commonplace-v2-porcelain-surface`). PT-040 is a per-commit diff of the 7 `feat(commonplace)` commits against current `apps/web`; the client layer is already present, so PT-040 shrinks to "confirm no un-ported delta," not "port the cluster."
- **D4 — RESOLVED by evidence (2026-07-06):** prod URL = the code default `rustyredcore-theorem-production.up.railway.app` for the harness MCP surface; apps/web reaches Theorem GraphQL via `THEOREM_GRAPHQL_URL` (Railway commonplace-api) + server-only `THEOREM_API_KEY` (x-api-key), both already consumed by `/api/theorem/graphql/route.ts`. Remaining config task (not a decision): set those two env vars on the CommonPlace deploy. The task-node read schema is confirmed live (see Evidence update #2).

## Already done (this session, valid, keep)

- **markdown-theory T2 Slice B** — family CSS + 32-type fixture matrix, committed SSD `41873ba` (needs PT-070 publish).
- **Theorem/apps/desktop Open-With reader** — committed `a2370bb41` (correct host; ports to CommonPlace later per Travis).
- **WRONG-HOST, abandon:** the harness-console read-surface commit `4bba2983d` (on branch `Travis-Gilbert/markdown-theory-deploy`) — superseded by PT-050; do not push.

## Non-goals (this migration)
- Rebuilding any backend. The routes exist; we consume them.
- Redesigning CommonPlace's v2 shell. Ports adopt the existing porcelain system.
