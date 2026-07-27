# Console surface audit

CN1 and CN2 audit for `SPEC-COMMONPLACE-CONSOLE-CONSOLIDATION-1.0`.

## Counting rules and result

- Scope: every production `.tsx` render file below `src/views/`, recursively, except `registry.tsx` itself. Tests and pure `.ts` contract or layout modules are not view files.
- Registered means the file supplies a renderer directly to `CONSOLE_VIEW_REGISTRY`. A child means the file is rendered only through the named registered parent.
- Route means an App Router URL or an explicit seeded shell surface that a person can select through the Layout Switcher or account control. The exact path or shell surface is named.
- Palette means the file is the registered renderer, or a rendered child, of a descriptor with `paletteVisible: true`.
- Real means a BlockHost query/action, server API, or live client store supplies the data. Fixture means deterministic seed data or a static placeholder supplies it.

The hardcoded-palette hypothesis was confirmed. The shell imported an eight-row `BLOCK_PALETTE` from the legacy navigation Sidebar. `index.rail` appeared twice as Index and Data model, `files.tree` appeared twice as Filing and Files, and `canvas` did not appear. CN2 removes that legacy declaration and now derives nine unique rows from registry descriptors: Records, Documents, Files, Index, Plan, Automation, Canvas, Kanban, and the harvested Search stack. Views, Places, and Collections keep their separate navigation rules.

**Reachable count after consolidation: 62 of 62 remaining view files.** Five additional audited files had a `delete` verdict because neither a route nor a palette entry reached them; CN6 removed those files and their seven orphan descriptors. The registry now contains 31 descriptors, of which 9 are palette-visible.

## Audit

| View file | Registered in `registry.tsx` | Reachable by route | Present in Blocks palette | Data source | Verdict |
|---|---|---|---|---|---|
| `AccountView.tsx` | Yes: `settings.account` | Yes: account control opens `console-account` | No | Real: Auth.js and account credential APIs | route |
| `AppearanceView.tsx` | Yes: `settings.appearance` | Yes: Layout Switcher surface `console-appearance` | No | Real: appearance preference store | route |
| `CardView.tsx` | Yes: `card.full`, `cards.grid` | Yes: `/cards` through `cards.grid`; full cards render from opened records | No | Real: BlockHost objects and templates | route |
| `CodeFileView.tsx` | Yes: `code.file` | Yes: `/workspace` and pinned code tabs | No | Real: editor-model host actions, with deterministic initial seed | route |
| `ContextView.tsx` | Yes: `context.graph` | Yes: context companion on routed surfaces | No | Real: shell and memory projection stores | route |
| `DocListView.tsx` | Yes: `doc.list` | Yes: `/documents` | No | Real: live BlockHost document query | route |
| `FilesView.tsx` | Yes: `files.tree` | Yes: `/files` and routed companions | Yes: `files.tree` | Real: workspace and Harness memory projections | both |
| `GalleyDocView.tsx` | Yes: `markdown.doc` | Yes: `/documents`, `/workspace`, and pins | Yes: `markdown.doc` | Real: BlockHost document; deterministic brief only as seed | both |
| `HunkReviewView.tsx` | Yes: `hunk.review` | Yes: Layout Switcher surface `console-review` | No | Real: live Hunk set and host actions | route |
| `IndexDestinationsView.tsx` | Yes: `index.rail` | Yes: `/filing` | Yes: `index.rail` | Real: filing API with explicit unavailable states | both |
| `IndexRulesView.tsx` | Yes: `index.rules` | Yes: `/filing` | No | Real: filing rules API | route |
| `IndexStreamView.tsx` | Yes: `index.stream` | Yes: `/filing` | No | Real: filing index and digest APIs | route |
| `MailConnectView.tsx` | Yes: `mail.connect`, `mail.reader` | No | No | Fixture: static JMAP placeholders | delete |
| `MentionsSection.tsx` | No: child of `CardView.tsx` | Yes: `/cards` | No | Real: BlockHost mention queries and actions | route |
| `ProactivityGraphView.tsx` | No: superseded standalone implementation | No | No | Real API client, but no mount imports it | delete |
| `ProactivityView.tsx` | Yes: `proactivity.graph` | Yes: Layout Switcher surface `console-proactivity` | Yes: `proactivity.graph` | Real: queried graph objects and host edits | both |
| `RecordInspector.tsx` | No: shell inspector child | Yes: record selection on routed surfaces | No | Real: shell selection and BlockHost query | route |
| `RecordTableView.tsx` | Yes: `record.table` | Yes: `/records`, `/cards`, and seeded inspector surfaces | Yes: `record.table` | Real: live BlockHost set; deterministic records only as seed | both |
| `SurveyView.tsx` | Yes: `survey.board` | Yes: `/indexer` | No | Fixture: deterministic `surveySeed` projection | route |
| `ThreadView.tsx` | Yes: `chat.thread`, `chat.surface` | Yes: `/chat`, `/threads`, and routed companions | No: Chat remains a page exception | Real: assistant transport and thread store | route |
| `TopicListView.tsx` | Yes: `topic.list` | No: `/topics` exists but has no `SURFACE_ROUTES` mapping or seeded topic surface | No | Real: BlockHost topic query and arrangement edits | delete |
| `UrgentLaneView.tsx` | Yes: `index.urgent` | Yes: `/filing` | No | Real: urgent filing API | route |
| `ViewStates.tsx` | No: shared child | Yes: every registered parent surface | No | Real state passed by parent views | route |
| `blocks/AutomationHistoryView.tsx` | Yes: `automation.history` | Yes: `/automation` | No | Real: run and dispatch objects from Harness status | route |
| `blocks/BlockEmptyBody.tsx` | No: shared by orphan placeholders and Automation History | No standalone entry | No | Fixture: static placeholder prose | delete: Automation History migrated to canonical `ViewState` |
| `blocks/DeclaredBlocks.tsx` | Yes: `terminal`, `browser-pane`, `document`, `video` | No | No | Fixture: static placeholders; pipelines are not wired | delete |
| `blocks/KanbanBlock.tsx` | Yes: `kanban` | No standalone route | Yes: `kanban` | Real BlockHost typed containment and column movement | palette |
| `canvas/CanvasCardNode.tsx` | No: child of `canvas` | Yes: `/canvas` | Yes: via `canvas` | Real: canvas object projection | both |
| `canvas/CanvasPaperGround.tsx` | No: child of `canvas` | Yes: `/canvas` | Yes: via `canvas` | Real presentation of the active canvas | both |
| `canvas/CanvasView.tsx` | Yes: `canvas` | Yes: `/canvas` | Yes: `canvas` | Real: CanvasStore through BlockHost query and actions | both |
| `filing/FilingReceiptPopover.tsx` | No: child of `index.stream` | Yes: `/filing` | No | Real: filing receipt and correction APIs | route |
| `goal-stack/GoalStackView.tsx` | Yes: `goal.stack` | Yes: Layout Switcher surface `console-goals` | Yes: `goal.stack` | Real: Harness plan, run, and capability APIs | both |
| `goal-stack/NodeInspector.tsx` | No: child of `goal.stack` | Yes: `console-goals` | Yes: via `goal.stack` | Real: selected plan node props | both |
| `goal-stack/PlanPermissionPrompt.tsx` | No: child of `goal.stack` | Yes: `console-goals` | Yes: via `goal.stack` | Real: pending plan approval state | both |
| `goal-stack/PlanTaskNode.tsx` | No: child of `goal.stack` | Yes: `console-goals` | Yes: via `goal.stack` | Real: plan task node props | both |
| `goal-stack/ProgressEdge.tsx` | No: child of `goal.stack` | Yes: `console-goals` | Yes: via `goal.stack` | Real: plan progress edge props | both |
| `goal-stack/PromotionDialog.tsx` | No: child of `goal.stack` | Yes: `console-goals` | Yes: via `goal.stack` | Real: proposal promotion state | both |
| `goal-stack/ProposalPanel.tsx` | No: child of `goal.stack` | Yes: `console-goals` | Yes: via `goal.stack` | Real: plan proposal props | both |
| `goal-stack/RunsRail.tsx` | No: child of `goal.stack` | Yes: `console-goals` | Yes: via `goal.stack` | Real: Harness run projection | both |
| `goal-stack/ToolPalette.tsx` | No: child of `goal.stack` | Yes: `console-goals` | Yes: via `goal.stack` | Real: declared capability list | both |
| `harness-ux/RemedyCard.tsx` | No: child of `harness.why` | Yes: `console-harness-status` | No | Real: Harness remedy payload | route |
| `harness-ux/StatusPanel.tsx` | Yes: `harness.status` | Yes: Layout Switcher surface `console-harness-status` | No | Real: Harness status API | route |
| `harness-ux/WhyTracePanel.tsx` | Yes: `harness.why` | Yes: `console-harness-status` | No | Real: Harness why API | route |
| `model/ModelView.tsx` | Yes: `model.studio` | Yes: `/models` | No | Real: observed-model APIs and BlockHost model objects | route |
| `model/ObservedDeclaredLenses.tsx` | No: child of `model.studio` | Yes: `/models` | No | Real: observed and declared model props | route |
| `proactivity/AssumptionPanel.tsx` | No: child of `proactivity.graph` | Yes: `console-proactivity` | Yes: via `proactivity.graph` | Real: graph projection and host edits | both |
| `proactivity/BlockStack.tsx` | No: child of `proactivity.graph` | Yes: `console-proactivity` | Yes: via `proactivity.graph` | Real: typed projected blocks | both |
| `proactivity/CardAltitude.tsx` | No: child of `proactivity.graph` | Yes: `console-proactivity` | Yes: via `proactivity.graph` | Real: graph projection | both |
| `proactivity/GraphAltitude.tsx` | No: dynamic child of `proactivity.graph` | Yes: `console-proactivity` | Yes: via `proactivity.graph` | Real: graph projection and computed layout | both |
| `proactivity/GraphCanvas.tsx` | No: child of `GraphAltitude.tsx` | Yes: `console-proactivity` | Yes: via `proactivity.graph` | Real: computed graph nodes and edges | both |
| `proactivity/IntentComposer.tsx` | No: child of `proactivity.graph` | Yes: `console-proactivity` | Yes: via `proactivity.graph` | Real: compile and host action APIs | both |
| `proactivity/controls.tsx` | No: shared children of `proactivity.graph` | Yes: `console-proactivity` | Yes: via `proactivity.graph` | Real: projected node and edit props | both |
| `search/AspectList.tsx` | No: child of `search.stack` | No standalone route | Yes: via `search.stack` | Real: same-origin search API results | palette |
| `search/ConstellationView.tsx` | No: child of `search.stack` | No standalone route | Yes: via `search.stack` | Real: same-origin scatter and find payloads | palette |
| `search/DockedMap.tsx` | No: child exported through `DockedSearchMap` | No standalone route | Yes: via `search.stack` | Real: active search session projection | palette |
| `search/FindOverlay.tsx` | No: child of `search.stack` | No standalone route | Yes: via `search.stack` | Real: same-origin find API | palette |
| `search/LambdaDial.tsx` | No: child of `search.stack` | No standalone route | Yes: via `search.stack` | Real: live search controller state | palette |
| `search/RelationMark.tsx` | No: shared child of `search.stack` | No standalone route | Yes: via `search.stack` | Real: relation labels from search results | palette |
| `search/SaveUrlButton.tsx` | No: child of `search.stack` | No standalone route | Yes: via `search.stack` | Real: same-origin save URL API and receipt | palette |
| `search/SearchStackView.tsx` | Yes: `search.stack` | No standalone route | Yes: `search.stack` | Real: same-origin find, scatter, expand, and save APIs | palette |
| `survey/SurveyIndexerSearch.tsx` | No: child of `survey.board` | Yes: `/indexer` | No | Fixture: filters deterministic survey captures | route |
| `survey/SurveyScene3D.tsx` | No: child of `survey.board` | Yes: `/indexer` | No | Fixture: deterministic survey scene projection | route |
| `survey/SurveySourceArtifact.tsx` | No: child of `survey.board` | Yes: `/indexer` | No | Fixture: deterministic capture artifacts | route |
| `thread/ObjectExcerpt.tsx` | No: child of chat descriptors | Yes: `/chat` and `/threads` | No | Real: BlockHost object query | route |
| `thread/ThreadExcerpt.tsx` | No: child of chat descriptors | Yes: `/chat` and `/threads` | No | Real: thread tool payload | route |
| `workspace/WorkspaceHistoryDiff.tsx` | No: child of `workspace.substrate` | Yes: `/workspace` | No | Real: workspace history API result | route |
| `workspace/WorkspaceSubstrateView.tsx` | Yes: `workspace.substrate` | Yes: `/workspace` | No | Real: workspace API and entity projection | route |

## Harvest status

- [x] Search stack frontend: the CSS-free package, same-origin client, Find overlay, aspect list, constellation, docked map, lambda control, relation marks, save action, and sole `search.stack` surface parent are present in the console. The parent is palette-reachable through registry metadata.
- [x] shadcn primitives: button, textarea, select, dialog, popover, tooltip, and scroll-area are initialized in `apps/console`; retained semantic aliases resolve to `--ij-*`, so the register remains paint authority.
- [x] Porcelain coloration review: inspected and discarded. `porcelain-theme.css` is a second scoped light and umber register with raw planes, shadows, fonts, and radii. Porting it would conflict with the pinned Int UI register and the console's existing OKLCH theme engine.
- [x] View-by-view comparison against the deleted console: Search is the only named further-ahead counterpart harvested in this pass. The `(studio)`, `(networks)`, `(spacetime)`, and `theseus` route groups are standalone publication, settings, demo, 3D, and project surfaces without console descriptor counterparts. Anti-scope forbids inventing replacements, so CN6 deletes them rather than carrying silent omissions.

## Completed deletion ledger

CN6 removed the six audited `delete` files and removed every descriptor that depended on them:

- `MailConnectView.tsx`
- `ProactivityGraphView.tsx`
- `TopicListView.tsx`
- `blocks/BlockEmptyBody.tsx`
- `blocks/DeclaredBlocks.tsx`

## Implementation notes

- Considered retaining the orphan placeholder descriptors versus deleting them. Chose deletion because none had a route, palette entry, or live pipeline.
- Considered deleting Kanban with the other orphans versus making it registry-reachable. Chose registry reachability because AMENDMENT-02 explicitly requires its typed containment behavior.
- Initialized shadcn in the console and retained only the seven named primitives. All generated theme aliases resolve to the Int UI register.
- Inspected the porcelain OKLCH register and discarded it. It defines a competing light and umber paint authority; the console register and theme engine remain canonical.
- Extracted the Search stack into `@commonplace/search-stack`. The console owns its same-origin BFF, global Find host, durable session-origin receipts, and docked visited map.
- The web edition opens external result pages through normal browser navigation. The native desktop keeps ownership of real webview navigation; this pass does not invent a replacement co-browser surface.

## Validation record

- Console TypeScript and production Next build pass.
- Console Vitest: 75 files, 335 tests pass.
- Search package Vitest: 6 files, 39 tests pass.
- Block-view package Vitest: 4 files, 16 tests pass.
- Console lint has zero errors.
- Fence, register, contrast, radius, motion, icon, token, block-class, persistence, and canonical-root gates pass.
- Desktop frontend build passes.
- Canvas Playwright proof passes and writes `canvas-three-connected-nodes.png` beside the isometric register.
