# HANDOFF-CONSOLE-BLOCK-SYSTEM

Repo `Travis-Gilbert/CommonPlace`, app `apps/console`, package `packages/block-view`, with one
cross-repo deliverable in `Travis-Gilbert/Theorem` (`apps/commonplace-api`). Register: execution
handoff; named choices are requirements. Decided with Travis 2026-07-20.

Companions: the console pivot decision log (2026-07 ceremony flush), HANDOFF-CONSOLE-ISLANDS-AND-MATERIAL,
the Railway runbook (Servo render worker and console upstreams; its env contract is authoritative
for variable names), SPEC-OBJECT-CONTRACT-V2, SPEC-UI-COMPONENT-SOURCING-AND-RESKIN.

Writing rules: no em dashes anywhere (code, comments, UI strings, docs). No invented numbers.
Status reports lead with what is not done.

## Verify first

Read before writing a line. Paths verified at `f598294` on CommonPlace:

- `packages/block-view/src/types.ts` (the contract: BlockHost, ObjectQuery, ObjectAction,
  ViewDescriptor, ViewSource, ThemeTokens)
- `packages/block-view/src/registry.ts`, `shape-match.ts`, `surface-tree.ts`, `addressing.ts`,
  `descriptor-contracts.ts`, `surface-actions.ts`
- `packages/block-view/src/host/HttpBlockHost.ts` and `MemoryBlockHost.ts`
- `apps/console/src/lib/shell-store.ts`, `thread-store.ts`, `memory-projection-store.ts`,
  `proactivity/proactivity-store.ts` (the four zustand stores this handoff retires)
- `apps/console/src/app/layout.tsx` and `page.tsx` (currently a single page; surfaces are store state)
- `apps/console/src/styles/theme-engine.ts`, `theme-engine.test.ts`, `int-ui-register.css`,
  `int-ui-register-light.css`, `register-bridge.css`, `token-manifest.json`
- `apps/console/scripts/check-contrast.mjs`, `check-register-lint.mjs`, `generate-token-manifest.mjs`
- `apps/console/CLAUDE.md` and `AGENTS.md` (app conventions; the import fence)
- `Theorem/apps/commonplace-api/src` and `schema.graphql` (the object seam server)
- `railway.console.toml` (env contract; do not invent variable names)

Search before asserting absence anywhere in either repo. Listings truncate.

## The diagnosis this implements

The block contract exists and is correct. What the side-by-side with the redesigned shell shows
is what the contract does not yet carry:

1. Descriptors have no presentation grammar. A view knows what shapes it accepts and what actions
   it emits, but not where it may mount, what sizes it may take, or what density it runs at. That
   is why islands compose poorly: composition is unspecified.
2. `ObjectSet.subscribe` is a no-op in both hosts. Nothing is live.
3. Surface arrangement objects (`surface`, `region`, `view-instance`) are served from a local
   array inside `HttpBlockHost` with an in-code note that they should be persisted server-side.
   Layouts are not yet data.
4. Four zustand stores and one Jotai-free tree, when Jotai is the decided model.
5. One route. Surfaces are client state, so nothing is addressable, and `theorem://` addressing
   (already implemented in `packages/block-view/src/addressing.ts`) has no web mirror.
6. Register constants predate the JetBrains Islands reconciliation, and the theme engine emits
   combinations the contrast gate never sees.

## Named choices

1. **The existing contract is the block system.** `packages/block-view` is extended, never
   paralleled. No new contract package, no second registry, no app-side fork of the types.

2. **Presentation grammar (additive).** `ViewDescriptor` gains an optional `block` field:

   ```ts
   export type MountPoint = "stripe" | "chrome" | "island" | "surface" | "companion";
   export type BlockDensity = "compact" | "cozy" | "both";
   export type BlockSize = "s" | "m" | "v" | "sq" | "w" | "full";
   // Grid spans on the 12-column island grid:
   // s 3x2, m 4x3, v 3x5 (vertical), sq 4x4, w 6x3, full = surface

   export interface BlockPresentation {
     readonly usage: string;          // usage-named, verb plus noun, e.g. "browse records",
                                      // "review automation history", "compose with the agent"
     readonly mounts: readonly MountPoint[];
     readonly sizes: readonly BlockSize[];
     readonly density: BlockDensity;
   }
   ```

   `ViewRegistry` gains `blocksForMount(mount: MountPoint)`. `shape-match.ts` is untouched.
   Descriptors without `block` remain valid (they render inside surfaces but cannot be mounted
   as movable islands). Every descriptor named in this handoff declares `block`.

3. **Two upstreams stay two; blocks speak one grammar.** This answers the harness API versus
   data API question. The Data API (`commonplace-api`, the `/objects/query`, `/objects/action`,
   `/objects/views` seam plus its GraphQL schema) is the only grammar blocks speak, through
   `BlockHost`. Agency actions already in the contract (`run_agent`, `invoke_tool`, `dispatch`)
   are forwarded server-side by `commonplace-api` to the harness; the web app never grows a
   second client grammar for them. One declared exception: the composer block rides
   `NEXT_PUBLIC_CONSOLE_CHAT_URL` directly through assistant-ui, because chat streaming is its
   own transport. The proactivity changefeed is a subscription transport, not a third grammar
   (choice 4). Variable names come from `railway.console.toml` exactly:
   `CONSOLE_DATA_API_URL`, `CONSOLE_DATA_API_KEY`, `CONSOLE_HARNESS_URL`,
   `CONSOLE_HARNESS_TOKEN`, `CONSOLE_HARNESS_TENANT`, `CONSOLE_HARNESS_ROOM`,
   `THEOREM_PROACTIVITY_CHANGEFEED_URL`, `NEXT_PUBLIC_CONSOLE_CHAT_URL`, `AUTH_SECRET`.

4. **Live sets ride the changefeed.** `ObjectQuery.live: true` means the host subscribes.
   `HttpBlockHost.subscribe` stops returning a no-op: one shared SSE client on
   `THEOREM_PROACTIVITY_CHANGEFEED_URL` (the RustyRed `/v1/proactivity/stream`, explicitly not
   the GraphQL host), fan-out to subscribed sets, re-query on relevant events, degrade to
   re-query-on-focus when the stream is down. Degradation is silent at the block body level;
   staleness surfaces only as a footer status. `MemoryBlockHost` gains a test emitter so live
   behavior is testable without a backend.

5. **Layouts are data.** The in-code note in `HttpBlockHost` becomes a requirement: `surface`,
   `region`, and `view-instance` objects persist through `/objects/action` and are read through
   `/objects/query`. The `LAYOUT_TYPES` local shim is deleted once the round trip is proven.
   Cross-repo deliverable: `commonplace-api` accepts and stores these three types (B6b). This
   is what makes surfaces agent-composable: an agent that can emit `create` on `view-instance`
   can put a block on the operator's screen, with a receipt.

6. **Jotai replaces zustand.** Named migrations, all four: `shell-store.ts`, `thread-store.ts`,
   `memory-projection-store.ts`, `proactivity/proactivity-store.ts`. Patterns pinned:
   `atomFamily` keyed by `view-instance` id for per-block state; `atomWithStorage` for the
   per-route layout cache, write-through to `/objects` per choice 5 (server is truth, storage is
   the fast path); plain atoms and derived atoms for shell and selection state. zustand leaves
   `package.json` in the same change that completes the last migration. No dual-store period
   survives the handoff.

7. **Surfaces are routes.** App Router segments `/chat`, `/workspace`, `/index`, `/documents`,
   `/cards`. `layout.tsx` keeps the shell, the material layer, and the frame chrome persistent
   across navigation. The shell store's surface radio becomes the router; deep links resolve;
   back and forward work; the web URL space mirrors `theorem://` addressing from
   `packages/block-view/src/addressing.ts`. Static export stays viable (no server-only features
   inside segments), so the Tauri path is unaffected.

8. **Token reconciliation, verified against JetBrains Islands (SDK doc, Nov 2025).**
   - Island radius stays 10 (matches `Island.arc` 20 at 2x).
   - Gutter becomes 6px (owner decision between the JetBrains 4 and the current 10).
   - Island border color equals island background. No stroke; the edge is the frame showing
     through.
   - `inactiveAlpha` 0.44 as the unfocused-surface overlay value.
   - Frame inversion: the frame ground is lighter than islands in dark mode and darker in light
     mode. This replaces the earlier darker-frame-in-dark constant. Rationale on record: gutter
     shadows from the material layer need a ground light enough to receive them.
   - Contrast floor: island to frame at 1.20:1 minimum.
   - Enforcement: `gate:contrast` (`scripts/check-contrast.mjs`) gains the island-to-frame check
     across every stock preset and across the theme engine's reachable output space; a preset
     that fails blocks the build. `token-manifest.json` regenerates.

9. **Theme engine clamp.** `theme-engine.ts` knobs are bounded so no reachable output violates
   the gates: tint chroma ceiling 0.03 in dark, 0.02 in light; accent chroma held to a bounded
   band; neutrals derived from the tint hue at 10 to 20 percent of accent chroma so themes stay
   familial. The contrast gate runs inside generation, not only in CI. Stock presets snapshot
   byte-stable in `theme-engine.test.ts`; IntelliJ Dark remains default; Clay remains ratified.

10. **Typography amendment (authorship test), superseding the machinery-boundary reading of the
    speaker registers.** Per string: written by the human, Manrope. A label or agent prose,
    IBM Plex Sans (this pulls chrome labels out of mono). Would appear in a log line (ids,
    paths, hashes, timestamps, counts, statuses, code), JetBrains Mono, one size step down,
    muted ink, `tabular-nums`. Human titles 600, agent titles 500. The grayscale speaker
    legibility check stays in `gate:register` and now also asserts that chrome labels are not
    mono.

11. **Sources land through `ViewSource`, honestly labeled.** All installs are registry-model
    (shadcn-compatible), reskinned through the css-vars regime at the token seam, never
    per-component colors. Sources and their roles:
    - jal-co/ui (`shadcn add @jalco/...`): commit-graph, log-viewer, json-viewer, diff-viewer,
      file-tree, status-indicator, kbd.
    - `jacksonkasi1/tnks-data-table` with the already-installed `@tanstack/react-table` and
      `@tanstack/react-virtual`: the records table.
    - blocks.so: command menu (pairs with the installed `cmdk`), auth, generic building blocks.
    - `damianricobelli/shadcn-linear-combobox`: inline command affordances in editors, the
      right-click-avoidance container, paired with the editor stack.
    - `akii09/pdfx` (own CLI and own MCP): the document output block on `@react-pdf/renderer`.
    - `mehrdadrafiee/recursive-dnd-kanban-board` (MIT): vendored as the dnd-kit nesting
      reference, not a dependency. The dependency is the already-installed `@dnd-kit/core`
      plus `@dnd-kit/sortable`.
    `mode` is recorded truthfully per component (vendor, reskin, wrap, fork); `bespoke` requires
    `allowedBespokeReason`, per the existing type.

12. **One drag layer.** dnd-kit carries all movement: kanban card and column movement, island
    lift and rearrange on the 12-column grid, and the promotion gestures (stripe row dragged to
    the ground becomes an island; island dragged to the bottom band docks as a chrome tool;
    island expanded becomes the surface). Promotion writes `view-instance` mutations through
    `emit`, so every layout change has a receipt. `react-resizable-panels` remains only where
    panel splits are genuinely panel splits; it does not own island movement.

13. **Declared block types, registered now, rendered in their own handoffs.** Registration means
    a `ViewDescriptor` with real `accepts`, `emits`, `source`, and `block` presentation, and a
    `render` that shows the designed empty state (not an error, not a blank). This reserves
    their place in the layout grammar so nothing designs them out:
    - `terminal` (usage "operate a shell"): mounts island and surface, sizes w and full,
      density compact. Web renderer candidates to evaluate in its own handoff: `textmode.js`
      (already a dependency) and ratzilla; the desktop shell path is ratatui inside
      `Theorem/apps/desktop`, where the backend is in-process. No ratatui code exists in
      Theorem's indexed tree today; nothing is claimed built.
    - `browser-pane` (usage "view a page"): mounts island and surface, sizes w and full.
      Upstream is the render worker (`POST /render` on the Servo render service per the Railway
      runbook); the block declares that upstream in its data note now.
    - `kanban` (usage "move work through states"): mounts island and surface, sizes m, w, full.
    - `document` (usage "produce a document"): pdfx-backed output, mounts surface and island.
    - `canvas` (usage "arrange spatially"): `@xyflow/react` plus JSON Canvas interchange,
      mounts surface.

14. **Paper workflow note for the executing heads.** Paper Desktop runs a local MCP
    (127.0.0.1:29979). Skin work runs with the Paper MCP and the Theorems Harness MCP in the
    same session: design against live records, extract with `get_jsx` (Tailwind format) and
    `get_computed_styles`. The in-repo register remains canonical truth; Paper is the design
    surface and extraction tool. claude.ai cannot reach the Paper MCP; only local heads can.

## Deliverables

**B1. Contract extension.** `packages/block-view/src/types.ts` gains `MountPoint`,
`BlockDensity`, `BlockSize`, `BlockPresentation`, and the optional `block` field on
`ViewDescriptor`. `registry.ts` gains `blocksForMount`. Unit tests in the package cover mount
filtering and the additive-compatibility claim (a descriptor without `block` still registers,
matches, and resolves).

**B2. Register and gates.** Constants from choice 8 land in `int-ui-register.css`,
`int-ui-register-light.css`, and `register-bridge.css`; `theme-engine.ts` clamps per choice 9;
`check-contrast.mjs` gains the 1.20:1 island-to-frame assertion over presets and engine output;
`check-register-lint.mjs` gains the chrome-labels-not-mono assertion; `token-manifest.json`
regenerates via `tokens:manifest` and `gate:tokens` passes.

**B3. Routes.** `apps/console/src/app/{chat,workspace,index,documents,cards}/page.tsx` with the
persistent shell in `layout.tsx`. The surface radio in the stripe navigates; nothing else about
the stripe changes here (the sidebar structural rethink is its own handoff).

**B4. Jotai migration.** The four named stores become atoms per choice 6, in
`apps/console/src/lib/state/` (one module per retired store, same public selectors where
callers exist). zustand is removed from `package.json` in the completing change.

**B5. Live sets.** Changefeed client in `packages/block-view/src/host/changefeed.ts`;
`HttpBlockHost` honors `live: true`; `MemoryBlockHost` gains `emitTestEvent`. Vitest covers
subscribe, fan-out, and degradation.

**B6. Layouts as data.**
- B6a (CommonPlace): `HttpBlockHost` reads and writes `surface`, `region`, `view-instance`
  through the object seam; the `LAYOUT_TYPES` shim and constructor array are deleted;
  `atomWithStorage` becomes the cache in front of the server truth.
- B6b (Theorem, `apps/commonplace-api`): the three layout types are accepted, stored, and
  queryable, with receipts on mutation. Schema addition mirrored in `schema.graphql`.

**B7. Source installs and reskin.** The registries from choice 11 land under
`apps/console/src/components/` per app convention, each component's `ViewSource` recorded, all
colors resolved through register tokens (zero literal colors in vendored files after reskin;
`gate:fence` and `gate:register` both pass).

**B8. Declared blocks.** The five descriptors from choice 13 registered with designed empty
states. The empty state is part of the island anatomy: header band with kind glyph, title,
status; body carries the designed empty content; errors and loading are island states, never
body text.

**B9. Proving trio.** Three rendered blocks under the extended contract, one skin, no
component-local styling:
- `records-table` (usage "browse records"): tnks-data-table structure on a live `ObjectQuery`
  against the Data API, compact density, mounts island and surface, TanStack virtual for long
  sets, column model derived from `ObjectShape.fields`.
- `automation-history` (usage "review automation history"): the commit graph componentized at
  last (jal-co commit-graph, reskinned), fed by run and dispatch history projected through the
  object seam. If no run-shaped object type exists in the seam yet, projecting one is part of
  this deliverable, not a reason to stub the block.
- `composer` (usage "compose with the agent"): assistant-ui (already installed at 0.12.28),
  mounts surface (the ratified lower-third centerpiece on `/chat`) and island (scoped mini
  composer). Cmd/Ctrl-L focuses. The unavailable state renders once, in the block's status
  slot, never three times.

**B10. Movement and promotion.** dnd-kit wiring per choice 12: island lift, grid rearrange,
resize on the size grammar, and the three promotion gestures, each writing `view-instance`
mutations through `emit`.

## Acceptance

Report status as a scannable list leading with what is not done. Observable checks:

1. A descriptor without `block` still registers and renders (B1 compatibility test green).
2. `pnpm gates` passes, and a deliberately out-of-envelope preset added in a test fails
   `gate:contrast` on the island-to-frame floor.
3. Grayscale capture of a mixed human-and-agent surface passes the speaker legibility check,
   and no chrome label renders in mono.
4. `/workspace` and `/cards` are directly addressable; back and forward switch surfaces;
   a full reload lands on the same surface.
5. With localStorage cleared, a reload restores the island arrangement from the server
   (layouts are data, proven end to end against B6b).
6. Killing the changefeed mid-session leaves block bodies intact; staleness appears only as
   footer status; restoring the stream resumes live updates without reload.
7. Dragging the records table from an island to the stripe and back produces two
   `ObjectActionReceipt`s and a stable layout after reload.
8. The three proving blocks render against the live Data API with zero literal colors in
   their component files, verified by `gate:register`.
9. `zustand` absent from `apps/console/package.json`; no imports remain.
10. The five declared blocks appear in `blocksForMount("island")` with designed empty states;
    none renders an error string in its body.
11. Repo hygiene: no secret values in the tree; env variable names match `railway.console.toml`
    exactly.

## Out of scope

Desktop and Tauri work, Servo pane rendering, terminal rendering (both are declared in B8 and
built in their own handoffs), the sidebar structural rethink visuals (companion handoff; this
handoff only guarantees the stripe mount exists), Paper file authoring itself, and any Railway
mutation (owned by the Railway runbook).

## Decisions to encode

For the harness memory when a connected head runs this: gutter 6; frame inversion adopted from
JetBrains Islands with the shadow-legibility rationale; island border equals island background;
inactiveAlpha 0.44; 1.20:1 island-to-frame floor as a gate; typography authorship test
supersedes the machinery-boundary reading; blocks speak the Data API only, agency actions
forwarded server-side; layouts persist as objects; Jotai is the state model; dnd-kit is the one
drag layer; recursive-dnd-kanban-board vendored as reference; declared blocks reserve terminal,
browser-pane, kanban, document, canvas.
