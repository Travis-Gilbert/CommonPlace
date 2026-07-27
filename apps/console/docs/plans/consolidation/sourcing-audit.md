# Console sourcing audit

Generated for SPEC-CONSOLE-COMPONENT-SOURCING-1.0 SC8 / Record 008.
Source of truth: `apps/console/src/views/registry.tsx`.

## Summary

| Metric | Count |
| --- | ---: |
| Descriptors | 32 |
| wrap | 20 |
| reskin | 1 |
| bespoke | 11 |
| Incorrectly bespoke | 0 |

## Verdicts

| id | mode | upstream or reason | verdict |
| --- | --- | --- | --- |
| `record.table` | wrap | jacksonkasi1/tnks-data-table/TnksDataTable | ok |
| `markdown.doc` | wrap | @travis-gilbert/markdown-theory/Galley | ok |
| `code.file` | wrap | codemirror/EditorView | ok |
| `chat.thread` | wrap | @assistant-ui/react/ThreadPrimitive | ok |
| `chat.surface` | wrap | @assistant-ui/react/Composer | ok |
| `files.tree` | wrap | @tanstack/react-virtual/useVirtualizer | ok |
| `context.graph` | wrap | d3/scalePoint | ok |
| `doc.list` | bespoke | Documents list is a host-query retarget of markdown.doc arrangement; no list library owns surface-instance patching. | bespoke-allowed |
| `index.rail` | bespoke | A destination rail is a list of shelves at register density; no library models the filing contract behind it. | bespoke-allowed |
| `index.stream` | wrap | @dnd-kit/core/DndContext | ok |
| `find.index` | wrap | jacksonkasi1/tnks-data-table/TnksDataTable | ok |
| `index.rules` | wrap | cmdk/Command | ok |
| `index.urgent` | bespoke | A lane whose empty state is its designed norm is a product claim, not a generic list: no library models "reassure, do not gamify". | bespoke-allowed |
| `mail.connect` | bespoke | JMAP connect, mapping, consent, and sync status are a product contract with no ledger library for the multi-step flow. | bespoke-allowed |
| `mail.reader` | bespoke | Minimal mail reader with entity chips, thread rail, and sanitizer policy is bespoke to the JMAP spoke handoff. | bespoke-allowed |
| `card.full` | bespoke | kind-templated card layouts are a domain concept no library models | bespoke-allowed |
| `cards.grid` | wrap | @tanstack/react-virtual/useVirtualizer | ok |
| `hunk.review` | bespoke | The typed Hunk review mechanics are the product contract; nested structured values still resolve through registered descriptors. | bespoke-allowed |
| `proactivity.graph` | bespoke | The editable proactivity graph is the product contract: the standing structure renders and edits as one object at three altitudes, and the dagre layered layout is the join-visible surface. Node kinds and edges resolve through the block-view seam. | bespoke-allowed |
| `workspace.substrate` | wrap | @tanstack/react-virtual/useVirtualizer | ok |
| `goal.stack` | wrap | @xyflow/react/ReactFlow | ok |
| `harness.status` | bespoke | The status report is a Harness contract surface with actionable waiting items and backend degradation. | bespoke-allowed |
| `harness.why` | bespoke | The why trace renders an untransformed Harness explainer payload and optional remedy. | bespoke-allowed |
| `settings.appearance` | bespoke | Appearance knobs drive the console register seed; no upstream settings panel owns --ij token mutation. | bespoke-allowed |
| `settings.account` | wrap | next-auth/react/SessionProvider | ok |
| `terminal` | wrap | textmode.js/Textmode | ok |
| `browser-pane` | wrap | servo-render-worker/POST /render | ok |
| `kanban` | wrap | @dnd-kit/core/DndContext | ok |
| `document` | wrap | akii09/pdfx/PdfxDocument | ok |
| `video` | wrap | remotion-dev/remotion/Composition | ok |
| `canvas` | wrap | @xyflow/react/ReactFlow | ok |
| `automation.history` | reskin | jal-co/ui/commit-graph | ok |

## Incorrectly bespoke (named rebuilds)

Count: **0**

None. Every bespoke descriptor carries a real allowed reason.

## Notes

- `find.index` wraps tnks-data-table and stays unavailable until CN7 find resolvers land (honest error, no fixture).
- `canvas` and `goal.stack` declare `acceptsDrop.semantic = relate`.
- Hand-extracted `jalco/` copies were replaced by registry installs where the registry resolved; `linear-combobox` remains a thin wrap (no public registry JSON).
- Proactivity `commit-graph.tsx` must stay distinct from jal-co CommitGraph under `jalco/commit-graph.tsx`.

Folds into CN1 consolidation.
