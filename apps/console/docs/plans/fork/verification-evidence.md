# SPEC-COMMONPLACE-FORK-1.0 verification evidence

Date: 2026-07-27

This file answers the Verify First list against pinned source. It separates
source observation, focused tests, and missing live acceptance.

## Source anchors

| Source | Commit | State |
| --- | --- | --- |
| CommonPlace fork worktree | `2b03e71cedf505f0a2a0d5a1d41492b271e5d257` base | Isolated SSD worktree on `Travis-Gilbert/commonplace-fork-1-0`; implementation commits are layered above this base. |
| AnythingLLM | `633fc1960914298009134b40c25007cb422c7884` | Clean `Mintplex-Labs/anything-llm` master checkout. |
| Theorem | `108b557e629bba64db3dcefbefcd178a1acf375b` | Current `origin/main`; audited crate paths matched this commit byte for byte. |
| Console consolidation base | PR #133, repaired in an isolated worktree | CN5 harvest was repaired and integrated as `bf27280`; browser acceptance passes, `apps/web` is deleted, and this fork subsequently retires `/v/[viewId]`. |

## License and terms

The upstream `LICENSE` is MIT. It grants use, modification, publication,
distribution, sublicensing, and sale, with the copyright and permission notice
retained in copies or substantial portions.

`TERMS_SELF_HOSTED.md` covers Docker, Desktop, and source distributions and
reaffirms that the core is MIT. Its text describes telemetry, third-party
services, host security, CDN behavior, and lack of an SLA. It does not state a
second code license, upstream synchronization duty, field-of-use limit, or fork
restriction.

This is a source-text finding, not legal advice. Trademark and branding rights,
dependency licenses, bundled assets, and the separate embed repository still
need their own review.

The first copied upstream service file was
`server/utils/vectorDbProviders/base.js`. Its exact MIT text is retained at
`server/LICENSE.anything-llm`, with provenance in
`server/THIRD_PARTY_NOTICES.md`. Console page adaptations also declare the
pinned source in `apps/console/NOTICE.md`.

## Pgwire and dbt

`rustyred-thg-pg-server` is a real Postgres wire server:

- `src/main.rs` selects relational mode over `demo_native_store()` and defaults
  to port 6543.
- `relational_server.rs` exposes the serve entry, SQL dispatch, and native
  execution path.
- Focused Theorem verification passed 20 pgwire unit tests and 13 integration
  tests. Those tests include dbt catalog, materialization, and grounding
  protocol behavior.
- The checked-in README includes dbt fixture commands.

There is no dated receipt from a real `dbt run` and `dbt test` against the
server. The installed local `dbt` command is Fusion 2.0 preview, so a supported
dbt plus Postgres adapter must run before live dbt acceptance is claimed.

Dbt protocol proof does not answer FK2 transport. The SQL dispatcher currently
accepts only the time-range modality and explicitly refuses knn, geo, and text.
Core and MCP have a live modality resolver, but pgwire SQL does not invoke it.

## Content transport

No existing single service composes ingest, vector retrieval, and PPR:

| Door | What it serves | Missing FK2 behavior |
| --- | --- | --- |
| Pgwire 6543 | Relational planner and dbt-facing protocol | knn, text, and geo are refused. |
| RustyRed product HTTP/gRPC 8380 | Raw graph, vector, and PPR primitives | Does not invoke CommonPlace `IngestPipeline`. |
| `commonplace-api` GraphQL 50090 | `IngestPipeline` ingest and CommonPlace retrieval | Durable multi-tenant serving is refused in current source. |

The fork therefore implements one configurable `ContentTransport` seam and a
GraphQL driver now. The branch upgrades `commonplace-api` retrieval from
one-hop graph expansion to core personalized PageRank, exposes the measured
delta beyond flat vector-plus-lexical candidates, and forwards a stable source
reference into `IngestPipeline`. A Rust acceptance test proves repeated ingest
of that source updates one item instead of creating a duplicate. A later 8380
or pgwire driver must prove contract parity before replacing it.

## CommonPlace F3

F3 is the interoperability API, not catalog-backed identity. Its API key
registry is in memory and `apps/commonplace-api` has no
`rustyred-thg-catalog` dependency. Any source comment calling F3 catalog-backed
is stale documentation.

Focused Theorem verification passed:

- 31 CommonPlace unit tests
- 6 F1 acceptance tests
- 4 F2 acceptance tests
- 9 intake tests

The fork's PPR slice passed all 3 `retrieve::tests` against a clean Theorem
`origin/main` validation layout after applying two baseline-only compatibility
fixes to the temporary copy. The unmodified CommonPlace base currently fails
first in existing `find.rs` and `save_url.rs` `GraphSnapshotSource` usage. Those
failures are not caused by the PPR patch and are not fixed in this branch.

## Identity schema and Prisma

`rustyred-thg-catalog` currently migrates:

- tenants
- projects
- billing accounts
- auth principals
- cold index
- cold scope

Its public API implements tenant and project upsert/list operations. It does
not implement users, sessions, invites, workspace membership, roles, or API-key
CRUD. Billing and auth tables also lack the full application API needed by FK8.

Static comparison found no exact table-name collision with the current
AnythingLLM Prisma schema, but there is semantic overlap among tenant, project,
principal, workspace, user, and key concepts. The catalog's `cold_*` tables
also violate a strict identity-only Postgres deployment if its migrations are
applied wholesale.

The implementation keeps Prisma on real Postgres, assigns one migration owner
per table, and limits Prisma to eight prefixed identity models: user, account,
session, workspace, role, membership, invitation, and API key. The generated
migration is intentionally unapplied. Runtime preflight rejects non-Postgres
or graph-like database targets, and the application exposes only a closed
identity delegate allowlist. A live PgBouncer schema, restore, outage, and
data-residency audit is still required.

## Agent loop and MCP

The inherited agent path exits ordinary chat before the normal vector retrieval
path, then rebuilds scoped context. A harness replacement must preserve:

- workspace, user, and thread-scoped history
- parsed files scoped by workspace, thread, and user
- workspace-wide pinned documents
- citations, attachments, metrics, and clarifying-question output
- workspace RAG memory
- user-global plus workspace user memory
- document summarization scoped by workspace

AnythingLLM calls `listTools()` at startup and creates a plugin per unsuppressed
tool. It also has a default-on reranker that normally limits the request to 15
tools, but the limit can be disabled and reranker failure falls back to the full
set. Its boundedness is therefore not an invariant.

The implemented Harness bridge maps the model-visible contract to `catalog`,
`describe`, and `invoke`, with `catalog` backed by bounded tool search rather
than eager flattening. Per-tool policy is rechecked immediately before invoke.
It binds tenant, workspace, scope, actor, bearer, continuation, tool receipts,
and the turn receipt, and preserves scoped history, attachments, citations,
metrics, and persistence. Contract proof passes locally; a deployed
authenticated turn has not been observed.

## Frontend client seam

`frontend/src/models` contains 28 files and 4,205 lines. It is an endpoint map,
not a complete client boundary:

- raw fetch calls are repeated
- the base is `VITE_API_BASE || "/api"`
- bearer auth comes from browser local storage
- workspace and thread chat use SSE
- agent websocket, embedding progress SSE, push notifications, onboarding
  survey, and session calls live outside `models`

The port needs explicit Express, CommonPlace, and Harness destinations or one
same-origin gateway, plus separate SSE and websocket contracts.

## Collector service

The inherited collector could not run unchanged as a peer because it depended
on a hardcoded loopback host, shared hot and output directories, regenerated
RSA keys, and a development integrity bypass.

The implemented service replaces that coupling with:

- explicit `COMMONPLACE_COLLECTOR_URL` discovery
- exact raw-byte transfer with independent request and extracted-text limits
- timing-safe peer credentials plus an explicit previous-token rotation window
- authentication before parser admission
- bounded parser concurrency, queue abort, and physical worker termination at
  the deadline
- correlation checks and aligned per-document ingest receipts
- scope derived by Express, never by the browser or collector

Express then calls the content seam with stable source metadata. The first
production parser supports UTF-8 text and Markdown. A deployed multi-format
upload remains open.

## Search-stack recovery and retirement

The CommonPlace search worktree survives clean and detached at `985fcc6`; its
named branch points at `24d4b9b`.

The Theorem `claude/search-stack-impl` branch exists locally and remotely but
has no attached worktree. Relative to current main it is 227 commits behind and
9 commits ahead; patch analysis reports three unique and three patch-equivalent
commits. The previously reported uncommitted worktree does not survive.

CommonPlace PR #133 supplied the harvest base. Its six browser failures were
repaired before integration. The final Console state:

- harvests search into `@commonplace/search-stack`
- derives the palette from descriptor metadata
- retains durable authenticated chat persistence
- deletes `apps/web`
- builds Console from the root Railway configuration
- removes `/v/[viewId]` and seeded duplicate view trees
- migrates known persisted view paths to canonical pages

The current full browser run passes 83 tests with one live-service test
intentionally skipped. The skipped case joins live GraphQL workspace and
Harness Plan routes and is not treated as local acceptance.

## Current verification receipts

- Fork Express service: 92 of 92 tests passed.
- Console: 84 Vitest files and 378 tests passed, plus 2 Railway tests.
- Console architecture and visual gates: all passed.
- Console production build: passed; 29 pages generated and no `/v` route.
- Playwright: 83 passed, 1 live-service case skipped, 0 failed.
- CommonPlace API stable source acceptance: 1 passed.
- Independent embed fork: 8 tests and production build passed.

No production deploy, identity migration, live outage exercise, real
second-user OAuth callback, deployed Harness turn, or real embed-server browser
flow was performed.
