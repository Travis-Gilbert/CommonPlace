# SPEC-HARNESS-UX-1.0 Report

Date: 2026-07-20

## Surface follow-up (after [Implement console S1 S2 U6](88638d0a-9d5c-414c-a75f-9275c83b3b09))

Aligned CommonPlace adapters to the shipped Theorem doors:

- GraphQL `status` / `why` now pass `$scope` / `$target` as JSON variables (backend fields take `Json`).
- Boot route calls flat `boot` (no GraphQL boot field); falls back to status digest.
- `normalizeBootPayload` accepts flat boot markdown payloads that omit `degradation`.
- Cost `per_run` accepts snake_case `run_id`.

Backend doors are no longer the blocker for S1/S2/U6-ACP adapter wiring.

## Lead: what is not done or not fully verified

- Pinning (`pin_product_verbs`) defaults **off** for catalog-compat with existing MCP tests. Product sessions must set `pin_product_verbs: true` (same pattern as `graphql_default_surface`). Acceptance "fresh session shows exactly pinned set" is therefore **config-gated**, not the Default impl.
- Streamed Anthropic responses do not yet tee usage into cost receipts (non-stream JSON path only). `status.degradation` names `cost_capture` when no receipts exist.
- Assembled-window heads: no duplicate-injection guard coded beyond the existing window assembler exclusion note; ACP stores `bootBrief` on state (host must inject; no ACP context wire yet).
- Codex AGENTS.md carriage for boot is not a separate file edit in this pass; Claude Code SessionStart was extended in `session_start.sh`, plus standalone `session_boot.sh`.
- Live end-to-end against a running MCP with fixture tenant (two runs, proposal, mention, receipts) was **not** run in this session.
- CI assertion that every `next_call` parses against live tool schemas is **not** wired as a CI job yet (unit registry coverage exists).

## Verify-first (V1-V9)

| ID | Confirmed |
|----|-----------|
| V1 | `turn_start_payload`, `harness_prepare_payload`, `harness_replay_payload`, `harness_run_payload` in `rustyred-thg-mcp`. `harness_run` is a real flat tool. |
| V2 | No prior Remedy registry; created in `theorem-harness-core/src/refusal.rs`. |
| V3 | Proxy capture added for non-stream JSON; durable `CostReceipt` + `PriceTable` in `cost_receipts.rs`. |
| V4 | Pin filter in `ux_front_door::filter_pinned_tools`; `tool_search` remains the gateway. |
| V5 | GraphQL `status` / `why` via `graphql/ux.rs` merged into `QueryRoot`. |
| V6 | SessionStart extended in `hooks/session_start.sh`; sibling `hooks/session_boot.sh`. |
| V7 | ACP `session-manager` loads boot after `newSession` into `bootBrief`. |
| V8 | Fractions from plan `inspect` progress (`done`/`total`), not invented aggregates. |
| V9 | Exact flat `status`/`why`/`boot` and GraphQL root `status`/`why` were free; soft collisions with `context_status` / `Node.why` remain distinct. |

## Deliverables

| ID | Status | How verified |
|----|--------|--------------|
| U4 Remedy registry | Shipped | `cargo test -p theorem-harness-core --lib` (298 ok, includes refusal tests) |
| U2 status dual-door | Shipped (composition) | Flat `status` + GraphQL `status`; `ux_front_door` unit tests (5 ok) |
| U3 why dual-door | Shipped (router) | Flat `why` + GraphQL `why`; routes to existing explainers; unknown target refuses |
| U5 cost receipts | Partial | Non-stream proxy capture + price table + rollups; stream path not captured |
| U1 verb pinning | Shipped (gated) | Tools + stubs + filter; enable via `pin_product_verbs: true` |
| U6 session boot | Partial | Hook + ACP bootBrief + flat `boot` tool; Codex AGENTS.md not separately updated |
| S1 Status panel | Shipped (console) | CommonPlace StatusPanel + API route; 155 console tests passed |
| S2 Why/remedy | Shipped (console) | WhyTracePanel + RemedyCard; copyable next_call |

## Key paths

### Theorem
- `rustyredcore_THG/crates/theorem-harness-core/src/refusal.rs`
- `rustyredcore_THG/crates/theorem-harness-core/src/cost_receipts.rs`
- `rustyredcore_THG/crates/rustyred-thg-mcp/src/ux_front_door.rs`
- `rustyredcore_THG/crates/rustyred-thg-mcp/src/graphql/ux.rs`
- `rustyredcore_THG/crates/theorem-agentd/src/cost_capture.rs`
- `rustyredcore_THG/hooks/session_start.sh`
- `rustyredcore_THG/hooks/session_boot.sh`

### CommonPlace
- `apps/console/src/views/harness-ux/*`
- `apps/console/src/app/api/harness/{status,why,boot}/route.ts`
- `packages/theorem-acp/src/session-boot.ts`
- `docs/plans/harness-ux-1.0/implementation-plan.md`
