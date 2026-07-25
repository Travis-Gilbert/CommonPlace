# Plan Canvas implementation plan (SPEC-COMMONPLACE-PLAN-CANVAS-1.0)

Host surface: `apps/console` Goal Stack (`goal.stack`), not `apps/web`. Console constitution decision 19 makes v2 the canonical product host; the spec's `apps/web` path is superseded.

## Confirmed substrate names

| Spec name | Confirmed surface |
|---|---|
| Harness plan substrate | Remote MCP tool `plan` (actions: create, add_task, claim, transition, done, failed, inspect, what_changed, query, …). Not present in the pinned RustyRed Graph Database crates in this workspace. |
| Context brief machinery | Harness context / task activation path (remote). Console does not own brief composition. |
| Programmable graph register | MCP `programmable_graph_apply` with `action: materialize` (already used by save-as-program). |
| Canvas door | `apps/console/src/app/api/harness/plan/route.ts` plus `@commonplace/theorem-acp/plan-state`. |
| Visual stack | `@xyflow/react` + `@dagrejs/dagre` (library ledger: Goal Stack canvas). Clew supplies click-to-path geometry only (ancestor + descendant illumination), not its custom canvas renderer. |

## Deliverable status targets

### Backend (B1–B6)

Blocked in this repo: the plan crate lives in the deployed Theorem harness / THG stack, not in `Travis-Gilbert/RustyRed-Graph-Database` as pinned here. Console doors will accept the B3/B6 action names and forward when the remote tool supports them; otherwise they return typed 501/409 with the refusal rule named.

### Frontend (F1–F6)

Implement against the extended projection contract. Missing remote fields render honest empty or locked states; no invented progress fractions; no mock runs in the rail.

## Checklist

- [x] F1 Canvas: dagre seed layout, pinned positions, status ring, attachment chips, actor badge, branch offset, Clew click-to-path (`plan-path.ts`). Spec: F1, Design laws (layout stable, progress reported).
- [x] F2 Palette: four searchable groups with grant/locked rendering. Spec: F2, Named choices (palette groups).
- [x] F3 Live progress: edge fill uses reported `progressFraction` only; presence mark on active claim holder. Spec: F3, Design laws (progress never invented).
- [x] F4 Editing and attribution: human add/skip/complete, revert, proposal consent/deny doors. Spec: F4.
- [x] F5 Promotion: parameter candidate extraction + library instantiate form. Spec: F5, Named choices (promotion).
- [x] F6 Runs rail: lists `runsRail` when present; empty otherwise. Spec: F6.
- [ ] B1–B6 substrate extensions: not shippable from this checkout; doors and projection ready. Spec: B1–B6.
