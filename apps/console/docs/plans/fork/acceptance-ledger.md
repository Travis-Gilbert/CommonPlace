# SPEC-COMMONPLACE-FORK-1.0 acceptance ledger

Date: 2026-07-27

This ledger distinguishes local implementation proof from live acceptance.
FK1, FK6, FK10, and FK11 meet their named source and local behavior gates.
The remaining deliverables have implemented slices but still need one or more
live service, outage, identity, or deployment receipts.

## Status vocabulary

| Status | Meaning |
| --- | --- |
| accepted | Every named acceptance condition has replayable evidence at the layer the spec requires. |
| partial | The implementation exists and focused proof passes, but named live evidence is still missing. |
| observed | A source or environment fact was checked. This is not product acceptance. |
| not run | The named live probe, outage exercise, or deployment was not performed. |

## Verify-first ledger

| Check | Status | Evidence or next proof |
| --- | --- | --- |
| Upstream `LICENSE` and `TERMS_SELF_HOSTED.md` | observed | The pinned source supports the MIT hard-fork premise. Fork notices retain the source repository, commit, and license. Trademark, dependency, bundled-asset, and separate-repository reviews remain distinct. |
| `rustyred-thg-pg-server/dbt_project` runs | partial | 20 pgwire unit and 13 integration tests passed, including dbt catalog and materialization protocol cases. No dated real `dbt run` and `dbt test` receipt exists. |
| `commonplace` F3 scope | observed | F3 is the interoperability API, not catalog identity. Focused verification passed 31 unit, 6 F1, 4 F2, and 9 intake tests. |
| Full inherited `server/utils/agents/` loop | observed | Workspace, user, thread, file, memory, citation, attachment, metric, summary, and persistence obligations were recorded before `aibitat` was removed. |
| Full inherited `frontend/src/models/` client seam | observed | The 28-file, 4,205-line directory is an endpoint map. The fork uses typed same-origin boundaries for Express and retains separate Harness and CommonPlace clients. |
| Collector internal auth behavior | observed | The inherited shared-directory and rotating-RSA coupling was rejected. The peer now uses explicit service discovery, bounded byte transfer, timing-safe peer authentication, rotation overlap, and parser worker limits. |
| Live Postgres schema and Prisma collision audit | partial | Static comparison found no exact table collision. Prisma now owns eight `commonplace_identity_*` tables only, but the live PgBouncer schema and data residency were not inspected. |
| `relational_server.rs` entry points | observed | Serve, SQL dispatch, and native execution entry points were read. Time range is wired; knn, geo, and text refuse. Dbt behavior does not answer FK2 transport. |
| Search-stack working trees | observed | The CommonPlace work survived. The Theorem branch survived without its reported dirty worktree. PR #133 was repaired in an isolated worktree and became the fork implementation base. |

## Deliverable ledger

| Deliverable | Status | Implemented and verified | Remaining acceptance evidence |
| --- | --- | --- | --- |
| FK1 Inventory and cut list | accepted | Deterministic replay covers exactly 1,303 tracked files: 549 port, 353 service, 401 cut, 275,449 source lines, with no missing, extra, or duplicate verdict. No upstream source was copied before the verdict ledger existed. | None for FK1. Later imports remain bound to the verdict allowlist and fork notice. |
| FK2 Content tier | partial | One `ContentTransport` seam, workspace-to-`ScopeRef` resolution, `IngestPipeline` delegation, stable source identity, provenance, real passages, deterministic bounded PPR expansion, and measured flat-versus-PPR delta are implemented. GraphQL response bytes are bounded, upstream 5xx responses remain retryable, and cosine thresholds refuse until the RRF lane has defined threshold semantics. JavaScript contract tests and 64 API library tests pass. | The production GraphQL door cannot yet enforce durable per-request tenant scope, so safe mode refuses scoped reads. No live deployed scoped upload and retrieval receipt exists. |
| FK3 Storage bulkhead | partial | Prisma is retained only for eight prefixed identity models on real Postgres. The migration, runtime delegate allowlist, database preflight, identity-only field audit, outage-independent Express health path, deployment config, and 19 storage boundary tests pass. | Do not apply the migration until a live PgBouncer collision and restore audit is complete. RustyRed-down login, Postgres-down graph integrity, restore, and cross-store residency exercises remain not run. |
| FK4 Harness replaces aibitat | partial | The Express bridge presents only `catalog`, `describe`, and `invoke`; suppression is checked at discovery, description, and invocation; identity and receipt bindings fail closed; chat context, attachments, citations, metrics, persistence, and receipt verification are covered. The workspace page now refuses the legacy unscoped ACP fallback. The full server suite has no `aibitat` import and passes 121 tests. | Production runner and persistence adapters still need to connect the scoped bridge before workspace chat is enabled. No authenticated deployed chat turn reached the Harness runner and returned a durable run receipt through this new Express service. |
| FK5 Page architecture | partial | Typed App Router pages now exist for login, invite, onboarding, workspace chat, workspace settings, admin, and surviving general settings. Same-origin identity routes keep service credentials server-side. Workspace links use durable IDs; a legacy slug is accepted only when it resolves uniquely across the principal's memberships. The production build emits every named page, and fork browser tests pass. | A real user has not completed register, onboarding, workspace creation, upload, retrieval-backed chat, and redeploy persistence against deployed peers. |
| FK6 Blocks inside pages | accepted | Pages own routes; descriptors own rendering. The workspace shell composes multiple registered blocks, block placement and resize actions persist through the object seam, the full browser suite exercises shell composition, and production routing contains no `/v/[viewId]`. Persisted legacy paths migrate to canonical pages. | Live populated workspace parity remains part of the broader visual milestone, not the FK6 routing acceptance. |
| FK7 Collector service | partial | A separate collector peer accepts bounded bytes, rejects unauthenticated calls before parsing, cannot admit browser scope, reserves parser capacity before reading an upload body, bounds its internal worker queue, enforces output limits and worker deadlines, and returns correlated parsed documents. Express authorizes membership and passes parser output into `IngestPipeline` with stable source metadata. Collector and upload contract tests pass. | The first parser slice intentionally supports text and Markdown only. No deployed browser upload traversed Console, Express, collector, CommonPlace API, and RustyRed with an auto collection receipt. |
| FK8 Auth and multi-user | partial | Stable provider subjects, exact tenant casing, workspaces, roles, membership, validated invites, single-use invite acceptance, internal hashed API-key storage and revocation, admin admission, and active workspace claims are implemented. Every user-scoped graph or Harness resolution requires and revalidates a signed active-workspace claim. Authenticated JSON routes reject before reading the bounded body, and workspace plus `ScopeRef` headers reach graph and Harness boundaries. Public API-key issuance fails closed until a consumer can enforce that scope. | No real second OAuth identity completed the invite flow. Public API-key issuance and its deployed probe remain disabled. The content backend still must enforce the admitted scope at the graph read. |
| FK9 Embed widget | partial | A separate no-remote hard fork exists at `779f262dacb581c004c6e33d237f5d43dc67711d`. Its 62-file inventory preceded copy, MIT provenance is retained, 8 tests pass, production assets build independently, auth configuration is bounded, and citations survive history and stream normalization. | The real fork server does not yet expose the complete embed contract. Live token isolation, origin policy, history, reset, stream, browser rendering, and deployed citation proof remain. |
| FK10 Modality surfaces | accepted | The ordered 11-surface list records a reason per modality. `RecordTableView` is built, registered, route-reachable, and browser-tested. The next five graph-native surfaces are also registered and exercised. | Live modality data and later temporal, geographic, and tensor renderers remain future product work, but are outside FK10's named acceptance gate. |
| FK11 Retirement | accepted | CN1 records a verdict for every Console view. The harvested search stack and shadcn primitives pass their gates. `apps/web` is deleted, the root deployment builds Console, all 62 remaining view files are reachable, old seeded view trees are removed, and `/v/chat` returns an HTTP 404. The full browser run passes 83 with 1 live-only skip. | The production redirect and authenticated deployed one-shell flow still need operational proof, but no dead source routing path remains. |

## Storage outage acceptance cases

| Case | Expected result | Status | Evidence |
| --- | --- | --- | --- |
| Stop RustyRed while Postgres remains healthy | Login and membership checks work; content renders an honest degraded state; no content write reports success. | partial | Lazy content construction and independent identity health pass locally; live outage not run. |
| Stop Postgres or PgBouncer while RustyRed remains healthy | New auth and writes refuse; graph state remains intact; no mutation is attributed to an unverified user. | not run | Requires live peers and an operator recovery probe. |
| Restore RustyRed | Existing conversations and documents reappear without replay from Postgres. | not run | Requires persisted deployed content. |
| Restore Postgres | Sessions recover according to policy without graph repair or content migration. | not run | Requires the production identity database and restore procedure. |
| Audit both stores | Postgres contains no document body, embedding, chat message, memory, plan, or receipt. | partial | Static schema passes; live data residency audit not run. |

## Harness bounded-surface acceptance cases

| Case | Expected result | Status | Evidence |
| --- | --- | --- | --- |
| Tenant has a small tool catalog | The model sees only catalog, describe, and invoke. | accepted | Contract test passes. |
| Tenant has 108 or more tools | The model still sees only the same three affordances. | accepted | The 108-tool contract test passes. |
| Tool is suppressed after discovery | Catalog omits it, describe refuses it, and invoke rechecks and refuses it. | accepted | Catalog, describe, and invoke suppression tests pass. |
| Allowed tool is invoked | Result has tool provenance and the chat turn has a verified Harness run receipt. | partial | Injected runner and verifier pass; deployed Harness turn not run. |

## Collector boundary acceptance cases

| Case | Expected result | Status | Evidence |
| --- | --- | --- | --- |
| Browser calls collector directly | Refused. | accepted | Peer-auth contract test passes. |
| Peer call lacks service authentication | Refused before parsing. | accepted | Authentication-before-parser test passes. |
| Request carries a forged tenant | Collector cannot override Express-derived scope. | accepted | Scope admission test passes. |
| Valid upload | Parser output reaches `IngestPipeline` with source metadata and correlation intact. | partial | Local service seams and Rust source acceptance pass; deployed upload not run. |
| Collector is unavailable | Upload reports a retryable parsing failure and no partial ingest success. | accepted | Retryable outage and receipt alignment tests pass. |

## CN5 harvest and FK11 retirement gate

| Precondition | Status | Evidence |
| --- | --- | --- |
| Every upstream file has an FK1 verdict | accepted | Exact 1,303-path inventory replay. |
| Console shadcn setup exists and is register-tokened | accepted | Seven retained primitives pass register and import gates. |
| Search frontend and tests are harvested | accepted | Console and search package tests plus browser acceptance pass. |
| Theorem search backend worktree is recovered | observed | Branch recovered; reported uncommitted tree did not survive. No unverified patch was imported. |
| Porcelain OKLCH derivation is evaluated | accepted | CN1 records the competing register as inspected and rejected. |
| CN1 identifies stronger `apps/web` views | accepted | Search was the only further-ahead counterpart harvested; other route groups received explicit cut verdicts. |
| Non-web apps are independent of `apps/web` | accepted | `apps/web` is absent and the repository build and import fence pass. |
| Harvested console is equal-or-better | accepted | Full Console gates, production build, and 83-browser-test pass establish the local replacement. |
| `apps/web` deletion is safe | accepted | Canonical-root and import-fence gates pass after deletion. |
| Redirect and one-shell behavior work live | partial | Source and Railway configuration select Console; deployed redirect and authenticated browser proof remain. |

## Verification record

Current local receipts:

- Fork Express service: 121 tests passed.
- Console: 91 Vitest files and 411 tests passed, plus 2 Railway tests.
- CommonPlace API library: 64 tests passed.
- Console architecture and design gates: all passed.
- Console production build: passed with 29 generated pages and no `/v` route.
- Playwright: 83 passed and 1 live-only integration test skipped.
- CommonPlace API source identity acceptance: 1 passed.
- Embed fork: 8 tests and independent production build passed.
- FK1 inventory replay: 1,303 of 1,303 paths with exact line accounting.

No production deployment, live database migration, outage exercise, real
second-identity callback, live Harness turn, or deployed embed browser flow was
performed in this implementation pass.
