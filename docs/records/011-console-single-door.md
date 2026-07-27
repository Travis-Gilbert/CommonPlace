# 011 — Console single door

Register: HANDOFF-CONSOLE-SINGLE-DOOR-1.0. Companion to SPEC-THEOREM-MULTI-TENANT-1.0.

## Rule

If a human surface can only reach data through MCP, that is a hole in the data
tier. Fill the hole. MCP is the agent door. `commonplace-api` is the console's
only data door.

## Verify First answers

### 1. Console outbound doors (before cutover)

| Door | Env | Auth | Used for |
| --- | --- | --- | --- |
| Harness MCP / GraphQL | `CONSOLE_HARNESS_URL` + `CONSOLE_HARNESS_TOKEN` (Bearer) | Board Indexer via `callHarnessGraphql` → `graphql_query`; Plan/Program; memory; presence; runs; delegate | Agent + (was) Indexer |
| Node | `THEOREM_NODE_URL` + `THEOREM_API_TOKEN` (Bearer) | `POST /v1/rustyweb/search` via `localInquiryUrl`; ACP WebSocket | Search + chat |
| Data API | `CONSOLE_DATA_API_URL` + `CONSOLE_DATA_API_KEY` (`x-api-key`) | Objects, Find, workspace | Records |

Real bearer for the agent door: `CONSOLE_HARNESS_TOKEN`. Real node bearer:
`THEOREM_API_TOKEN`. Data seam uses `CONSOLE_DATA_API_KEY` (not Bearer).

Indexer board path already existed: `SurveyView` → `/api/indexer` →
`readIndexerObjects` → `topicIndexerObjects`. It rode the agent door.

### 2. commonplace-api volume

`commonplace-api-volume` mounts at `/data` and backs `COMMONPLACE_DATA_DIR`: the
CommonPlace consumer plane (items, collections, filing, workspace, proactivity
fixture edits). It is not the standing-topic harvest plane. Harvest truth lives
on the tenant store (`rustyred-store` / `THEOREM_STORE_URL`).

Auth today: per-instance API key / principal token / signed request resolving to
`ResolvedIdentity` (tenant from credential, never advisory headers). Store dial:
local RedCore when `COMMONPLACE_DATA_DIR` is set; store gRPC for Indexer/search
added by this handoff.

### 3. Shared schema mount

Full Harness `QueryRoot` mount into the consumer schema is blocked by the
thread-local invoker + private `graphql` module + incompatible Schema types.
Preferred path shipped: export `indexer_objects_payload` from
`rustyred-thg-mcp` (same function MCP GraphQL calls) and mount a consumer field
`topicIndexerObjects` over `GrpcMcpProvider` / in-process test store. Same
resolver layer, different transport. Full schema extract remains follow-up.

### 4. RustyWeb search ownership

Owning service: the store's `POST /v1/rustyweb/search`
(`rustyred-thg-server`), tenant-scoped in the request body. Not
`theorem-grpc`'s `theseus_search.v1.SearchService` (no tenant field; civic atlas
graph search). `THEOREM_NODE_URL` aimed at the wrong public host was the bug.
`commonplace-api` now proxies search with server-injected tenant to
`THEOREM_STORE_URL`.

## Cutover evidence

| Criterion | Evidence |
| --- | --- |
| Board via data API | `indexer-harness.ts` uses `consumerGraphqlUrl()` → `CONSOLE_DATA_API_URL`; no `CONSOLE_HARNESS_*` on that path |
| Search via data API | `web-research.ts` / Indexer live search call `rustyWebSearch` on the data API |
| One data URL | Railway console: `CONSOLE_DATA_API_URL` reference to commonplace-api; `THEOREM_NODE_URL` and `THEOREM_GRAPHQL_URL` removed |
| Payload parity | `tests/topic_indexer_objects_acceptance.rs` compares shared payload vs consumer field |
| No client tenant | SDL field signatures for `topicIndexerObjects` and `rustyWebSearch` omit tenant/actor/project |
| Tenancy seam | `derive_tenant_from_session` in `tenancy.rs`; interim returns credential tenant |

## Named agent-door exceptions (still MCP)

These remain on `CONSOLE_HARNESS_URL` + `CONSOLE_HARNESS_TOKEN` until a later
data-tier fill:

- Plan / Goal Stack (`/api/harness/plan`)
- Programmable graph (`/api/harness/program`)
- Delegate, presence, runs REST
- Harness UX boot/status/why (partial GraphQL fallback)
- Indexer preview asset bytes (`topicPreviewAsset`) until mounted on
  commonplace-api

ACP chat uses `THEOREM_ACP_WS_URL`, not `THEOREM_NODE_URL`.
