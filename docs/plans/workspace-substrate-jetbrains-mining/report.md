# Acceptance report: SPEC-WORKSPACE-SUBSTRATE-JETBRAINS-MINING-1.0

Lead with what is not done or not verified.

## Not verified this session

| Deliverable | Gap | Why |
|---|---|---|
| **B5 GraphQL HTTP** | Not re-run | `cargo test --test workspace_http_acceptance` failed while compiling `aws-lc-sys` under disk pressure; not re-attempted after cleanup. Code and prior record exist on Theorem `apps/commonplace-api`. |
| **B6 MCP tools** | Not re-run | `cargo test -p rustyred-thg-mcp workspace_tools` failed to compile: dirty WIP on Theorem `claude/filing-and-index` (`open_world_hint_for_tool` visibility inside nested test module at lib.rs ~30723). Workspace tools source and unit tests exist in `workspace_tools.rs`. |
| **Harness Plan node** | Not minted | Theorem MCP `plan create` returned upstream 502 / product errors. Markdown plan is the operational checklist. |
| **Live end-to-end against production GraphQL** | Not run | No production smoke against Railway commonplace-api from this session. Console e2e uses same-origin route mocks. |
| **Sibling Goal Stack screenshot** | Not part of F1-F4 | `goal-stack-v2-1440-dark.png` drifted (~2% pixels) when the full file was run; out of this spec's F1-F4 acceptance. |

## Verified this session

| Deliverable | Status | Evidence |
|---|---|---|
| **B1 VFS** | verified | `cargo test -p rustyred-thg-vfs --lib`: 9 passed (fixture event order, snapshot immutability, durable reopen, generation-window revert, history restore without git) |
| **B2 local history** | verified | Same suite: `three_revisions_label_and_restore_work_without_git`, restore Created for deleted paths, symlink refusal |
| **B3 workspace model** | verified | `cargo test -p rustyred-thg-workspace --lib`: `apply_is_atomic_events_are_exact_and_old_snapshot_is_immutable`, `project_membrane_boosts_inside_without_filtering_or_zeroing_outside`, `project_tree_projects_typed_roots_and_exclusions` |
| **B4 readiness** | verified | `readiness::tests::cold_build_and_content_scoped_invalidation_are_honest` passed |
| **F1-F4 unit contract** | verified | Console vitest: `workspace-state.test.ts`, `workspace-route.test.ts`, `thread-readiness.test.ts` (6 passed) |
| **F1-F4 Playwright** | verified | `npx playwright test e2e/workspace-goal-stack.spec.ts:29 --timeout=180000`: 1 passed (create, readiness flip, excluded dimming, degraded Find, history restore, screenshot) |
| **Dev host script** | fixed | Root `package.json` `api:dev` / `api:test` now target `../Theorem/apps/commonplace-api` (live GraphQL host). Local publish fork retained as `api:dev:local-fork` / `api:test:local-fork`. |

## Implementation map (already landed before this session)

| Spec | Path |
|---|---|
| B1-B2 | `Website/Theorem/rustyredcore_THG/crates/rustyred-thg-vfs` |
| B3-B4 | `Website/Theorem/rustyredcore_THG/crates/rustyred-thg-workspace` |
| B5 | `Website/Theorem/apps/commonplace-api/src/workspace.rs` + schema fields |
| B6 | `Website/Theorem/rustyredcore_THG/crates/rustyred-thg-mcp/src/workspace_tools.rs` |
| F1-F4 | `CommonPlace/apps/console/src/views/workspace/WorkspaceSubstrateView.tsx` |
| Client | `packages/theorem-acp/src/workspace-state.ts` |
| Proxy | `apps/console/src/app/api/workspace/route.ts` → upstream `/graphql` |

## Named choices confirmed

- Update strategy for F1: **poll** every 1500ms (`POLL_MS` in `WorkspaceSubstrateView`).
- Canonical UI: `apps/console`, not `apps/web`.
- Live GraphQL: Theorem `apps/commonplace-api` (deploy config + SDL), not CommonPlace fork.
- Project membrane: boost inside, floor outside above zero (crate test).
- Degraded results label missing indexes (Find badge + Ask badge).

## Next actions

1. Re-run B5 HTTP acceptance after disk headroom is stable.
2. Fix Theorem MCP WIP compile (`crate::open_world_hint_for_tool` in nested test module) or stash unrelated dirty MCP edits, then re-run `workspace_tools` tests.
3. Confirm Playwright `e2e/workspace-goal-stack.spec.ts` green after ENOSPC recovery.
4. Mint substrate Plan when harness MCP responds; bind checklist projection.
