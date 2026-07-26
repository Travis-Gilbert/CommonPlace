# Theorem control primitives patch (CP1–CP6)

Portable sources for SPEC-THEOREM-CONTROL-PRIMITIVES-1.0.

## Apply into Theorem

```bash
./patches/theorem-control-primitives/apply.sh /path/to/Theorem
```

Then follow `INTEGRATION.md` (copied to `CONTROL-PRIMITIVES-INTEGRATION.md`).

## Why this tree exists

`Travis-Gilbert/Theorem` is private. The Cursor GitHub App installation for this
agent currently includes only `Travis-Gilbert/CommonPlace`, so the sibling
checkout cannot be cloned here. The executable logic lives in
`crates/control-primitives` and is mirrored here at the paths the spec names:

| Spec path | Patch path |
|-----------|------------|
| `rustyred-thg-core/src/events.rs` | `rustyred-thg-core/src/events.rs` |
| `rustyred-thg-core/src/revisable.rs` | `rustyred-thg-core/src/revisable.rs` |
| `rustyred-thg-mcp/src/webhooks.rs` | `rustyred-thg-mcp/src/webhooks.rs` |
| `rustyred-thg-mcp/src/navigation.rs` | `rustyred-thg-mcp/src/navigation.rs` |
| `rustyred-thg-mcp/src/step_schema.rs` | `rustyred-thg-mcp/src/step_schema.rs` |
| `rustyred-thg-mcp/src/plan_substrate.rs` (extend) | `rustyred-thg-mcp/src/plan_validate.rs` |

## Integration still required in Theorem

1. Emit `EventEnvelope` from the single `GraphStore` commit seam (CP1).
2. Persist events on the existing append log; do not add a parallel stream.
3. Reuse federation signing from `apps/theorem-federation` for webhook delivery (CP2 currently uses HMAC-SHA256 as a stand-in).
4. Call `NavigationRegistry::on_schema_declare` / `on_schema_retire` from schema registry verbs (CP3).
5. Retrofit programs, object types, and views onto `Revisable` (CP4); leave plans alone this pass.
6. Wire `compute_step_output_schema` and `validate_plan` into MCP verbs; fold `plan_validate` into the existing `plan_substrate.rs` validator rather than adding a second one (CP5/CP6).

