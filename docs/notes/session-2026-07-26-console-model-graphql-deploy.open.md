# Console Models and Harness GraphQL Handoff

Date: 2026-07-26

## Objective

Finish the CommonPlace Console Models surface against the typed Theorem Harness
GraphQL schema, route Harness GraphQL through the deployed MCP door, merge both
repositories, and verify the live deployment without treating CI or transport
health as product acceptance.

## Completed

### Theorem

PR: <https://github.com/Travis-Gilbert/Theorem/pull/329>

Merged commit:
`ea44e84191b99aede3ea8343ea040dbfda945dc3`

Implemented on the typed Harness schema:

- `observedModel(topicId)`
- `declaredModel(topicId)`
- `compileDeclaredModel(topicId)`
- `pinObserved(input)`
- `unpinDeclared(targetId)`
- `proposeSchemaChange(input)`

The implementation preserves admitted tenant scope and uses `topicId` only as
a narrower projection. Declared metadata writes are atomic. Compile is
read-only. Proposal returns a draft and does not mutate.

Also completed:

- DATAWAVE observed-model projection
- declared metadata engine and SchemaVersion bookkeeping
- checked-in generated Harness SDL
- `dump-harness-sdl` emitter
- byte-for-byte SDL drift test
- focused resolver and projection tests

### CommonPlace

PR: <https://github.com/Travis-Gilbert/CommonPlace/pull/124>

Merged commit:
`248eaf616d30ac974132a905f0f56991d22333a9`

Implemented:

- `callHarnessGraphql` now calls the MCP `graphql_query` or `graphql_mutate`
  tool instead of posting to a nonexistent `/graphql` route.
- Models, Memory, and Indexer use the shared Harness MCP GraphQL transport.
- Removed Indexer calls to the nonexistent direct Harness GraphQL route.
- Added explicit degradation mappings for:
  - `harness_graphql_failed`
  - `harness_graphql_timeout`
  - `harness_graphql_unconfigured`
  - `harness_graphql_unreachable`
- Added transport, Indexer, and degradation tests.

Proactivity and Filing still have separate direct GraphQL adapters. They were
not silently retargeted because their fields are absent from both the current
Harness SDL and the consumer API schema. That is a separate schema decision.

## Validation Completed

Theorem:

- DATAWAVE observed projection test passed.
- typed schema resolver test passed.
- topic field schema test passed.
- SDL drift test passed.
- `cargo check -p rustyred-thg-mcp --lib --locked` passed.
- changed-slice rustfmt and `git diff --check` passed.
- Only existing dead-code warnings remained.

CommonPlace:

- 61 Vitest files and 272 tests passed.
- Console TypeScript check passed.
- Console lint had zero errors and 10 unrelated existing warnings.
- Console fence gate passed.
- `git diff --check` passed.

CI was unavailable account-wide. Do not reinterpret that as a code failure or
as proof that the local checks did not run.

## Live Railway State

Project:
`d63e07ef-eef1-4111-aa06-6eb9c1188560`

Environment:
`62458b07-0e29-46d5-bbab-ec3ee87bc960`

### CommonPlace Console

Service:
`664f84b2-d56d-4a75-b135-cc4680e5464a`

Public URL:
<https://v2.theoremharness.com>

PR 124 deployment `f19c4790-c1a1-4303-8e4d-e48910f8a09a` succeeded and was
later removed because newer `main` deployments superseded it.

The currently active deployment is successful:

- deployment: `f79ce8d2-c704-4133-b024-49ebc51ee62b`
- commit: `5ce37880c704fa92b4f24b6906d5fb81a900e528`

That newer commit includes PR 124 through `main`.

Live non-secret Console variables were verified inside the running container:

```text
CONSOLE_HARNESS_URL=https://api.theoremharness.com
CONSOLE_DATA_API_URL=http://commonplace-api.railway.internal:8080
THEOREM_GRAPHQL_URL=https://commonplace-api-production.up.railway.app/graphql
```

This is a Railway Console deployment, not a confirmed Vercel deployment.
Do not add Vercel variables until an actual Vercel Console project and consumer
are identified.

### Theorem Harness Edge

Service:
`dfd5a598-81d5-430a-97a5-fe9da0f24fd5`

Deployment:
`12f0186f-7d72-4f14-86b0-5dbb7245b4ec`

Status: `SUCCESS`

Commit:
`ea44e84191b99aede3ea8343ea040dbfda945dc3`

Domains:

- <https://api.theoremharness.com>
- <https://theorem-production.up.railway.app>

The service built `apps/theorem-harness-server/Dockerfile`, which copies the
current `rustyredcore_THG/crates` tree and includes `rustyred-thg-mcp`.

Both public health endpoints returned ready with healthy store, metadata, and
session dependencies.

### Important Endpoint Split

The installed Theorems Harness plugin still points to:

<https://rustyredcore-theorem-production.up.railway.app/mcp>

The live CommonPlace Console points to:

<https://api.theoremharness.com/mcp>

The plugin-backed `mcp__theorem_local.graphql_query` still reported unknown
fields for `observedModel`, `declaredModel`, and `compileDeclaredModel`.
That probe is against the old plugin endpoint and does not test the URL used by
the live Console.

Do not use that plugin probe as the Console acceptance gate unless the plugin
endpoint is first changed to `https://api.theoremharness.com/mcp` in the plugin
source and reinstalled. The installed cache is not source truth.

## Continuation Update

### CommonPlace Console

PR: <https://github.com/Travis-Gilbert/CommonPlace/pull/128>

Merged commit:
`9988fa318e53a1fc0dce9f4d9db693ee55ccf680`

Railway deployment:
`5377c3a4-b9c7-4f1a-9859-7a964928eeb4`

Status: `SUCCESS`

The continuation completed the production fail-closed data URL guard, corrected
consumer GraphQL routing, and implemented the full MCP lifecycle:

- initialize with protocol negotiation
- exact `Mcp-Session-Id` capture
- initialized notification
- tool request
- exact SSE event correlation
- session DELETE

The changed slice passed 68 Vitest files and 291 tests, Console TypeScript,
changed-file lint, import fences, production build, Railway node tests, and peer
review.

The two explicit ACP WebSocket overrides were removed from Railway without
triggering a deploy:

```text
THEOREM_ACP_WS_URL
NEXT_PUBLIC_COMMONPLACE_ACP_WS_URL
```

They pointed at a Harness API path that returns 404. The Console now derives the
ACP endpoint from the valid `THEOREM_NODE_URL`.

The remaining Console variables were checked by name without printing secret
values. Railway references such as
`${{commonplace-api.COMMONPLACE_API_KEY}}` are intentional service references,
not literal secret values.

### Authenticated Console Checks

The deployed Console session is authenticated as `Travis-Gilbert`.

- `GET /api/objects/views` returned 200.
- Read-only `POST /api/objects/query` returned 200 with an empty result.
- `/api/objects` itself is not a route and correctly returned 404.
- The Models route rendered, but
  `/api/observed-model?topicId=topic-evidence-research-surfaces` returned 502
  because the Harness-to-store gRPC call failed with `h2 protocol error`.

### RustyRed h2c Repair

PR: <https://github.com/Travis-Gilbert/Theorem/pull/331>

Merged commit:
`5b9597a64d12aacbf397890b13fcbcb559dc3a6d`

The server now enables Axum's HTTP/2 feature. A production-composed test proved
that the mixed Axum router accepts a real prior-knowledge h2c gRPC unary request
on the same listener.

The first deployment of that merge exposed an unrelated current-main compile
error: the sole core `Shape` initializer was missing the new
`column_contract` field.

PR: <https://github.com/Travis-Gilbert/Theorem/pull/335>

Merged commit:
`d34e5e2d016e9261f9fb65a6a59e53325b9782c0`

The core operation shapes are JSON/non-tabular, so the initializer now sets
`column_contract: None`. Focused Cargo check, formatting, diff validation, and
peer review passed.

Railway built and pushed repaired commit `d34e5e2d` successfully, but marked both
deployments `REMOVED` before promotion because newer `main` revisions had
entered the auto-deploy queue. Multiple later commits were verified as
descendants of both repairs. The latest verified descendant during this session
was `f7556f44ea0c6827300c9d308eb5ebe38f4e24f6`, deployment
`90bf7c72-e68f-41d6-a8c7-b3f2de7fa4b2`, still `BUILDING` when newer revisions
again entered the queue.

### commonplace-api Durability

Service:
`ffb2cdab-b0be-4ea3-b249-64dd2a941a08`

Verified without printing secret values:

- `COMMONPLACE_DATA_DIR=/data`
- `COMMONPLACE_SERVICE_ALLOWED_TENANTS=Travis-Gilbert`
- `COMMONPLACE_API_KEY` is present
- `PORT` is present

The source still falls back to `dev-key` when the API key is absent. A
production fail-closed API-key guard remains separate hardening work.

## Remaining Tasks

### 1. Complete live Models acceptance after Railway promotes a repaired descendant

Require all of:

- the serving RustyRed commit is a descendant of `d34e5e2d`
- the exact MCP initialize/ready/tool/DELETE probe succeeds
- the `graphql_query` result contains `observedModel` without an h2 error
- authenticated `/api/observed-model?topicId=...` returns 200
- the Models page renders without the generic degradation state

Do not accept a healthy old deployment or a merely completed/removed image.

### 2. Exercise production mutations only with a disposable topic

With an explicitly disposable topic and admitted tenant, verify `pinObserved`,
`declaredModel`, `compileDeclaredModel`, `proposeSchemaChange`, and
`unpinDeclared`, including durable receipts and SchemaVersion changes.

### 3. Decide the remaining direct GraphQL adapters

The consumer GraphQL endpoint is live and authenticated, but its schema still
lacks `fileItem`, `upsertFilingRule`, and `setFilingRuleConsent`. For
Proactivity and Filing, either add the fields to the typed Harness schema and
route them through MCP, or keep them on the consumer API and document that
contract explicitly.

### 4. Optional capabilities and hardening

- Add `THEOREM_PROACTIVITY_CHANGEFEED_URL` only when a real producer exists.
- Add `CONSOLE_HARNESS_ROOM` or workspace allowed roots only when their intended
  production values are known.
- Make commonplace-api reject a missing API key when `PORT` is set.
- Update and reinstall the Theorems Harness plugin source if operator probes
  should use `https://api.theoremharness.com/mcp`.

## Unrelated Deployment State

- `rustyred-store` has a newer build still marked `BUILDING`, while its previous
  deployment remains healthy and serving.
- `harness-console` had a failed new deployment but its previous deployment is
  still healthy. That is the separate `theoremharness.com` app, not the
  CommonPlace Console at `v2.theoremharness.com`.

Keep these separate from the Models/MCP acceptance result.

## Permission and Tooling Note

The recurring pauses in the originating Codex session came from two separate
layers:

1. The thread ran under a managed filesystem and network sandbox even though
   the UI setting said full access. Networked CLI calls therefore requested
   escalation.
2. The Railway MCP connector cached an expired token and sometimes took several
   minutes to return `Unauthorized`, even after Railway was reauthorized.

The Railway CLI did use the renewed credential successfully. Prefer the CLI for
this continuation and avoid retrying the stale Railway connector.

Useful read-only commands:

```sh
railway service list \
  --project d63e07ef-eef1-4111-aa06-6eb9c1188560 \
  --environment 62458b07-0e29-46d5-bbab-ec3ee87bc960 \
  --json

railway deployment list \
  --project d63e07ef-eef1-4111-aa06-6eb9c1188560 \
  --environment 62458b07-0e29-46d5-bbab-ec3ee87bc960 \
  --service 664f84b2-d56d-4a75-b135-cc4680e5464a \
  --limit 5 \
  --json
```

Avoid broad environment dumps. Read only named non-secret URLs or test secret
presence without printing the value.
