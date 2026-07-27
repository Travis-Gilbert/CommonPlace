# SPEC-COMMONPLACE-CONSOLE-SHELL-1.1 Report

2026-07-26. `apps/console`. Delta over 1.0. Deliverables CS11 through CS20.

## Not done / residual risk

- Visual e2e at 2560x1290 not run in this environment (Playwright baselines need a browser session).
- Mono type-audit not executed live against the five launch surfaces in a browser; module ships and is ready for `runDevTypeAudit`.
- Add Note / Add Browser were removed from the frame; they are not yet remounted as Chat control-row actions (surfaces remain addable via Blocks palette / host placeBlock).
- Indexer sphere layout left untouched; product rename to Researcher is rail/slug/layout-switcher only. SurveyView and SurveyIndexerSearch match main byte-for-byte.
- Earlier CS17 edits to `SurveyIndexerSearch.tsx` were reverted: applying labels to the Indexer violated acceptance 11.
- Follow-up: rail briefly targeted sparse `view-*` seeds (one full panel). Retargeted to rich `console-*` places. Opaque material CSS fills in `geometry.css` and ModelView `bg-ij-editor` covered MaterialLayer shaders; materials are transparent again.

## Acceptance

1. **Rail five / glyphs / digits / layout switcher** — Verified by unit tests (`rail-model`, `seed-views`, `console-host`). PLACE_ENTRIES is Chat, Researcher, Index, Editor, Models. Collections leave the rail; legacy places stay in layout switcher Work group.
2. **No toolbar / active name once** — `MainToolbar` no longer mounts `data-frame-resident="toolbar"`. Layout switcher is in the sidebar header without naming the active surface. Island `blocks/BlockShell` carries `data-active-surface-name`.
3. **Status line** — Metadata size (`text-ij-island-meta`), faint ink, `min-w-0` + `overflow-hidden`. Progress only while `connection === 'connecting'`. Stale feed no longer sets progress (CS13/CS16).
4. **Island anatomy** — `block/BlockShell` and `blocks/BlockShell` support identity + optional control row + body. Models uses BlockShell with tabs-only control row. Workspace import groups labeled. Indexer keeps bare chrome (`showHeader={false}` path).
5. **Degradation** — `lib/degradation.ts` maps wire codes; ThreadView, StatusPanel, WhyTracePanel, ModelView, Workspace adopt it. Wire codes do not render as user copy.
6. **Idle indicator** — Indeterminate bar only while connecting; stale no longer animates.
7. **Labels / mono** — Workspace/Models/Files fields labeled; `dev/type-audit.ts` ships.
8. **Transcript / composer** — Role by treatment; JumpStrip removed; composer resting height reduced; CS10 plan tones in ThreadView and AgentRailBlock.
9. **Polymorphic rows** — FilesView and IndexStreamView differentiated by kind with actions.
10. **CS20 defects** — Causes recorded below; fixes landed.
11. **Indexer byte-identical layout** — `SurveyView.tsx` and `apps/console/src/views/survey/**` match main (no diff). Product rename to Researcher is rail label, `/v/researcher` slug, and layout-switcher surface name only.
12. **CS1/2/4/6/9/10** — Not reversed. CS10 step tones preserved and applied to ThreadView plan.

## Verify First notes

### Role values on the twelve pre-1.1 rail entries

Places (`tier: 'place'` / surface `role: 'place'`): Chat, Workspace, Filing, Canvas, Automation, Indexer, Models.

Collections (`tier: 'collection'` / surface `role: 'collection'`): Records, Cards, Threads, Documents, Files.

### Add Note / Add Browser mount

Located at `apps/console/src/components/host/HostCapabilityRailBridge.tsx`, mounted from `IntuiShell` as `absolute bottom-3 right-3` under `data-shell` (not `data-frame-resident`, not a portal). Contributions from `createHost.ts` (`pane.note`, `pane.browser`). Removed from the frame in CS12.

### Blocks adopting CS14 anatomy

- Adopted: `block/BlockShell`, `blocks/BlockShell`, Models (`ModelView`), Workspace (`WorkspaceSubstrateView`), AgentRailBlock (already on material shell).
- Reference, no identity/control rows: Indexer / Researcher survey board (unchanged layout).
- Files/Index: view-level polymorphic rows rather than new `FilesBlock.tsx` / `IndexBlock.tsx` files; behavior matches CS19 in `FilesView` and `IndexStreamView`.

### CS15 wire-code map

| Code | Level | Sentence |
|------|-------|----------|
| console_data_api_unreachable | unavailable | The data API is unreachable. |
| observed_model_graphql_failed | unavailable | The observed model could not be loaded. |
| observed_model_graphql_timeout | unavailable | The observed model request timed out. |
| observed_model_graphql_unconfigured | unavailable | The observed model endpoint is not configured. |
| observed_model_graphql_unreachable | unavailable | The observed model service is unreachable. |
| tenant_object_credential_unavailable | unavailable | A tenant credential is required before objects can load. |
| principal_credential_unavailable | unavailable | A credential is required before this surface can load. |
| console_chat_wire_failed | unavailable | The chat wire could not complete this turn. |
| web_search_unavailable | reduced | Web search is unavailable. |
| trigram | reduced | Trigram search is not ready. |
| vector | reduced | Vector search is not ready. |
| status_graphql | reduced | Status reporting is incomplete. |
| standing_queries | reduced | Standing queries are not ready. |
| status_digest_projection | reduced | The status digest is incomplete. |

Unmapped codes: generic sentence + `console.warn` in development.

### CS20 defect causes

1. **Duplicate floating human box** — `JumpStrip` in `ThreadView` mirrored `[data-thread-excerpt]` speaker labels into an absolute top-right nav. Removed.
2. **Bleed under status line** — Paint escaped below the frame clip; `data-shell` and the editor well now use `overflow-hidden`.
3. **Black composer artifact / spinner ghost** — Failed `ShaderMount` could leave an opaque canvas before fallback; `ShaderSurface` clears the host before fallback. PresenceMark remains the agent glyph.
