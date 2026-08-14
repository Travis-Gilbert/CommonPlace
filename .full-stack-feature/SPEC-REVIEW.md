# Spec Review: ARD-THEOREM-2026-08-04 Parts 1 / 4 / 6 (UI)

**Date:** 2026-08-08 (Pre-remediation baseline)  
**Spec:** `Theorem/docs/ARD-THEOREM-2026-08-04 (1).md`  
**Commit:** baseline at 6c164f3  
**Status:** Pre-remediation baseline mapping. For final results, see [.full-stack-feature/EXECUTE-REPORT-REMAINING.md](EXECUTE-REPORT-REMAINING.md).  
**Code scope:** CommonPlace console + Theorem MCP `programmable_graph` (Wave A + B1/B2)  
**Runtime scope:** focused vitest only (no browser / deployed smoke)

Assumptions:
- UI-facing decisions from Parts 1, 4, 6 (+ P3), matching the research-map execute waves.
- Wave C / deferred rows still appear as gaps.
- Named `LocalDev*` stand-ins cannot promote live/substrate requirements to `meets`.

---

## 1. Scope

| Axis | Value |
|---|---|
| Spec | ARD Parts 1 (D1–D6), 4 (D19–D24 + P3), 6 (D31–D36); Commands gallery teaching surface |
| Code | `CommonPlace/apps/console`, `packages/data-model-contracts`, `packages/model-canvas`; Theorem `rustyred-thg-mcp` gallery/validate |
| Out of scope | Parts 2/3/5 full control-plane/commons implementation; AGPL twenty-front |
| Evidence classes observed | unit tests, static code read; **not** live harness REST, browser, or deployed v2 |

---

## 2. Requirement Mapping

| ID | Spec item | Code location | Status | Oracle → Evidence |
|---|---|---|---|---|
| SR-001 | D1 three-layer model; Layer 2 user types in UI | `ModelView`, `/Data-model/settings` | **partial** | product UI → settings exists; no L0/L1/L2 chrome |
| SR-002 | D2 Twenty metadata wire over graph | `api/rest/metadata/[[...path]]`, `metadata-rest.ts`, `metadataClient.ts` | **partial** | live REST → often `LocalDevMetadataStore`; Models still MCP GraphQL |
| SR-003 | D3 FieldType canonical; Twenty presentation | `twenty-metadata.ts`, Fields screen; `SchemaEditor.tsx` BigQuery | **partial** | adapter + display; no tagged payload forms; OWOX still BQ |
| SR-004 | D4 Facet CONFORMS_TO mapping | `ModelSettingsView` FacetsScreen | **partial** | auto name/type map + apply/revoke; no manual map / relation map |
| SR-005 | D5 validation on action path | records `enforcement`; no `put_item_validated` create UX | **partial** | action-path codes → observe/warn/reject only |
| SR-006 | D6 index promotion (3 triggers + proposals) | IndexesScreen + field filterable/sortable | **partial** | promote candidates; IndexPolicy four flags / demotion thin |
| SR-007 | D31 four-screen settings on MIT/twenty-ui | `ModelSettingsView.tsx` objects/fields/indexes/facets | **partial** | four screens present; native `<input>`/`<select>`; stand-in |
| SR-008 | D31 program + model canvases fixed roles | `ProgramView`, `ModelView` / OwoxStudio | **meets** | both registered; roles not merged |
| SR-009 | D31 cosmos.gl graph-scale canvas | `CosmosGraphSurface.tsx`, `ConsoleDataView` | **partial** | paint path exists; not parity with authoring canvases |
| SR-010 | D31 records register treated as built | `views/records/*` | **meets** | ARD treats as built; not re-audited deeply |
| SR-011 | D31 console gates / twenty fence | `gate:twenty`, ledger in AGENTS.md | **meets** | Wave A report: gate:twenty pass |
| SR-012 | D31 WorkOS AuthKit via next-auth | `apps/console/src/lib/auth.ts` | **missing** | still GitHub provider |
| SR-013 | D19 one invoke path (program UI door) | `programClient.callProgramGraph` → `/api/harness/programmable-graph` | **partial** | program/commands single door; fleet still multi-door; no Flight UI |
| SR-014 | D20 sweep primitive UI | — | **missing** | unmapped |
| SR-015 | D21 subgraph expansion visible | Compound expand in ProgramView | **partial** | compound ≠ sweep expansion ghosts |
| SR-016 | D22 affordance fingerprint inspector | — | **missing** | unmapped in program inspector |
| SR-017 | D23 cache / RAM-pressure debug UI | RunRail / StatusPanel | **missing** | unmapped |
| SR-018 | D24 validate-before-execute | `validateProgramDefinition`, RunRail Validate | **partial** | manual validate; Run does **not** gate; no blocker sentinel UX |
| SR-019 | P3 one canonical DAG | `GoalStackView` still registered; `/goals` | **partial** | parallel authoring DAG remains |
| SR-020 | Commands gallery → substrate gallery/fork | `CommandsGalleryView`, MCP `gallery`/`gallery_fork` | **partial** | wired; empty `CommandRegistry` + `LocalDevCommandGallery` |
| SR-021 | D32 rerun observation surface | `PrototypeStageView`, `@rerun-io/web-viewer` | **partial** | block live; not fleet-default / Dagster deep-link |
| SR-022 | D33 marimo / pgwire notebook UI | — | **missing** | unmapped |
| SR-023 | D34 theorem-blender peer | — | **missing** | unmapped |
| SR-024 | D35 Dagster fleet lineage lens | — | **missing** | unmapped |
| SR-025 | D36 DatasetVersion collective views | — | **missing** | unmapped |

**Counts:** meets 3 · partial 14 · missing 8 · exceeds 0

---

## 3. Findings (highest impact first)

### F1 — SR-018 D24 validate-before-execute is optional, not gating
- **Spec:** whole program validates before anything executes; blockers + typed errors with node ids.
- **Code:** `ProgramView.runProgram` calls `runProgramDefinition` with no prior validate (`ProgramView.tsx` ~1138–1150). Validate is a separate button (~1153–1181, RunRail props).
- **Impact:** invalid graphs can still execute; D24 “fail before compute” discipline not met in UI.
- **Fix:** call validate in `runProgram`; block Run on refusal; surface path of node ids / kinds; optional blocker sentinel chrome later.

### F2 — SR-012 WorkOS auth missing
- **Spec:** D31 — next-auth swaps provider to WorkOS; session shell stays.
- **Code:** `auth.ts` still `GitHub` only.
- **Impact:** identity path diverges from ARD control-plane decision (D14/D31).
- **Fix:** Wave C — WorkOS AuthKit provider swap; keep shell.

### F3 — SR-002 / SR-007 live metadata REST unproven (LocalDev substitution)
- **Required oracle:** live harness `/rest/metadata/*`.
- **Observed:** `metadata-rest.ts` prefers harness then falls back to named `LocalDevMetadataStore` on missing base / 502 / 503 / listing 404.
- **Substitution allowed?** As local stand-in yes; **not** as production evidence (named correctly).
- **Impact:** settings IA can look complete while never hitting substrate.
- **Fix:** env-gated live smoke against a node that serves REST; refuse silent 404→stand-in for promote/conform writes in prod.

### F4 — SR-003 / SR-007 field editor not tagged-FieldType forms
- **Spec:** field editor form shape follows tagged FieldType payload (enum variants, vector dim, relation target/cardinality).
- **Code:** Fields screen is flat Twenty token `<select>` + label/nullability/filterable/sortable (`ModelSettingsView.tsx` ~479–528). Adapter shows canonical string only.
- **Also:** `packages/model-canvas/.../SchemaEditor.tsx` still OWOX BigQuery enum.
- **Impact:** Layer 2 types that need payload shape cannot be authored correctly in settings.
- **Fix:** payload-driven subforms from `FieldType`; keep Twenty token as presentation only.

### F5 — SR-004 facet mapping is auto-heuristic, not operator mapping
- **Spec:** facet requirements against local fields; unmapped required flagged; property/relation maps.
- **Code:** FacetsScreen auto-matches by name then type; Apply disabled if required unmapped; no manual remap UI; no relation map (`~642–692`).
- **Impact:** wrong auto-match can apply bad CONFORMS_TO; operators cannot correct maps.
- **Fix:** per-property field picker; show relation maps; keep unmapped required flags.

### F6 — SR-019 / SR-020 P3 Goal Stack still parallel; gallery mostly stand-in
- **Goal Stack:** `registry.tsx` still renders `GoalStackView`; `/goals` live — P3 tension unresolved.
- **Gallery:** MCP `gallery` uses empty `CommandRegistry`; client falls to `LocalDevCommandGallery`. Fork path is correct (`gallery_fork`) but publications sparse.
- **Impact:** two computation-authoring DAGs; Commands gallery teaches fixtures, not live publications.
- **Fix:** demote Goal Stack to plan lens / fold affordances into program palette; populate durable command store so gallery is substrate-backed.

### F7 — SR-014 / SR-015 / SR-016 / SR-017 missing execution-fabric UI
- Sweep, expansion ghosts, fingerprint inspector, cache/RAM debug: **unmapped** in console.
- Compound expand ≠ D21 sweep expansion.
- **Impact:** ChainForge/ComfyUI semantics in ARD have no operator surface.
- **Fix:** blocked on substrate primitives; do not fake UI ahead of Rust sweep/fingerprint.

### F8 — SR-022–SR-025 Part 6 remainder missing
- marimo, Blender, Dagster, Perspective/Lemma DatasetVersion views: no console surface.
- **Impact:** expected for Wave C; recorded so execute does not claim D31 “done.”

### F9 — SR-005 action-path validation UX thin
- No console wiring to `put_item_validated` refusal codes on create forms.
- **Fix:** surface typed validation errors on Create/Update records path when backend codes exist.

### F10 — SR-006 IndexPolicy editor incomplete vs “four flags + provenance”
- Promote list + trigger.kind shown; demotion / full IndexPolicy flag editor / observation provenance thin.
- Filterable/sortable live on Fields screen (user-mark trigger) — good partial.

---

## 4. Plan to Correct

### Pass 1 — D24 gate Run (highest user impact, low risk)
1. `runProgram` → validate first; refuse Run on failure; keep Validate button.
2. Highlight `validationNodeIds` on canvas.
3. **Gate:** vitest validate+run client; manual `/program` invalid edge → blocked.

### Pass 2 — Field editor tagged payloads + facet manual map
1. Payload subforms for enum / vector / relation from canonical FieldType.
2. Facet property → field picker (not only auto-match).
3. **Gate:** twenty-metadata + settings component tests; `gate:twenty`.

### Pass 3 — Live metadata oracle
1. Smoke script against harness with REST; document env.
2. Optionally fail closed for mutating routes when stand-in would answer.
3. **Gate:** env-gated integration test (ignored without URL).

### Pass 4 — P3 Goal Stack demote + gallery substrate fill
1. Demote `/goals` to plan lens or fold palette into program.
2. Wire durable `CommandRegistry` so gallery is not empty→LocalDev.
3. **Gate:** gallery test with substrate fixture; route inventory.

### Pass 5 — WorkOS (D31) when ready
1. Swap next-auth provider; keep session shell.
2. **Gate:** auth smoke on staging.

### Pass 6 — Do not fake D20–D23 / D33–D36
1. Track as substrate/Wave C blockers only.
2. Ship UI when Rust/service primitives exist.

---

## 5. Validation Results

| Check | Outcome |
|---|---|
| `vitest` console: `programClient.gallery.test.ts`, `local-dev-metadata-store.test.ts`, `view-routing-retirement.test.ts` | **10 pass** |
| `vitest` `packages/data-model-contracts` `twenty-metadata.test.ts` | **3 pass** |
| `cargo check -p rustyred-thg-mcp` (prior session) | **pass** (warnings) |
| Browser smoke `/Data-model/settings`, `/commands`, `/program` Validate | **not run** |
| Live harness `/rest/metadata` | **not run** |
| `gate:twenty` this review | **not re-run** (Wave A claimed pass) |

---

## Verdict

Wave A/B delivered a **real but partial** settings register and a **manual** validate + gallery wire. Against ARD minimum for Parts 1/4/6 UI, most rows are **partial** or **missing**; only program/model canvas roles, records-as-built, and gate fencing clearly **meet**. Highest leverage corrections: **gate Run on validate (D24)**, **tagged FieldType + manual facet maps**, then **live metadata proof** — not more Wave C greenfield.
