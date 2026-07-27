# Planning-Theorem Artifact: Indexer live backend wiring

## Checklist Reconciliation (execute)

| Alias | Status | Evidence |
|---|---|---|
| IX-001 | done | `topicIndexerObjects` + `matched_spans_from_terms` / `excerpt_for_capture` |
| IX-002 | done | Console proxy `/api/theorem/topic-preview-assets/[assetId]` |
| IX-003 | done | Lexical `survey-edge` projection with worded reasons |
| IX-004 | done | `console-host` → `/api/indexer` with hermetic seed fallback |
| IX-005 | done | Indexer `/do` opens ActionSheet with capture chip |
| IX-006 | done | `SURVEY_SPATIAL_CAPTURE_BUDGET = 200` |

Branches: Theorem `Travis-Gilbert/indexer-live-projection`; CommonPlace `Travis-Gilbert/survey-surface`.

## Executive Summary

- Goal: Topics open a live Indexer harvest (captures, held previews, evidenced edges, `/do`) instead of `seedSurveyObjects()`.
- Intent: Theorem owns the pipeline (standing-topics + DATAWAVE + intake + server scheduler); CommonPlace console consumes versioned projections through the object seam. Keep SurveyView / `surveyContract` field names.
- Summary of work: six vertical slices grounded in `rustyredcore_THG`, then the console host swap.

## Current Condition

Indexer UI is shipped on CommonPlace `Travis-Gilbert/survey-surface`. `console-host` still answers `topic` / `capture` / `survey-edge` from `surveySeed.ts`.

On Theorem main (already present):

- Spec: `docs/plans/standing-topics/DESIGN-STANDING-TOPICS.md` (pipeline home is Theorem; surfaces land in CommonPlace).
- Crates: `rustyred-thg-standing-topics` (`TopicSubscription`, `FiledDocument`, `HeldPreviewAsset`, `SourcePreview`), `rustyred-thg-datawave`, `rustyred-thg-intake`, `rustyred-thg-datawave-harness`.
- Live acquisition: `rustyred-thg-server/src/standing_scheduler.rs` already discovers OG previews, fetches bytes into `HeldPreviewAsset`, and falls back to screenshots.
- FL0 standing hardenings: landed via `cursor/fl0-standing-harden-8a19` as [PR #269](https://github.com/Travis-Gilbert/Theorem/pull/269). [PR #296](https://github.com/Travis-Gilbert/Theorem/pull/296) (`Travis-Gilbert/fl0-standing-query`) is open + CONFLICTING and diffs **regress** `hydrate_predecessor_before_recovery` relative to main — close or rebase-drop, do not merge as-is.

Gap for Indexer: project filed harvest + held `snapshot_url` + worded similarity into CommonPlace `topic` / `capture` / `survey-edge` objects the console already parses.

## Goal

- User-visible: Topics list and Indexer board show live harvested pages with tags, spans, held previews, worded edges, and a working follow-up action.
- System: standing scheduler + DATAWAVE normalize + intake write → graph objects; console host prefers live ObjectQuery; seed remains hermetic fallback for e2e.
- Data: map `FiledDocument` / `SourcePreview.snapshot_url` → `capture` + `source_snapshot_*`; map `SIMILAR_TO` (or standing delta edges) → `survey-edge` with `reason` + `strength`.
- Operational: hermetic seed path stays green when harness/API are unset.
- Must not regress: spherical gallery, MaterialLayer-transparent ground, reduced-motion flat grid, held-media URL safety, FL0 recovery/tenant/idle-growth invariants from #269.

## Task Table

| Alias | Title | Depends | Files (primary) | Proof | Acceptance |
|---|---|---|---|---|---|
| IX-001 | Standing-topic harvest → graph objects | — | `rustyredcore_THG/crates/rustyred-thg-standing-topics/src/{pipeline,model}.rs`, `rustyred-thg-server/src/standing_scheduler.rs`, `rustyred-thg-datawave/src/{helper,materialize,edge}.rs`, `rustyred-thg-intake/src/{driver,lib}.rs`, GraphQL/Item projection in `apps/commonplace-api` (or Theorem GraphQL door) | `cd rustyredcore_THG && cargo test -p rustyred-thg-standing-topics && cargo test -p rustyred-thg-datawave` | Live `topic_subscription` harvest persists `FiledDocument`s with provenance + matched spans/gates; console-readable `topic`+`capture` shape exists |
| IX-002 | Held preview cold-store projection | IX-001 | `standing_scheduler.rs` (`fetch_preview_asset`, `HeldPreviewAsset`), standing-topics `SourcePreview`, tenant cold-store / blob put, CommonPlace `source_snapshot_url` contract | `cd rustyredcore_THG && cargo test -p rustyred-thg-server standing_scheduler --lib` (unit path; live smoke remains env-gated) | `snapshot_url` is CommonPlace-relative after hold; hotlinks rejected; OG preferred over screenshot |
| IX-003 | Indexer edge projection | IX-001 | `rustyred-thg-datawave/src/edge.rs`, `apps/commonplace-api/src/discover.rs` (`SIMILAR_TO`), projection to `survey-edge`, `surveyContract.ts`, `SurveyScene3D.tsx` | `cargo test -p rustyred-thg-datawave edge` + `cd apps/console && pnpm exec vitest run src/views/survey/surveyContract.test.ts` | Live `survey-edge` with non-empty `reason`; `budgetSurveyEdges` caps; cycles allowed; cards not repositioned |
| IX-004 | Swap host seed → live ObjectQuery | IX-001, IX-002, IX-003 | CommonPlace `apps/console/src/lib/console-host.ts`, `console-host.test.ts`, `TopicListView.tsx`, `e2e/survey.spec.ts` | `cd apps/console && pnpm exec vitest run src/lib/console-host.test.ts` | Live path when API present; hermetic seed still passes e2e; no SurveyView field renames |
| IX-005 | Indexer card action execution | IX-004 | `SurveyView.tsx`, `action-pack.ts`, `ActionSheet.tsx`, `thread-submit.ts`, `api/harness/delegate/route.ts` | Console unit/e2e covering pack build + honest disabled state | `/do` builds pack from capture context; For-me uses delegate; unset harness URL shows honest fallback |
| IX-006 | 200-plus capture scale path | IX-004 | `3d-image-gallery.tsx`, `SurveyScene3D.tsx`, `SurveyView.tsx`, `12-DESIGN-SURVEY-SURFACE.md` | `cd apps/console && pnpm exec playwright test e2e/survey.spec.ts` | 200-capture fixture within documented metrics; far/mid + reduced-motion parity |

## Dependency Graph

```
IX-001
├── IX-002 ──┐
├── IX-003 ──┼── IX-004 ── IX-005
│            └── IX-006
```

Repos split: IX-001–003 write in **Theorem** (`rustyredcore_THG` + API projection). IX-004–006 write in **CommonPlace** console.

## Spec Coverage

| Spec | Tasks |
|---|---|
| `DESIGN-STANDING-TOPICS.md` §2–4 (pipeline, object model, Canon composition) | IX-001, IX-004 |
| `DESIGN-STANDING-TOPICS.md` §8 (live acquisition in server; transport-free standing crate) | IX-001, IX-002 |
| `12-DESIGN-SURVEY-SURFACE.md` §1–2 clipping / source fidelity | IX-002 |
| `12-DESIGN-SURVEY-SURFACE.md` §3 evidenced connections | IX-003 |
| `12-DESIGN-SURVEY-SURFACE.md` §5–6 verify + seeded→live + actions | IX-001, IX-004, IX-005, IX-006 |
| `datawave-ingest-edge/STATUS.md` (field-facts + declared edges) | IX-001, IX-003 |

## Explicit Decisions

1. **Companion found:** `DESIGN-STANDING-TOPICS` lives in Theorem, not CommonPlace. Indexer brief cross-link should point at `Website/Theorem/docs/plans/standing-topics/DESIGN-STANDING-TOPICS.md`. No rewrite unless you want a CommonPlace stub pointer.
2. **PR #296:** Prefer close (hardenings already on main via #269). Rebase only if there is a unique commit not in #269 — current unique tip regresses recovery hydration.
3. **Seed retention:** IX-004 keeps `seedSurveyObjects` as hermetic fallback.

## Substrate Note

Harness `plan create` returned 502 at first mint. Local projections:

- `docs/plans/console/indexer-live-wiring/implementation-plan.md` (this file; CommonPlace worktree)
- `.harness/checklists/indexer-live-wiring--local.json`

Import when Plan MCP is healthy. Substrate ids become canonical.

## Non-Goals (consent required to defer)

Candidate: expanding DATAWAVE harness MCP ops beyond what standing harvest + Indexer projection need. Say yes to defer, or leave in scope for IX-001.
