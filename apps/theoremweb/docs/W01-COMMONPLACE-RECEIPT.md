# W01 (CommonPlace half): receipt

Plan `THEOREMWEB-SURFACE-COMPLETION-1.0`, generation 1. Obligation `O01`.
Head: `claude-code`. Repo: CommonPlace. Branch: `codex/theoremweb-surface-frontend-1.0`.

W01's scope spans two repositories. This receipt covers the CommonPlace half
only. The Theorem half is `codex`'s, per branch `codex/theoremweb-surface-backend-1.0`.

## Blueprint coverage

| Step | State | Evidence |
|---|---|---|
| 1. Root Dioxus manifest and entrypoint at the exact version | done | `apps/theoremweb/Cargo.toml` workspace + `theoremweb-host`; `dioxus = "=0.7.10"` per D02 |
| 2. Expose the backend registry through one versioned wire fixture/API | not started, Theorem-side | `surface_tools.rs` declares no body tool |
| 3. Replace the hardcoded CommonPlace BodySpec list with the canonical client seam | done | `BodyRegistry::initial()` deleted; `from_canonical` is the only admitting constructor |
| 4. Seed the seven rows idempotently; omnibox/history through graph-resolved SurfaceSpec + ScopeBinding | done | `src/seed.rs`, `Boot::exercise`, 7 rows per TW1 |
| 5. Label unknown variants without destructive fallback | done | unknown renderer keeps its row and label; unregistered body renders a labeled placeholder |

## Proof

```
cargo test --manifest-path apps/theoremweb/Cargo.toml --workspace
  82 passed, 0 failed, 1 pre-existing ignored
cargo check --target wasm32-unknown-unknown -p theoremweb-host --bin theoremweb
  Finished, 0 errors
cargo run --bin theoremweb -- oracles/fixtures/registry-contract-expected.json
  7 surfaces, 10 canonical bodies, 0 missing seed ids, registry_source=canonical-document
node oracles/host-registry-live.cjs
  phase=offline-contract, passes, and states it cannot discharge V01
```

## Defects found and fixed

1. **BodySpec authority was a three-way split.** `record_table` default size was
   240x160 in `theorem-body-registry`, 480x320 in the backend's own
   `fixtures/theoremweb-surface-v1.json`, and 640x360 in CommonPlace's
   `BodyRegistry::initial()`. Icons diverged on 6 of 10 kinds. Fixed on this
   side by removing CommonPlace as an opinion. The remaining two-way backend
   divergence is Codex's call.
2. **The two `theoremweb-surface-v1.json` files diverged in shape.** Theorem's
   (`sha256 17c8540682e70357db1e4ac56bb5238dff89f2ba33ba29326b21875a3643a14b`)
   carries `surface`, `scope`, `layout`, `body`. CommonPlace's
   (`sha256 4ac648b06834e54cf768d2e3d7ea9fbec52055a26ec9396137132f5d0d378df0`)
   carries only `surface` and `scope`. Same filename, same version string.
3. **`agent_thread` is not a canonical body kind.** `SurfaceCatalog::resolve`
   routed every question intent to it. The spec fixes the set as fields,
   related_records, record_table, thread, document, chart, timeline, iframe,
   sub_canvas, log. Against canonical rows every question intent would have
   returned `MissingBody("agent_thread")`. The duplicate registry was masking
   the bug. Routed to `thread`.
4. **Three crates were orphans.** `layout`, `canvas-gallery`, and
   `agent-runtime` were linked by nothing: `app` depends only on `chrome`,
   `navigation`, and `record-table`. Now workspace members reachable from the
   host.

## Decision recorded here

**`model` surface body kind.** TW1 names the row but not its body, and the
canonical set has no schema/model kind. Chose `fields`. Reversibility:
`reversible`. Retraction: one record write changes the body kind with no
recompile, which is TW1's own acceptance criterion.

## V01: parked, not failed

Two named conditions, both Theorem-side and both witnessable:

1. `rustyredcore_THG/crates/rustyred-thg-mcp/src/surface_tools.rs`
   `tool_definitions()` declares `surface_write/get/list`,
   `scope_write/resolve`, `layout_write/get/list/resolve`. It declares no body
   tool, so `theorem-body-registry` is canonical in name and unreachable by any
   client. Verified: `grep -c body_list` returns 0.
2. The live MCP catalog reachable from this session carries no TheoremWeb
   surface tools (`tool_search` over the declared register returned zero, with
   affordance vector ranking degraded to lexical).

The oracle refuses to substitute the pinned fixture for the live document. D04
forbids it, so V01 stays pending rather than passing on fixture evidence.

## Unblocking V01

Theorem side, in Codex's scope:

1. Add `body_list` to `surface_tools.rs::tool_definitions()`, returning
   `{"bodies": [BodySpec...], "count": N}` from `theorem_body_registry`.
2. Decide which backend artifact is canonical for `BodySpec` — the crate's
   `initial_body_specs()` or `fixtures/theoremweb-surface-v1.json` — and make
   the loser derive from the winner.
3. Publish the envelope. This host expects
   `{"version": "theoremweb-surface-v1", "bodies": [...], "surfaces": [...]}`.
   A different envelope is fine; the client will match it.

Then, with `THEOREMWEB_MCP_URL` and `THEOREMWEB_AUTH_TOKEN_FILE` set:

```bash
node apps/theoremweb/oracles/host-registry-live.cjs --live --seed
node apps/theoremweb/oracles/host-registry-live.cjs --live --verify
```
