# SPEC-COMMONPLACE-FORK-1.0 acceptance ledger

Date: 2026-07-27

This ledger separates observed facts from acceptance. FK1 is accepted. Every
later deliverable remains partial, blocked, or a recorded decision.

## Status vocabulary

| Status | Meaning |
| --- | --- |
| accepted | Every named acceptance condition for this deliverable has replayable evidence. |
| observed | A source or worktree fact was checked. This is not acceptance. |
| decision | The architecture choice is recorded, but implementation proof is missing. |
| partial | Some required evidence exists and named evidence is still missing. |
| blocked | A prerequisite is absent or cannot yet be established. |
| unknown | The check has not been completed. |
| not run | The required test, outage exercise, browser review, or live probe was not run. |

## Verify-first ledger

| Check | Status | Evidence or next proof |
| --- | --- | --- |
| Upstream `LICENSE` and `TERMS_SELF_HOSTED.md` | observed | Pinned source text supports the MIT hard-fork premise. The notice is retained for the first copied service file. Trademark, bundled-asset, dependency, and separate-repository reviews remain. |
| `rustyred-thg-pg-server/dbt_project` runs | partial | 20 pgwire unit and 13 integration tests passed, including dbt catalog/materialization protocol cases. No dated real `dbt run/test` receipt exists, and local dbt is Fusion 2.0 preview. |
| `commonplace` F3 scope | observed | F3 is the interoperability API, not catalog identity. API keys are in memory and the crate has no catalog dependency. 31 unit, 6 F1, 4 F2, and 9 intake tests passed in focused Theorem verification. |
| Full inherited `server/utils/agents/` loop | observed | The loop was behavior-reviewed. FK4 must preserve workspace/user/thread history, parsed and pinned file scopes, memories, citations, attachments, metrics, summarization, and chat persistence. |
| Full inherited `frontend/src/models/` client seam | observed | The 28-file, 4,205-line directory is an endpoint map, not a complete client seam. SSE, websocket, survey, session, and other direct calls live elsewhere. |
| Collector internal auth behavior | observed | Express and collector share the hot directory, output storage, and rotating RSA keys. Production uses `X-Integrity`; development skips it. Peer service operation requires adaptation. |
| Live Postgres schema and Prisma collision audit | partial | Static migration comparison found no exact table-name collision and did find semantic overlap plus catalog `cold_*` tables. The live PgBouncer schema and data residency were not inspected. |
| `relational_server.rs` entry points | observed | Serve, SQL dispatch, and native execution entry points were read. Time-range is wired; knn, geo, and text are explicitly refused. Dbt behavior does not answer FK2 transport. |
| Search-stack working trees | observed | CommonPlace survives clean/detached. The Theorem branch survives with no worktree, 227 commits behind and 9 ahead; patch analysis finds three unique and three equivalent commits. |

## Deliverable ledger

| Deliverable | Status | Observed evidence | Missing acceptance evidence |
| --- | --- | --- | --- |
| FK1 Inventory and cut list | accepted | The deterministic generator was independently replayed against pinned commit `633fc1960914298009134b40c25007cb422c7884`: 1,303 tracked regular files, 1,303 unique verdicts, 275,449 lines, and no missing, extra, or duplicate path. No upstream source was copied before this proof. | None for FK1. Later ports must still obey the verdict allowlist and migration dependencies. |
| FK2 Content tier | partial | One `ContentTransport` seam, admitted-scope resolver, RustyRed adapter, PPR graph arm, GraphQL measurement, provenance mapping, and 7 JavaScript contract tests are implemented. The GraphQL driver now fails closed unless `COMMONPLACE_UNSAFE_ALLOW_UNSCOPED_GRAPHQL=1` is set for explicit single-scope fallback. All 3 retrieval tests pass in the clean validation layout. | No live scoped ingest/retrieval was run. The GraphQL server still lacks durable multi-tenant enforcement and scoped delete/reset, so the driver refuses safe-by-default and destructive operations still refuse instead of reporting success. |
| FK3 Storage bulkhead | decision | AD1 records the Prisma decision, table ownership rule, storage matrix, and outage states. | No live schema collision audit, migration, data-residency audit, login-during-graph-outage test, or graph-integrity-during-Postgres-outage test was run. |
| FK4 Harness replaces aibitat | decision | AD4 fixes the model-visible surface at catalog, describe, and invoke, backed by the Harness bounded gateway. The inherited loop's scope and persistence obligations are recorded. | No Express agent service is imported, no `aibitat` import scan can run against it, no chat turn reached the Harness, and no run receipt was observed. |
| FK5 Page architecture | partial | The console already uses Next App Router and has typed application code. AD5 records page order and route ownership. | Login, invite, onboarding, workspace settings, admin, surviving General Settings, upload, redeploy persistence, and full end-to-end flow are not ported or tested. |
| FK6 Blocks inside pages | partial | The descriptor registry is route-independent and the first six named view sources exist. | No fork workspace page composes the required two blocks, splitter persistence is not proven, and `/v/[viewId]` still exists. |
| FK7 Collector service | decision | AD3 records parsing-only responsibility and the peer auth boundary. The shared filesystem, output storage, collector URL, and integrity-key coupling are known. | No collector files are imported yet. Configurable discovery, peer auth, byte/shared-volume choice, upload, parse, scoped ingest, source metadata, and auto collection remain unproved. |
| FK8 Auth and multi-user | blocked | The storage and tenant rules are recorded. | No inherited endpoint port, two-user isolation test, invite flow, API key auth test, or graph-read tenant enforcement proof exists. |
| FK9 Embed widget | blocked | The independent-build boundary is retained. | The separate embed repository is not in this worktree. No build, authentication, retrieval, or citation test was run. |
| FK10 Modality surfaces | partial | AD7 records an ordered list with reasons. `RecordTableView`, the first surface, exists and is registered in the baseline console. | Fork product parity, live modality data, and screenshot review are not established. The later modality blocks remain design-only or blocked. |
| FK11 Retirement | blocked | AD8 records CN5 preconditions. PR #133 is a directly applicable harvest candidate that deletes `apps/web`, ports search, and updates deployment. | PR #133 has six browser failures and retains `/v/[viewId]`. It must be repaired and reverified before its deletion can count as retirement. |

## Storage outage acceptance cases

| Case | Expected result | Status |
| --- | --- | --- |
| Stop RustyRed while Postgres remains healthy | Login succeeds, identity-backed workspace chrome renders, content reports an honest degraded state, and no content write reports success. | not run |
| Stop Postgres or PgBouncer while RustyRed remains healthy | New auth and user writes refuse safely, graph state remains readable through the independent operator recovery path, and no graph mutation is attributed to an unverified user. | not run |
| Restore RustyRed | Existing conversations and documents reappear without replay from Postgres. | not run |
| Restore Postgres | Sessions recover according to identity policy without graph repair or content migration. | not run |
| Audit both stores | Postgres contains no document body, embedding, chat message, memory, plan, or receipt. | not run |

## Harness bounded-surface acceptance cases

| Case | Expected result | Status |
| --- | --- | --- |
| Tenant has a small tool catalog | The model sees only catalog, describe, and invoke. | not run |
| Tenant has 108 or more tools | The model still sees only the same three affordances. | not run |
| Tool is suppressed after discovery | Catalog omits it, describe refuses it, and invoke re-checks and refuses it. | not run |
| Allowed tool is invoked | Result includes tool provenance and the chat turn includes a harness run receipt. | not run |

## Collector boundary acceptance cases

| Case | Expected result | Status |
| --- | --- | --- |
| Browser calls collector directly | Refused. | not run |
| Peer call lacks service authentication | Refused before parsing. | not run |
| Request carries a forged tenant | Collector cannot override the Express-derived scope. | not run |
| Valid upload | Parser output reaches `IngestPipeline` with source metadata and correlation identity intact. | not run |
| Collector is unavailable | Upload reports a retryable parsing failure and no partial content record is reported as ingested. | not run |

## CN5 harvest and FK11 retirement gate

| Precondition | Status | Evidence or blocker |
| --- | --- | --- |
| Every upstream file has an FK1 verdict | accepted | Generator replay proves exact 1,303-path coverage. |
| Console shadcn setup exists and is register-tokened | partial | PR #133 moves `apps/web/components.json` into the console and adds register-tokened components. The commit is not yet integrated here. |
| Search frontend and tests are harvested | partial | PR #133 contains the search harvest and tests. Its browser gate is red, so the harvest is not yet accepted. |
| Theorem search backend worktree is recovered | observed | The branch exists without a worktree. Three unique patches require reconciliation; the reported uncommitted tree did not survive. |
| Porcelain OKLCH derivation is evaluated | unknown | No verdict is recorded here. |
| CN1 identifies any stronger `apps/web` view | unknown | CN1 audit was not inspected as complete in this branch. |
| Non-web apps are independent of `apps/web` | partial | Textual references exist in mobile and desktop. A runtime import and parity-test audit is still required. |
| Harvested console is equal-or-better | not run | No matched before, after, and target screenshot review exists. |
| `apps/web` deletion is safe | blocked | All preceding rows must resolve first. |
| Redirect and one-shell behavior work live | not run | Requires deployed browser proof, not only source inspection. |

## UI visual milestone

| Gate | Status | Evidence | Remaining work |
| --- | --- | --- | --- |
| Runtime complete | partial | The FK2 PPR and RustyRed adapter slice is implemented and contract-tested. | Build and test the remaining selected runtime slices. |
| Product complete | no | The FK2 seam is not yet an enabled end-to-end fork workflow. | Prove the user workflow and equal-or-better visual behavior. |
| Vision complete | no | The full page, service, block, and modality vision is not implemented. | Reconcile every FK deliverable and remaining modality delta. |
| Baseline screenshots captured | partial | Existing tracked snapshots cover mature routes, and a deployed 1440x900 signed-out baseline was captured from `https://v2.theoremharness.com/`. | File authenticated and populated before states plus do-not-change captures. |
| Target references captured | no | No fork target set is filed. | File target pages and modality composition references. |
| Do Not Downgrade gate | not run | No replacement surface was compared. | Compare every replacement with the mature console baseline. |
| Screenshot review | not run | No matched before, after, and target set exists. | Review realistic populated data and constrained viewports. |
| Reversible boundary | decision | AD8 separates inventory, adapters, pages, block parity, route switch, and retirement. | Preserve those boundaries in implementation and commit history. |

## Evidence commands used for this ledger

Evidence commands included:

- `git worktree list --porcelain` and branch inspection in CommonPlace and
  Theorem.
- `git status --short --branch` in the recoverable CommonPlace search worktree.
- Source reads of the block-view descriptor and registry, current App Router
  routes, Playwright configuration and snapshots, `commonplace-api` ingest and
  search surfaces, the RustyRed product server route table, the pgwire README,
  and `rustyred-thg-catalog` migrations.
- `node apps/console/scripts/generate-fork-inventory.mjs --source
  <pinned-checkout> --check`.
- `npm --prefix server run test:rustyred`, with 7 tests passed.
- `cargo test ... retrieve::tests --lib` in the clean validation layout, with
  3 tests passed and 53 filtered out.
- A Playwright screenshot of the deployed production route at 1440x900.

No database migration, live scoped upload, service outage, authenticated agent
turn, embed build, or deployment was performed.
