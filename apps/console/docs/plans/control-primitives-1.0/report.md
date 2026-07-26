# SPEC-THEOREM-CONTROL-PRIMITIVES-1.0 report

## Not done (lead with gaps)

- **Theorem sibling absent.** `Travis-Gilbert/Theorem` / `rustyredcore_THG` is not in this environment. There is no `graph_store.rs`, no append-log commit seam, no `graph_lisp_promote.rs`, no `plan_substrate.rs` (265 KB), and no `apps/theorem-federation` signing to reuse.
- **CP1 GraphStore emission not wired.** Event plane logic and reopenable log exist in `crates/control-primitives`, but nothing emits from a real graph commit.
- **CP2 federation signing not reused.** Delivery uses HMAC-SHA256 as a stand-in; Ed25519 / federation signing is not integrated.
- **CP4/CP5/CP6 not folded into Theorem MCP.** Programs, object types, and views are covered by a shared revisable suite in the portable crate only. `plan_validate` is a portable validator, not an extension of the live `plan_substrate.rs`.
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
