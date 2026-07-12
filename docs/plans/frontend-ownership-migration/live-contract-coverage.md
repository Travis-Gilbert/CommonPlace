# FO-010 Live Contract Coverage

Status: in progress

This ledger records the production contract for each CommonPlace surface that consumes Theorem. A surface is not covered merely because its route returns HTTP 200. It must use typed live data, authenticate the product caller, preserve the tenant boundary, expose honest empty and unavailable states, and return a durable acknowledgement for writes.

## Operator Slice

The first FO-010 slice covers `/api/theorem/operator`.

| Concern | Contract | Local oracle |
|---|---|---|
| Product caller auth | Owner session or timing-safe `THEOREM_OPERATOR_API_TOKEN` bearer check; bearer access fails closed without a unique canonical `THEOREM_OPERATOR_CREDENTIAL_ID`, which becomes the audit actor without persisting token material | Unauthenticated GET returns 401 before any upstream call; bearer-only, missing-credential-id, and session-unavailable recovery tests pass |
| Harness auth | Server-only `THEOREM_MCP_AUTH_TOKEN`, `THEOREM_API_TOKEN`, or `HARNESS_API_KEY` | MCP request carries the bearer token; production refuses missing token |
| Tenant | Tenant comes from the token-bound MCP principal; CommonPlace requires `workGraph.run.tenant_slug` to match `THEOREM_TENANT_SLUG` and rejects a conflicting mutation acknowledgement | Cross-tenant work graph returns 503; cross-tenant claim acknowledgement returns 502 `tenant_mismatch` |
| Read | Run-scoped `workGraph(runId: String!)` through MCP `graphql_query`; returned run and every task must match the requested run | Typed task mapping, malformed/cross-run rejection, and route-level MCP request assertions |
| Heads and bays | Explicit `THEOREM_OPERATOR_HEADS` or `THEOREM_AGENT_HEADS` configuration plus owners of live claims | No operational head registry is borrowed from the fixture builder |
| Empty state | A successful work graph with zero tasks returns a live empty board | Route returns 200, `source.mode=live`, empty task/gate/drawer sections, and no fixture ids |
| Unavailable state | Missing run configuration, missing production token, upstream failure, or invalid GraphQL response never falls back to fixture data | Route returns typed 503 with tenant and request id |
| Task claim | `claimTaskNode` through MCP `graphql_mutate`, using the durable task claim epoch, followed by a caller audit record | Acknowledgement must echo tenant, task, run, owner, and epoch; the exact audit graph node and a follow-up `workGraph` read must match before receipt `verified=true`; receipt id is `claim:<run>:<task>:<epoch>` and `auditId` names the durable caller record |
| Room message | `publishCoordinationEvent` through MCP `graphql_mutate` | Acknowledgement must name the requested stream and ordering token, then an exact `graphNode(id:)` query must return the same event id, actor, kind, task, run, and message before receipt `verified=true` |
| Request correlation | Incoming `x-request-id` is preserved; otherwise the route generates one | Response header, live contract metadata, errors, and receipts share the request id |

The deterministic Operator builder remains available for tests and the explicit `/v2/operator/story` design fixture. It is no longer reachable through the production API route.

## Honest Gaps

The Operator route rejects these actions with 501 `mutation_not_implemented` because the Harness GraphQL schema does not currently expose a durable operation for them:

- queue priority reorder;
- gate pass; and
- gate bounce.

Those controls must remain disabled or visibly error until the backend exposes typed mutations with durable acknowledgements. Returning the prior success-shaped local messages would violate FO-010.

The broader FO-010 gate remains open:

| Surface | Current finding | Required closeout |
|---|---|---|
| `/api/theorem/control-center` | Product caller auth exists, but the live builder still mixes fixture sections and can synthesize local action receipts | Replace each user-reachable fixture section with live, empty, blocked, or unavailable state; require durable receipts for writes |
| `/api/theorem/agent` | Uses live upstreams and honest 502/504 errors | Add product caller auth, prove token-bound tenant propagation, and verify returned run/receipt ids |
| `/api/theorem/graphql` | Server-side CommonPlace object GraphQL proxy with upstream API-key auth | Prove product caller authorization, tenant isolation, representative reads and mutations, and remove the development 200 soft-fail from production acceptance |
| Ported memory, skills, runs, inbox, tasks, and administration views | Not yet all registered or live | Add each surface to this ledger as FO-020 through FO-025 land |

## Validation

Local proof for this slice:

```text
pnpm --filter @commonplace/web test --run src/app/api/theorem/operator/route.test.ts src/lib/theorem-operator-live.test.ts
pnpm --filter @commonplace/web test --run
pnpm --filter @commonplace/web exec tsc --noEmit
pnpm --filter @commonplace/web exec eslint src/app/api/theorem/operator/route.ts src/app/api/theorem/operator/route.test.ts src/lib/theorem-operator.ts src/lib/theorem-operator-live.ts src/lib/theorem-operator-live.test.ts
pnpm --filter @commonplace/web build
```

Latest local result: 24 focused tests and 517 full web tests passed; TypeScript, scoped ESLint, production Next build, Pagefind, and `git diff --check` passed. The build retains the pre-existing Turbopack NFT tracing and Jotai `atomFamily` deprecation warnings.

FO-010 cannot become complete until an authenticated staging candidate passes schema introspection, representative reads and writes, tenant-isolation attempts, and receipt query-back for every ported surface.
