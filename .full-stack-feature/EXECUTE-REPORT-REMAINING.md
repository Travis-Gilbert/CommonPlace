# Execute Report: ARD UI remaining (excl WorkOS)

## Summary
- Final condition: Remaining SPEC-REVIEW gaps except WorkOS are either implemented with unit/smoke evidence or closed with named substrate/service blockers.
- Goal achieved: partial-to-yes for buildable UI; D20–D23 and D33–D36 honestly blocked.
- Biggest remaining risk: live harness `/rest/metadata` and live gallery still need env-gated runtime proof; WorkOS still deferred to principal.
- Next action: principal WorkOS pass; optional live `CONSOLE_METADATA_URL` smoke against a node that serves REST.

## Plan anchors
- Goal: `goal:aa1c8c6380701610`
- Fallback plan: `fallback:ard-ui-remaining-1.0:20260808a` (substrate plan create refused: private store message too large)
- Payload: `Theorem/.harness/session-tools/payloads/create-plan-ard-ui-remaining.json`

## Checklist Reconciliation
| ID | Task | Status | Evidence | Validation | Notes |
|---|---|---|---|---|---|
| d24-gate-run | D24 gate Run | done | ProgramView validates before run | vitest gallery+block helper | |
| fieldtype-forms | Tagged FieldType forms | done | FieldSettingsPanels | twenty-metadata 4 tests | |
| facet-manual-map | Manual facet maps | done | FacetsScreen pickers | — | |
| index-policy-editor | IndexPolicy + demote | done | four flags + DELETE indexes | local-dev store | |
| metadata-live-smoke | Env-gated smoke | done | smoke-metadata-rest.mjs | skipped without URL | live not run |
| records-validated-ux | Validated write UX | done | RecordTableView code/note | — | |
| p3-goal-stack-demote | Demote Goal Stack | done | registry plan lens | routing tests | |
| gallery-substrate-fill | Gallery substrate | done | list_gallery templates | — | LocalDev named |
| layer-chrome | L0/L1/L2 chrome | done | settings tags | — | |
| fabric-seam-inventory | D20–D23 inventory | done | research-d20-d23-seams.md | file exists | |
| fabric-ui-or-close | Ship or close fabric UI | done | blockers recorded | — | no fake UI |
| wave-c-seams | D32–D36 inventory | done | research-d32-d36-seams.md | file exists | WorkOS excluded |
| wave-c-ui-or-close | Ship or close Wave C | done | blockers + D32 partial | — | |
| settings-twenty-inputs | twenty-ui inputs | done | SearchInput + toggles | gate:twenty pass | |

## Changes Made
| Area | Files | Summary |
|---|---|---|
| Program | ProgramView, programClient | D24 gate Run; shouldBlockRunAfterValidation |
| Settings | ModelSettingsView, FieldSettingsPanels, twenty-metadata, metadataClient, local-dev store | FieldType payloads, facets, IndexPolicy, demote, L0–L2 chrome |
| Records | RecordTableView | validated refusal code display |
| P3 | registry | Goal Stack plan lens |
| Gallery | programmable_graph comment | templates always listed |
| Smoke | smoke-metadata-rest.mjs | env-gated live oracle |
| Research | research-d20-d23 / d32-d36 | blockers |

## Validation
| Check | Result |
|---|---|
| twenty-metadata.test.ts | 4 pass |
| console focused vitest (4 files) | 14 pass |
| gate:twenty | pass |
| smoke-metadata-rest | skipped (no URL) |
| Browser Product complete | not run |

## Remaining Work
- WorkOS AuthKit (principal)
- Live metadata / gallery smoke when harness REST is up
- D20–D23 / D33–D36 when substrate/services land
