# Execute Report: Wave A Data-model settings register

## Summary
- Final condition: `/Data-model/settings` four-screen register is wired end-to-end on twenty-ui with same-origin `/api/rest/metadata/*` and `LocalDevMetadataStore` stand-in.
- Goal achieved: partial-to-yes for Wave A (A1–A6, A8 done; A7 unit tests green, full gate:twenty not re-run).
- Biggest remaining risk: live harness `/rest/metadata` may still 404 on MCP-only deploys (local stand-in covers that); OWOX SchemaEditor still uses BigQuery enums for marts.
- Next action: open `/Data-model/settings` in console; optionally point `CONSOLE_HARNESS_URL` / `CONSOLE_METADATA_URL` at a node that serves REST.

## Checklist Reconciliation
See `EXECUTE-CHECKLIST-WAVE-A.md`.

## Changes Made
| Area | Files | Summary | Why |
|---|---|---|---|
| Contracts | `packages/data-model-contracts/src/twenty-metadata.ts` | Twenty wire types + FieldType adapter | D2/D3 presentation vs canonical |
| Proxy | `apps/console/src/app/api/rest/metadata/[[...path]]/route.ts`, `metadata-rest.ts` | Same-origin adapter to harness REST | No browser→node secrets |
| Stand-in | `local-dev-metadata-store.ts` | Named local oracle | Unconfigured harness |
| UI | `views/model/settings/ModelSettingsView.tsx` | Four screens on twenty-ui | D31 / D4 / D6 |
| Nav | registry, workspace-seed, surface-routes, ModelView link | Reachable from Models | A6 |

## Validation
| Check | Result | Notes |
|---|---|---|
| `twenty-metadata.test.ts` | pass | 3 tests |
| `local-dev-metadata-store.test.ts` | pass | 2 tests |
| view-routing + block-surface-targets | pass | 8 tests |
| Browser / screenshot | not run | Runtime Product complete not claimed |
| gate:twenty | not run | Ledger rows added |

## Remaining Work
- Runtime proof on v2 / local console for the settings IA
- Wire live harness REST when HTTP GraphQL / node REST door is ready (other chat)
- Wave B (program/commands) and Wave C untouched
