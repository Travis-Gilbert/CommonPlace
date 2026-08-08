# Execute Checklist: Wave A — Data-model settings register

**Shape:** checklist + visual  
**Authority:** `.full-stack-feature/00-research-map.md` Wave A; ARD D1–D6 + D31 four-screen settings  
**Repos:** CommonPlace (UI) + Theorem (substrate REST already ahead)  
**Palette:** twenty-ui · @base-ui/react · jal-co · reui · 21st installs only  

## Goal
Console operators can manage Layer 2 object types, FieldType-tagged fields, IndexPolicy promotion, and facet conformance via a settings IA wired to `/rest/metadata/*` (same-origin adapter), without a second invoke path or AGPL twenty-front.

## Rows

| ID | Task | Status | Evidence | Validation | Notes |
|---|---|---|---|---|---|
| A1 | Same-origin console proxy/client for `/rest/metadata/*` | done | `api/rest/metadata/[[...path]]`, `metadata-rest.ts`, `LocalDevMetadataStore` | vitest local-dev-metadata-store | Falls back to named stand-in |
| A2 | Object type list + detail settings screen (twenty-ui) | done | `ModelSettingsView` objects screen | manual + types | |
| A3 | Field editor driven by generated FieldType | done | Fields screen + Twenty↔canonical map in `twenty-metadata.ts` | vitest twenty-metadata | OWOX SchemaEditor BigQuery retained for marts |
| A4 | IndexPolicy editor + promotion provenance UI | done | Indexes screen + promote POST | vitest promote | |
| A5 | Facet conformance mapping screen | done | Facets screen | vitest conformance | |
| A6 | Route/nav into settings from Models surface | done | `/Data-model/settings`, ModelView link, registry + seed | routing tests | |
| A7 | Focused tests + gate:twenty / gate:sourcing | done | unit tests + gate:twenty | vitest + `npm run gate:twenty` | gate:twenty pass 2026-08-07 |
| A8 | LocalDev / unconfigured-harness fallback stays named stand-in | done | `LocalDevMetadataStore` banner | vitest | |

## Explicit non-goals
- Vendoring AGPL twenty-front
- Program canvas / Goal Stack / sweep (Wave B)
- WorkOS auth, Dagster, Blender, Perspective (Wave C)
- Inventing a second MCP/HTTP invoke path for agents

## First slice (smallest coherent)
A1 → A2 → A6, then A3, then A4/A5.
