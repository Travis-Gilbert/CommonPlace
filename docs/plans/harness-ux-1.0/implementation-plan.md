# SPEC-HARNESS-UX-1.0 Implementation Plan

Source: `/Users/travisgilbert/Downloads/SPEC-HARNESS-UX-1.0.md`
Repos: Theorem (`Creative/Website/Theorem/rustyredcore_THG`) + CommonPlace (`apps/console`, `packages/theorem-acp`)

## Verify-first (V1-V9) confirmed 2026-07-20

| ID | Finding |
|----|---------|
| V1 | `turn_start_payload`, `harness_prepare_payload`, `harness_replay_payload`, `harness_run_payload` live in `rustyred-thg-mcp`. `harness_run` is a real flat poll tool. |
| V2 | No shared `Remedy` registry. Scattered refusal types. U4 creates the envelope. |
| V3 | `ModelUsage` parses tokens in `theorem-agentd`; no durable cost receipts or price table. Proxy: `theorem-agentd/src/proxy.rs`. |
| V4 | `tool_definitions` advertises full catalog. `tool_search` is federated gateway, not native deferral. U1 adds pinned-set filter. |
| V5 | GraphQL under `rustyred-thg-mcp/src/graphql/`; dual-door wraps `*_payload` fns. |
| V6 | Claude Code SessionStart: `hookSpecificOutput.additionalContext`. Codex: AGENTS.md carriage. |
| V7 | ACP `AcpSessionManager.acquire` has no boot injection yet. |
| V8 | Use `progress_counts` / `PlanProgress { done, total }`, not Canvas TaskProgress. |
| V9 | Exact flat tools `status`/`why`/`boot` and GraphQL root `status`/`why` are free. Soft collisions: `context_status`, `Node.why`. |

## Order

1. U4 Remedy registry (`theorem-harness-core`)
2. U2 status + U3 why (`rustyred-thg-mcp` `ux_front_door.rs`)
3. U5 cost receipts (proxy + rollups)
4. U1 pinning + watch/fork stubs + GraphQL fields
5. U6 boot (hooks + ACP)
6. S1 Status panel + S2 Why/remedy (console)

## Dual-door rule

One Rust composition function per verb; GraphQL field and flat MCP tool call the same function. Divergence is a bug.
