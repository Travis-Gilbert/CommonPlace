# Plan Canvas status (SPEC-COMMONPLACE-PLAN-CANVAS-1.0)

Lead with gaps.

## Not done / not verified

- **B1–B6**: Plan substrate extensions (`TaskAttachment`, `TaskProgress`, `PlanRegister`, `task_context`, `plan_progress` / `plan_attach` / `plan_propose_remove`, `promote_to_program` / `instantiate_program`, watch seeds, commonplace-api GraphQL doors) are **not shipped**. Confirmed plan surface is the remote MCP tool `plan` on the Theorem harness. The pinned RustyRed Graph Database crates in this workspace do not contain that substrate. Console HTTP doors forward the new action names when possible and otherwise surface typed refusals.
- **Watch subscription (B5 / F3)**: Canvas still polls `plan inspect` + `what_changed` via `subscribePlanState`. No standing-query watch seed is wired; polling remains.
- **Grant flip without reload (F2)**: Projection accepts live grant_state; fixture flip against a real grants store was not verified.
- **Instantiate program form (F5)**: Save-as-program with parameter review ships; a separate program library instantiate UI is partial (materialize path only).
- **E2E screenshot oracle**: Unit tests pass; Playwright baseline not re-run in this session.

## Confirmed surface names

| Spec | Actual |
|---|---|
| Plan substrate | MCP `plan` (inspect, what_changed, add_task, done, failed, update, query, …) |
| Programmable graph | MCP `programmable_graph_apply` `materialize` |
| Product canvas | `apps/console` Goal Stack (`goal.stack`), `@xyflow/react` + `@dagrejs/dagre` |
| Projection | `@commonplace/theorem-acp/plan-state`, `plan-path`, `plan-params`, `plan-program` |
| Door | `apps/console/src/app/api/harness/plan/route.ts` |
| Clew reference | Ancestor/descendant illumination only (`plan-path.ts`), not Clew's custom canvas |

## Shipped in this pass

- **F1**: Dagre LR layout under plan seed, pinned drag positions (localStorage + `pin_position` door), status ring, attachment chips, actor badge, branch offset, Clew click-to-path.
- **F2**: Four palette groups with granted/locked rendering; locked attaches with capability named.
- **F3**: Edge fill uses reported `progressFraction` only (no invented mid-flight fractions); Presence mark on active claim holder.
- **F4**: Human add task / branch, complete, skip with reason, revert agent node, proposal consent/deny doors.
- **F5**: Parameter candidate extraction and promotion review dialog before materialize.
- **F6**: Runs rail from poll payload / progress query; honest empty when absent.

## Verification

- `packages/theorem-acp` `tsc --noEmit`: pass
- `apps/console` vitest `goal-stack-contract` + `plan-route`: 5/5 pass
- Playwright goal-stack screenshot: not re-run here
