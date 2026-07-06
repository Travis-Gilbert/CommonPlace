# API topology — the one map an agent should read before touching data flow

Status: authoritative map, 2026-07-06. If you are about to ask "which API does the
frontend call / where does agent-written state live / MCP vs HTTP", read this first.

## The one-paragraph answer

There is **one store** and **one canonical GraphQL API**. The store is
`rustyred-thg-core` (THG/RustyRed). The canonical API is **`commonplace-api`**
(`Theorem/apps/commonplace-api`) — a standalone async-graphql **HTTP** server
(`serve.rs` mounts `POST /graphql`, `x-api-key` auth, GraphiQL at `GET /graphql`).
Its manifest calls it *"the universal connection point so any front end talks to
the database with one API."* The **MCP** (`rustyred-thg-mcp`) is a **transport for
agents**, not a second database: it carries `graphql_query` / `graphql_mutate`
tool-calls onto the **same store**. Two doors, one store — so what an agent writes
through the MCP is readable by the site through `commonplace-api`.

```
Agents ──tools/call──▶ rustyred-thg-mcp ──┐
                                           ├──▶ rustyred-thg-core  (ONE store)
Web (apps/web) ──HTTP /graphql──▶ commonplace-api ──┘
```

## Three layers — keep them separate

| Layer | What | Where |
|---|---|---|
| **Store** | where data actually lives | `rustyred-thg-core` (THG) — one substrate |
| **Schema** | the GraphQL contract over the store | `commonplace-api/src/schema.rs` (`Query<S,B>`/`Mutation<S,B>`) |
| **Transport** | how a client reaches the schema | agents → MCP `tools/call`; site → HTTP `POST /graphql` |

The MCP is **transport, not schema**. Unifying the schema does not touch the MCP's
agent-communication job. Do not "merge the MCP into the object model" — there is
nothing to merge; the MCP is a door.

## The canonical API: what `commonplace-api` serves today

Schema: `apps/commonplace-api/src/schema.rs`, `Query<S,B>` where
`S: EmbeddingGraphStore` (the shared store), `B: BlobStore`. Every resolver does
`principal(ctx)?` (auth) → `shared::<S,B>(ctx)?` (one store handle) → store calls.

**Live today (block contract + retrieval + agent):**
- Object/block model: `item`, `items`, `items_as_of`, `item_edges`, `type_defs`,
  `view_query`, `collection(s)`, `collection_items` — the modular Set/BlockHost contract.
- Retrieval / product: `search`, `ask`, `briefing`, `discover`, `organize`, `export`.
- Agent: `theorem_agent`.
- Mutations: `ingest`, `put_note`, `edit_item`, `mark_edge_contradicted`,
  `put_type_def`, `put_view_query`, collection CRUD, `import_items`.

**NOT yet exposed here (the migration add):** the harness read/write domains —
`workGraph`, `memory`, `skills`, `runs`, `coordination`. These currently live only
in the MCP schema (`rustyred-thg-mcp/src/graphql/*`). But `commonplace-api` already
depends on `theorem-harness-core` + `theorem-harness-runtime`, so surfacing them is
a **resolver-add on the existing `Query`/`Mutation`** (same `shared::<S,B>(ctx)`
store handle → delegate to `theorem-harness-runtime`), **not new plumbing**.

## Frontend rule (apps/web)

- **Read/write the canonical API over HTTP** via the same-origin proxy
  `apps/web/src/app/api/theorem/graphql/route.ts` → `THEOREM_GRAPHQL_URL`
  (commonplace-api) + server-only `THEOREM_API_KEY` (`x-api-key`). Soft-fails to
  fixtures in dev.
- **Do NOT call the MCP from the browser.** `callMcpTool('graphql_query')` (in
  `theorem-control-center.ts`, and my `theorem-operator-live.ts`) routes the web app
  through the agent transport. It hits the right schema/store so it *works*, but it
  is the wrong door and is being retired. New surfaces POST GraphQL to the proxy.

## Migration mapping (harness-console → apps/web /v2)

The old console surfaces read from the harness domains; once those are on
`commonplace-api`, the /v2 surfaces read them via the proxy:

| Surface | Domain to add to commonplace-api | Notes |
|---|---|---|
| Operator | `workGraph` (typed TaskNode) | today via `callMcpTool` → switch to proxy |
| Account/Agents → Memory | `memory` / `memoryDoc` | |
| Account/Agents → Skills | `skills` (`skillList`/`skillGet`) | |
| Account/Agents → Runs | `runs` / `harnessRun` | |
| Workrooms / drawer | `coordination` (`coordinationStream`, `roomDigest`, `openPings`) | |
| Account/Agents → Keys/Providers/Usage | may need a backend data model, not just a resolver | were frontend-mock in the console |
| Account/User | identity / connections | |
| Inbox | — | corresponds to Index; not ported |

## The self-describing rule (so no agent has to spelunk this again)

1. **SDL is the map.** `commonplace-api` should emit its schema as
   `apps/commonplace-api/schema.graphql` (async-graphql `schema.sdl()`), with a CI
   drift test that fails if code and SDL disagree. Then "what does the API expose"
   is one checked-in file.
2. **Codegen the frontend from the SDL.** GraphQL-codegen → typed operations in
   `apps/web`. This also retires hand-mirrors like `theorem-harness-schema.ts`
   (which exists only because `workGraph.tasks` was opaque `Json`).
3. **This doc + a pointer from `AGENTS.md`/`codemap.md`** + a harness memory atom.
4. **Drift gate** keeps 1–3 honest.

The unification and the discoverability are the same work: pull the harness domains
onto `commonplace-api`, emit the SDL, generate the client, delete the hand-mirrors.
