# apps/console constitution

Register: HANDOFF-GREENFIELD-CONSOLE, in force; HANDOFF-CONSOLE-COLORATION
layers the light register, the two-knob theme engine, and the icon policy on
top. This file and AGENTS.md carry the same constitution; every agent session
in this app inherits the fence from its context. The product sentence this app exists to make true: Cursor forked
IntelliJ instead of VS Code, with sidebars that show code and markdown as
easily as they show data models. The mechanism: IntelliJ chrome outside, the
block-view object contract inside every pane.

## Composition doctrine

One material system. Two structural sources. Bridged, not blended.

- Material (color, seams, elevation, focus, states) comes from the pinned Int
  UI registers and the gated theme engine: `int-ui-register.css` (dark,
  expUI_dark SHA 1a82cda) and `int-ui-register-light.css` (light), plus the
  two-knob derived engine (`theme-engine.ts`) and the Primer-sourced presets,
  all per HANDOFF-CONSOLE-COLORATION. The Int UI inversion holds in every mode:
  seams are darker than surfaces; no light hairline. Every stock, Primer, and
  derived theme clears the contrast gate, so the pinned-verbatim discipline
  survives coloration.
- IDE chrome (stripes, tool windows, tabs, toolbar, status bar) uses Int UI
  metrics: 28px controls, 24px rows, 40px tabs, arc 8.
- Record surfaces (tables, inspector, chips) use Twenty structural metrics
  (`src/styles/rec-structural.css`, values only, license lane 1): 4px grid,
  8px cell padding, 32px utility column, 500px side panel, 2px sibling gap,
  the 0.1s background transition, weights capped at 600.
- Documents render through Galley (`@travis-gilbert/markdown-theory`), mounted
  bare inside the shell with the `--gy` bridge resolving its ground and surface
  to the chrome. Prose faces stay Galley's own.
- Grounds are canvas, chrome is still: ambient motion lives only in the
  GroundCanvas layer behind the frame. Tool windows, tabs, and controls carry
  no ambient motion.
- The agent's visible identity is the Presence mark (textmode.js). No typing
  dots, no bespoke agent spinners, anywhere.
- Accent grammar: pending decisions and actions sit on the accent slot; the
  learned register renders gold (`--ij-gold`).

## Allowed sources

- The Int UI register (`--ij-*` tokens) and utilities emitted from it.
- The Twenty structural token group (`--rec-*`), structure only.
- `@travis-gilbert/markdown-theory` (Galley) for document rendering.
- `@commonplace/block-view` for the object contract.
- The library ledger below. Nothing renders outside it.

## Banned sources

- The porcelain register: `--cr-*` never appears in this app. Nothing beige.
- `apps/web` components, styles, or imports of any kind. The eslint fence and
  `scripts/check-import-fence.mjs` make this structural; CI fails on violation.
- Raw values: no hex outside register files, no arbitrary-value Tailwind
  classes, no raw palette utilities, no `*.module.css`, no literal durations
  outside `src/motion/motion-tokens.ts`.

## The ledger rule

Nothing on any surface is hand-rolled. Every visual and behavioral need
resolves to a row in the library ledger below. A need with no row is a spec
gap: add the row, with a named source, before writing code.

| Need | Source | Owns |
|---|---|---|
| Split layout, tool window panels | `react-resizable-panels` | split geometry, persisted sizes, 1px `--ij-divider` handles |
| Search everywhere, palettes | `cmdk` | command list, filtering, keyboard nav |
| Tabular lenses | tablecn structure on `@tanstack/react-table` | record.table sorting, filtering, column model |
| Row virtualization | `@tanstack/react-virtual` | large record sets |
| Thread and messages | `@assistant-ui/react` 0.12 | message list, streaming, message state |
| Composer mechanics | `@assistant-ui/react` 0.12 plus 21st.dev `reuno-ui/ai-input` extraction | auto-grow input, attachments, object mentions, mode slot, send behavior |
| Composer sheen | 21st.dev `muhammad-binsalman/glowing-ai-chat-assistant` material extraction plus hand-roll canvas | register-derived angled low-chroma sheen behind the Composer |
| Markdown in messages | `@assistant-ui/react-markdown` | inline markdown in the thread |
| Documents | `@travis-gilbert/markdown-theory` Galley | document-grade markdown rendering |
| Code viewing and editing | CodeMirror 6 (`@codemirror/*`) | editor, syntax, one theme file from `--ij-*` |
| React lifecycle motion | `motion` (`motion/react`) | entrances per the interaction inventory |
| Agent presence | `textmode.js` | the Presence mark, sole agent activity glyph |
| Client state | `zustand` | run state, shell session state |
| SSE consumption | `eventsource-parser` over fetch streams | parsing text/event-stream; EventSource is banned (cannot POST) |
| Icons | Noun Project SVGs (workspace subscription, `NOTICE.md`) normalized to `currentColor` on the icon ladder; small control primitives stay register strokes | every product/domain glyph, one file: `src/components/shell/icons.tsx`; `gate:icons` rejects hardcoded fills; expressive channels are domain tint (`--ij-memory`/`agent`/`room`/`graph`) and file-kind dots, per HANDOFF-CONSOLE-COLORATION named choice 7 / T5 |
| Object contract | `@commonplace/block-view` | BlockHost, ObjectQuery, descriptors, surface tree |
| Ground texture | hand-roll (GroundCanvas) | the one register-derived ambient canvas behind the frame |
| Files tree | 21st.dev `builduilabs/filesystem-item` behavior extraction plus `@tanstack/react-virtual` | recursive disclosure behavior and large memory projection virtualization |
| Context graph | D3 | deterministic ego graph layout and relation geometry |
| Agent plan | `@assistant-ui/react` plus 21st.dev `isaiahbjork/agent-plan` structure extraction | in-thread plan rows, tool labels, and run status |
| Graph canvas | `@xyflow/react` (React Flow) over `elkjs` (Eclipse Layout Kernel, `layered`) | the proactivity graph: elk computes the layered join topology, React Flow owns pan, zoom, selection, and edge routing; nodes and edges are register-styled (base CSS only, `--xy-*` mapped to the register in app.css), dynamic-imported so the sentence and card altitudes load no graph bundle |
| Graph node and sentence card building blocks | jalco-ui `commit-graph` and `repo-card` (ui.justinlevine.me), structure extraction | the commit-entry node (a response is a stack of agent-action steps a person builds) and the RepoCard sentence card; the jalco layouts are reproduced and every shadcn token re-skinned to the register |

glide-data-grid is the escalation path for spreadsheet-scale grids only and is
not used in this round.

## Porting by extraction

The only legal way code moves from `apps/web` into this app is landing in
`packages/*` stripped of CSS, then being imported like any dependency. There
is no second path. Renderers are never ported; they are rebuilt greenfield
against carried contracts.

## The marriage requirement

Shell layout persists as a seeded `surface` object through the block-view
contract. Tool windows and editor tabs host view instances resolved by
descriptor. `moveSurfaceNodeAction` semantics govern rearrangement. The shell
never grows a bespoke page; a new surface is a descriptor registration.

## Motion governance

One token file: `src/motion/motion-tokens.ts` (fast 160, base 220, slow 320,
register easings, stagger 40ms capped at the first 5). Every animation on the
surface appears in the interaction inventory; anything animating off-list is a
defect. Load is alive but inventoried: the designed route entrance is an
inventory row like every other animation. Reduced motion renders settled and
static. Transform and opacity only.

## Writing rules

No em or en dashes anywhere: not in code comments, not in UI strings, not in
markdown. Use colons, periods, commas, semicolons, or parentheses instead.

## Gates (all block merge)

1. Import fence: `npm run gate:fence`
2. Register lint: `npm run gate:register`
3. Contrast gate: `npm run gate:contrast`
4. Motion inventory scan: `npm run gate:motion`
5. Icon paint scan: `npm run gate:icons`
6. Playwright visual baseline: `npm run test:e2e`
