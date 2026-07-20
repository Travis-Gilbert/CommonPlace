# Search stack implementation plan

Sources: `SPEC-COMMONPLACE-SEARCH-STACK-1.0` (B1-B8, F1-F5), `HANDOFF-SEARCH-CONSTELLATION` (D1-D5).
`HANDOFF-CONSOLE-IA` is a verification oracle only; it is already implemented in `apps/console` and is not built here.

## Repo split

| Layer | Repo | Path |
|---|---|---|
| Trigram index + spine | Theorem | `rustyredcore_THG/crates/rustyred-thg-core/src/index/` |
| Find executor (lanes, compose, classify, scatter, constellation) | Theorem | `rustyredcore_THG/crates/rustyred-thg-find` (new) |
| Web lane impl + PPR frontier | Theorem | `rustyredcore_THG/crates/rustyred-web` |
| Affordance registration | Theorem | `crates/theorem-harness-core/src/affordances.rs`, `crates/rustyred-thg-mcp/src/connector_gateway.rs` |
| MCP tools | Theorem | `rustyredcore_THG/crates/rustyred-thg-mcp` |
| GraphQL surface | CommonPlace | `apps/commonplace-api/src/schema/` |
| Shared TS contracts | CommonPlace | `packages/block-view-contracts/src/` |
| User surfaces | CommonPlace | `apps/web/src/components/commonplace/` |

Theorem branch: `claude/search-stack-impl`. CommonPlace branch: `claude/search-stack-impl-dcddc3`.

## Corrections to spec assumptions (verified against source)

1. `rustyred-thg-core/src/` is flat; there is no `index/` directory. The spec path `src/index/trigram.rs` is honored by creating the `index` module.
2. `NodeId` exists only in `rustyred-thg-geotemporal` as `pub type NodeId = String`. `EdgeRef` does not exist anywhere. Both are defined in `rustyred-thg-find`.
3. The `time_series` registration named by the spec is a `RustyRedPlugin` impl in geotemporal that re-exports `TimeSeriesAccessMethod` (defined in core). The trigram index follows that exact shape.
4. `compute_offload.route_operation` is an affordance-id string in the `STATIC_AFFORDANCES` table plus a dispatch fork in `connector_gateway.rs`, not a Rust function. The composed find registers the same way.
5. MMR already exists: `rustyred-membrane::gate::fill_to_budget` with `ScoreContext::with_mmr_lambda`. It is bound, not reimplemented.
6. `PprPrioritizer` already exists in `rustyred-web/src/frontier/prioritizer.rs` implementing the `Prioritizer` trait. B6 renames the seam to the spec's `FrontierScorer`/`PprFrontier` names, fixes the per-node full-recompute, and makes pop order follow scorer output.
7. `memchr` and `aho-corasick` are lock-only transitives (2.8.3 / 1.1.4). They become direct deps at those versions.
8. `web_consume_to_graph` exists at `rustyred-web/src/browser_engine.rs:518`.
9. DATAWAVE `intersect` is a posting-list AND over one `TieredIndex`, not a record-to-record field-fact intersect. D1 builds the record-pair intersect on top of `TieredIndex::event_keys` + `intersect`.
10. `apps/browser` in Theorem is a chrome-free Servo embedder. The live browser chrome is `apps/web` at `/commonplace` (co-browse stage), backed by Tauri webviews. F1/F4 land there.
11. In-page anchoring in CommonPlace is character-offset with prefix/suffix (`crates/commonplace-desktop-runtime/src/margin_recall.rs`), not byte ranges. F1 converts byte ranges to text targets at the seam.

## Checklist

See `checklist.json` in this directory. Reconciled at close.
