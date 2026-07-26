# Theorem integration checklist (CP1–CP6)

Copy this file into a Theorem checkout via `apply.sh`. Complete each seam against the live tree.

## Access prerequisite

The CommonPlace cloud agent GitHub App installation currently lists **only**
`Travis-Gilbert/CommonPlace`. Until `Travis-Gilbert/Theorem` is added to that
installation (or a Theorem-scoped agent is started), GraphStore / MCP wiring
cannot be executed or tested here.

## CP1 — Event plane

Files installed:

- `rustyred-thg-core/src/events.rs`
- `rustyred-thg-core/src/event_log.rs`

Tasks:

1. Add `pub mod events;` and `pub mod event_log;` to `rustyred-thg-core/src/lib.rs`.
2. Find the **single** commit seam in `graph_store.rs` (Verify First: one emission point).
3. After a successful commit, append one `EventEnvelope` per affected object write via
   `record_write_event(...)`, and one metadata event for schema verbs via
   `schema_declare_event(...)`.
4. Persist through the existing append log (extend it; do not add a parallel stream).
5. Events carry tenant, actor, principal, graph version before/after, node ids.
   **No payloads.**

Acceptance: record write emits exactly one compiled event; `schema_declare` emits
`metadata.object_type.created`; wildcards match; events survive reopen; no record content.

## CP2 — Webhooks

File installed: `rustyred-thg-mcp/src/webhooks.rs`

Tasks:

1. Register MCP verbs: `webhook_list`, `webhook_create`, `webhook_update`, `webhook_delete`.
2. Replace HMAC stand-in with signing from `apps/theorem-federation` (Ed25519 / existing scheme).
3. Subscribe over the CP1 event stream only (never a second source of truth).
4. At-least-once delivery, exponential backoff, dead-letter node, auto-disable after budget.

## CP3 — Navigation

File installed: `rustyred-thg-mcp/src/navigation.rs`

Tasks:

1. Register navigation MCP verbs as needed by the console.
2. On `schema_declare`, call `NavigationRegistry::on_schema_declare`.
3. On `schema_retire`, call `on_schema_retire`.
4. CommonPlace console already consumes `/api/navigation` + `nav-item` host objects;
   point those at Theorem MCP when the sibling is live.

## CP4 — Revisable

File installed: `rustyred-thg-core/src/revisable.rs`

Tasks:

1. Retrofit programs (`graph_lisp_promote.rs`), object types, and views onto `Revisable`.
2. Do **not** open the plan substrate for Revisable in this pass.
3. Keep one shared test suite for the three kinds.

## CP5 / CP6 — Step schema + validation paths

Files installed:

- `rustyred-thg-mcp/src/step_schema.rs`
- `rustyred-thg-mcp/src/plan_validate.rs`

Tasks:

1. Fold `plan_validate` into the existing `plan_substrate.rs` validator (do not add a second validator).
2. Expose `available_paths` beside errors/warnings.
3. Individual task mutations return `mutation_summary`, not a full report.
4. Unknown step schemas contribute **no** fabricated paths.

## Suggested verification commands (in Theorem)

```bash
cargo test -p rustyred-thg-core --events
cargo test -p rustyred-thg-mcp --webhooks
cargo test -p rustyred-thg-mcp --navigation
cargo test -p rustyred-thg-core --revisable
cargo test -p rustyred-thg-mcp --step_schema
cargo test -p rustyred-thg-mcp -- plan_validate
```
