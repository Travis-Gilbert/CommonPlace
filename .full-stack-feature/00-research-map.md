# Research map: ARD-THEOREM-2026-08-04 (Parts 1, 4, 6) → UI

**Mode:** research only (no implementation this round).  
**Source ARD:** `/Users/travisgilbert/Downloads/ARD-THEOREM-2026-08-04 (1).md`  
**Repos:** CommonPlace (product UI) + Theorem (substrate / REST / crates).  
**Design palette (mandatory for new UI):** `twenty-ui` · `@base-ui/react` · jal-co (structure extraction) · keenthemes/reui · 21st.dev installs. Enforced by `gate:twenty`, `gate:sourcing`, and `.cursor/rules/no-hand-roll-components.mdc`.

**Transport note (temporary):** Models console → `/api/observed-model` → MCP `graphql_query`/`graphql_mutate` today because deployed harness has no public `/graphql`. Side chat owns the HTTP GraphQL door. UI work must not invent a second invoke path; prefer REST `/rest/metadata/*` where the meta-model already exposes it, and keep console same-origin adapters.

---

## Design palette inventory (what to build with)

| Layer | Status | Paths / notes |
|---|---|---|
| `packages/twenty-ui` | **DONE** (MIT fork) | data-display, input, feedback, navigation, surfaces, json-visualizer, icon |
| `@base-ui/react` | **DONE** (dep) | Used by reui kanban + twenty-ui primitives |
| reui | **PARTIAL** | `ui/kanban.tsx`, `ui/kanban-board-5.tsx`, `ui/app-shell-8.tsx` (not mounted to product shell) |
| 21st / jal-co | **PARTIAL** | sidebar-component, dashboard-sidebar, filesystem-item, repo-card/commit-graph anatomy in ledger |
| Hand-roll risk | **ACTIVE** | ModelView field inspector uses native `<input>`/`<select>`; OWOX `SchemaEditor` uses BigQuery enum — replace when touching |

---

## Part 1 — Data model (D1–D6)

| ID | Decision | UI status | Evidence |
|---|---|---|---|
| **D1** | Three-layer model; Layer 2 user types | **PARTIAL** | Models ERD (`ModelView` / OwoxStudio) + declare/pin. No Layer 0/1/2 chrome; no dedicated type-settings IA |
| **D2** | Twenty metadata wire over graph storage | **PARTIAL** | Substrate REST `/rest/metadata/*` + Twenty-shaped types in `commonplace/src/metadata.rs`. Console still on schema-registry GraphQL contracts (`data-model-contracts`), **zero** `/rest/metadata` clients |
| **D3** | `FieldType` canonical; Twenty enum = presentation | **PARTIAL** | Generated `field-type.generated.ts` + records cells/editors on twenty-ui. **No** Twenty enum adapter. Model-canvas inspector still OWOX BigQuery types |
| **D4** | Facet contracts / CONFORMS_TO | **MISSING** (UI) | Backend: `commonplace/src/facet.rs`, REST facets/conformances. Console: no conformance screens. `ProviderFacet` badges ≠ D4 |
| **D5** | Validation on action path | **PARTIAL** | Record cell reject banner. No create-form validation UX wired to `put_item_validated` codes |
| **D6** | Index promotion UI | **MISSING** (UI) | `IndexPolicy` in contracts + REST promote/candidates. No filterable/sortable / promotion UI |

### Part 1 — D31 four-screen settings register (cross-link)

| Screen | Status | Build with |
|---|---|---|
| Object type list + detail | **PARTIAL** (diagram + tables, not settings IA) | twenty-ui list/detail + reui/app patterns |
| Field editor (tagged FieldType payloads) | **PARTIAL** (records editors strong; model inspector wrong) | twenty-ui inputs + FieldType-driven forms |
| Index policy editor + promotion provenance | **MISSING** | twenty-ui toggles / forms |
| Facet conformance mapping | **MISSING** (highest ARD value) | twenty-ui mapping UI; no Twenty analog |

**Backend already ahead of UI:** SPEC-COMMONPLACE-META-MODEL checklist marks substrate D1–D6 largely verified; D7 REST in progress. Console has not absorbed the Twenty metadata REST surface.

---

## Part 4 — Execution fabric / command graph (D19–D24, P3)

| ID | Decision | UI status | Evidence |
|---|---|---|---|
| **D19** | One invoke path; MCP projection | **PARTIAL** | Program canvas correctly MCP-only for run. Other surfaces still parallel doors. HTTP GraphQL gap is known |
| **D20** | Sweep primitive (ChainForge) | **MISSING** | No sweep node type / coordinate UI |
| **D21** | Subgraph expansion visible | **PARTIAL** | Compound expand exists; runtime sweep expansion UI absent |
| **D22** | Affordance fingerprint inspector | **MISSING** | No fingerprint on catalog / inspector |
| **D23** | Cache / RAM-pressure debug UI | **MISSING** (UI) | Server graph cache exists; StatusPanel/RunRail don’t expose keys |
| **D24** | Validate-before-execute / blockers | **PARTIAL** | Server validates on run; no pre-run panel / blocker sentinel UX |
| **P3** | One canonical DAG | **PARTIAL** | Program canvas primary; **Goal Stack** + proactivity graphs are parallel authoring DAGs |

### “Command graph” clarification

| Surface | Route | What it is today | ARD role |
|---|---|---|---|
| **Program canvas** | `/program` | Real xyflow programmable graph (palette, RunRail, BindingStationTray) | **The command/computation graph** (P3) |
| **Commands gallery** | `/commands` | cmdk searchable gallery of published commands / monitor templates (mostly fixtures) | Teaching / fork surface — **not** the graph editor |
| **Goal Stack** | `/goals` | Second DAG + affordance palette | **P3 tension** — do not grow; fold or demote |

---

## Part 6 — Surfaces (D31–D36)

| ID | Decision | Status | Notes |
|---|---|---|---|
| **D31** | 3 canvases + 4-screen settings; records built; gates; WorkOS | **PARTIAL** | Program + Model canvases **DONE**. cosmos.gl **PARTIAL**. Settings 4 screens incomplete. Records **DONE**. Gates passed (fence, twenty, register, contrast, radius, motion, icons, sourcing, tokens, blocks, paper-shader-colors, persistence, canonical-root, register-manifest, signed-request-bundle). WorkOS auth **MISSING** (still GitHub Auth.js) |
| **D32** | rerun universal observation | **PARTIAL** | Emit + gateway + PrototypeStageView block live; not fleet-default; Dagster deep-link blocked on D35 |
| **D33** | pgwire = marimo notebook register | **PARTIAL** | pg-server substantial; **no marimo UI**; Flight/time-pin/`state_hash()` gaps |
| **D34** | theorem-blender GPL peer | **MISSING** | No repo/addon |
| **D35** | Dagster fleet lineage lens | **MISSING** | No Dagster in either repo |
| **D36** | Datalab pinned DatasetVersion views | **MISSING** | No Perspective / Lemma / collective pin UI |

---

## Recommended UI execution waves (for later subagents)

### Wave A — Data-model settings register (Part 1 + D31)
Highest product leverage; backend partly ready via `/rest/metadata/*`.

1. Object type list/detail on **twenty-ui** (bind Twenty wire or adapter from schema-registry).
2. Field editor driven by **generated FieldType** (kill OWOX BigQuery enum in SchemaEditor).
3. Index policy + promotion UI (D6).
4. Facet conformance mapping screen (D4) — ARD “no Twenty analog.”

### Wave B — Command graph (Part 4)
1. Treat **Program canvas** as the graph; upgrade Commands gallery to real publications (not fixtures) with twenty-ui/reui cards.
2. Resolve P3: Goal Stack vs program canvas (fold affordances into program palette or demote Goal Stack to plan lens).
3. Pre-run validation panel (D24); fingerprint inspector (D22); sweep node + expansion ghosts (D20–D21) when substrate lands.

### Wave C — Observation / notebook / fleet (Part 6 remainder)
1. Promote rerun block beyond prototype stage (D32).
2. marimo/pgwire notebook surface (D33) — UI thin client.
3. Dagster / Blender / Perspective only after their services exist (D34–D36).

### Parallel (other chat)
HTTP GraphQL door for harness schema so Models UI stops depending on MCP transport.

---

## Explicit non-goals for UI wave A/B

- Vendoring AGPL twenty-front (P5 / `gate:twenty`).
- Growing model canvas into a program editor or vice versa (P3).
- Building a second invoke path for agents or UI (D19).
- Hand-rolling components that exist in twenty-ui / reui / 21st / jal-co.

---

## Key file index

### Console — models / records
- `apps/console/src/views/model/ModelView.tsx`
- `apps/console/src/views/model/diagram/ForkDiagramCanvas.tsx`
- `packages/model-canvas/` (OwoxStudio)
- `packages/data-model-contracts/`
- `apps/console/src/views/records/{cells,editors,schemaColumns}.tsx`
- `apps/console/src/lib/server/observed-model-harness.ts`
- `apps/console/src/lib/server/local-dev-declared-model-store.ts` (stand-in)

### Console — program / commands
- `apps/console/src/views/program/ProgramView.tsx` (+ NodePalette, RunRail, BindingStationTray)
- `apps/console/src/views/CommandsGalleryView.tsx`
- `apps/console/src/lib/rail/block-surface-targets.ts`

### Theorem — meta-model / facets / REST
- `docs/plans/commonplace-meta-model/SPEC-COMMONPLACE-META-MODEL-1.0.md`
- `docs/plans/commonplace-meta-model/SPEC-THEOREM-FACET-CONTRACT-1.0.md`
- `rustyredcore_THG/crates/commonplace/src/{metadata,facet}.rs`
- `rustyredcore_THG/crates/rustyred-thg-server/src/commonplace_rest.rs`

### Design system
- `packages/twenty-ui/`
- `apps/console/AGENTS.md` (component ledger)
- `apps/console/scripts/check-twenty-fence.mjs`

---

## Status legend used above

- **DONE** — product-usable in console or substrate as claimed  
- **PARTIAL** — real code exists but incomplete vs ARD  
- **MISSING** — no meaningful UI (or no service) yet

---

## Explorer provenance (session)

| Part | Explorer | Extra detail to pull when executing |
|---|---|---|
| 1 | [Map Part 1 data model UI](66342a54-54ea-4396-8c70-d65dc7f6011e) | Wire-path split GraphQL vs `/rest/metadata`; dormant `RecordsLens`/`FieldsTableLens`; orphaned `diagram/ObjectTypeCard.tsx`; ranked gaps 1–10 |
| 4 | [Map Part 4 command graph UI](0f3eddc4-0125-4ac6-84c3-92947f3c5b77) | Commands `program.fork` unwired; Rust `gallery.rs`/`command.rs` not on MCP; compound expand ≠ sweep expand; validate action unused by client |
| 6 | [Map Part 6 surfaces UI](31e3edd1-d679-4357-83a3-b66cb5c8d5bd) | WorkOS auth gap; SchemaEditor register hygiene; Places vs auxiliary routes; D34–D36 greenfield |
| REST | [Map metadata REST surface](1f6396c4-42ea-402b-9299-0a1fc8d785ec) | Confirmed routes/auth on `commonplace_rest.rs`; zero prior console clients; promote = `POST .../indexes/...`; IndexPolicy GraphQL shape ≠ Twenty `indexMetadataList` |

### Execute note (Wave A landed)

Implemented beyond the explorer’s “smallest first PR” (read-only list): catch-all `/api/rest/metadata/[[...path]]` (mirrors substrate path, not `/api/metadata`), `LocalDevMetadataStore`, and full four-screen `/Data-model/settings`. SchemaEditor BigQuery path intentionally kept for OWOX marts; settings Field editor uses Twenty wire + canonical FieldType map.

### Additions folded from explorers (not in first draft)

- **Console does not call `/rest/metadata/*`** — zero TS clients; substrate REST is ahead of UI.
- **Commands fork path is a stub** — `host.emit(invoke_tool, program.fork)` with no Rust gallery MCP action wired.
- **Program client forbids inventing liveness** — keep single MCP door (`programClient.ts`).
- **Dormant model lenses** — mount or delete `RecordsLens` / `FieldsTableLens`.
- **Auth** — console still GitHub Auth.js; WorkOS only on MCP serving tier.
