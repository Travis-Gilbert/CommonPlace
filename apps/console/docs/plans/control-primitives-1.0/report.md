# SPEC-THEOREM-CONTROL-PRIMITIVES-1.0 report

## Not done (lead with gaps)

- **Theorem is private and not in the Cursor GitHub App installation.**
  `GET https://api.github.com/repos/Travis-Gilbert/Theorem` returns 404 for this
  agent's token. Installation repositories: `total_count: 1` → only
  `Travis-Gilbert/CommonPlace`. Clone, cargo git dep fetch, and Dockerfile-style
  sibling checkout all fail with `Repository not found`.
- **Unblocks the rest:** add `Travis-Gilbert/Theorem` to the Cursor GitHub App
  repository access (or start a cloud agent scoped to Theorem), then re-run
  `patches/theorem-control-primitives/apply.sh /Theorem` and complete
  `INTEGRATION.md`.
- **CP1 GraphStore emission not wired.** Event plane logic exists; no live
  `graph_store.rs` commit seam is readable to instrument.
- **CP2 federation signing not reused.** HMAC-SHA256 stand-in only.
- **CP4/CP5/CP6 not folded into Theorem MCP / `plan_substrate.rs`.**
- **Plan substrate retrofit for Revisable** correctly left closed (anti-scope).

## Done in this pass

| Deliverable | Location | Acceptance coverage |
|-------------|----------|---------------------|
| CP1 Event plane | `crates/control-primitives/src/events.rs`, `event_log.rs` | Compile/round-trip, record + metadata, wildcards, reopen, no payloads |
| CP2 Webhooks | `crates/control-primitives/src/webhooks.rs` | Mixed planes, wildcards, restart, backoff/dead-letter, delete stops delivery |
| CP3 Navigation (Rust) | `crates/control-primitives/src/navigation.rs` | Declare/retire, scope, reorder, folder cascade, layout capability |
| CP3 Navigation (console) | `apps/console/src/lib/navigationRegistry.ts`, `/api/navigation`, sidebar Objects wiring, pin/unpin generation rule | Declared types appear as nav data without a sidebar code change |
| CP4 Revisable | `crates/control-primitives/src/revisable.rs` | Shared suite for program / object type / view |
| CP5 Step schema | `crates/control-primitives/src/step_schema.rs` | find_many shape, code cell type, unknown affordance |
| CP6 Available paths | `crates/control-primitives/src/plan_validate.rs` | Reachable upstream paths, unknown contributes none, compact mutation summary |

Theorem path mirrors: `patches/theorem-control-primitives/` (see README there).

## Verify First results

1. GraphStore commit seam: **not readable** (no Theorem tree).
2. Append log event shape: **not readable**; portable `EventLog` prepared for extension, not a parallel product stream.
3. `graph_lisp_promote` / ensemble versions: **not readable**; `Revisable` generalized from the spec + Twenty pattern.
4. Federation signing: **not readable**; HMAC stand-in documented.
5. `plan_substrate.rs`: **not readable**; portable `plan_validate` is the CP6 shape to fold in later.
6. Affordance manifest output: assumed optional; unknown when missing (CP5).
7. Console sidebar: shell Objects section was prop-driven and empty by default; now sources `nav-item` host objects / `/api/navigation`.

## Tests

```bash
cd crates/control-primitives && cargo test   # 31 passed
cd apps/console && npx vitest run src/lib/navigationRegistry.test.ts
```
