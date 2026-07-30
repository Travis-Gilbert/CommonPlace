# SPEC-PROGRAM-CANVAS-1.0

2026-07-27. `Travis-Gilbert/Theorem` and `Travis-Gilbert/CommonPlace`. Execution handoff. Deliverables PG1 through PG11.

The ComfyUI pattern, reimplemented on `@xyflow/react` for the programmable graph. Contains and extends `SPEC-MODEL-CANVAS-GRAPH-RECONCILIATION-1.0` MR8. Respects MR9: the data canvas and this surface never merge. The Rust surfaces it reads are `HANDOFF-BLOCK-CONTEXT` deliverables 1 through 7, which are built. This is `NORTH-STAR-PROGRAMMABLE-GRAPH` rungs 1 through 4 on screen.

`CONVENTIONS.md` applies.

## Frame

ComfyUI is the strongest existing proof that a node-graph editor can be the primary interface for composing typed, expensive, partially stochastic computation, and that ordinary people will learn it. Its pattern decomposes into nine elements, and every one of them has a native analog already sitting in the Theorem tree:

1. **Backend-registered node definitions, one generic renderer.** ComfyUI serves node classes over `/object_info`; the frontend renders every node through one component reading the definition. The analog is `embedded_catalog()` in `rustyred-thg-programmable-graph/src/catalog.rs`, unserved.
2. **Typed ports, typed wires.** MODEL, CLIP, LATENT and so on; connections filter by type. The analog is `ShapeSpec` plus `validate_edge_schema` with `EdgeSchemaStatus` and `SchemaMismatch`, which is stronger: it names the column and both sides, and it has a third state, undetermined, that ComfyUI lacks.
3. **Drag-from-port release opens a compatible-node search.** The single best interaction in the product. The analog is the same shape-satisfaction filter `render_for_agent_with_catalog` already computes for agents.
4. **Per-node execution state with content-hash caching.** Unchanged subgraphs skip with an `execution_cached` event; running nodes show progress. The analog is `content_id()` plus `ProcessLiveness` in `materialize.rs`, plus harness run streams.
5. **Widgets on nodes, promotable to inputs.** Parameters render inline; any widget converts to a port. The analog is params on the block contract, port-fed when promoted.
6. **Bypass, mute, groups, notes, reroutes.** Cheap composition ergonomics that make big graphs livable.
7. **Subgraphs as reusable units.** The analog is `publish_program` and `fork_program`, which already write a `Block` node and a `PUBLISHED_AS` edge, and are grant-gated, which is the marketplace ComfyUI's Manager approximates.
8. **Workflow travels with the artifact.** ComfyUI embeds the workflow JSON in output PNG metadata. The analog is better: every sink artifact links the program `content_id`, provenance native, no steganography.
9. **Missing nodes never block opening.** A workflow referencing unknown classes loads with red placeholders. The analog is a placeholder node plus a named `ProgramRefusal`.

**License posture.** ComfyUI is GPL-3.0 and `ComfyUI_frontend` is GPL-3.0-only, Vue 3 with Pinia and PrimeVue, with their litegraph fork merged into the frontend repo. Read and reimplement only: study interactions and architecture, adapt zero code. The canvas here is `@xyflow/react` 12.11.2, MIT, already in `apps/console/package.json` at that exact version. React Flow UI scaffolds install through the shadcn CLI, MIT, matching the existing component-sourcing discipline; pull, then reskin to the register.

**What the backend already has**, verified against `rustyred-thg-programmable-graph/src/lib.rs` and `rustyred-thg-mcp/src/programmable_graph.rs` on 2026-07-27: the model with `ProgramNodeKind`, `ProgramAuthority`, `SinkEffect`, `ProgramTrigger`, `SentinelWatch`; `validate_program` returning `ProgramRefusal` and `ValidationReceipt`; `validate_edge_schema`, `validate_program_edge_schemas`, `types_compatible`; `embedded_catalog` with `CatalogEntry`, `CatalogSource`, `FitStateClass`, `ShapeSpec`; `resolve_output_shape` with `FitState`; `boundary_shape` and block context attach and detach; `render_for_agent_with_catalog` and `DataTypeBadge`; `agent_proposal`, `diff_programs`, `validate_proposal_before_execution`, `ProgramDiff`; `publish_program`, `fork_program`, `validate_compiler_proposal`; `propose_evolution`; `recalculate`, `run_sentinels`, `matching_sentinels`, `ChangeEvent`; `materialize_program`, `canvas_projection`, `CanvasProjection`, `ProcessLiveness`. The MCP tool already exposes read actions `validate`, `project`, `recalculate` returning all four semiring folds plus the why trace, `sentinel`, `compiler`, `evolve`, `publish`, `fork`, and apply actions `materialize` and `publish`. What is missing is exactly the surface: catalog serving, load and list by id, draft save, the console view, and run-event streaming per node.

## Named choices

1. **`@xyflow/react` 12.11.2 is the canvas.** No litegraph port, no canvas2D renderer, no second engine. dagre, cmdk, dnd-kit, zustand, motion are the supporting cast and are already in the tree.
2. **One generic node component, catalog-driven.** `ProgramNodeView` reads a `CatalogEntry` and a `ProgramNode` and renders any operation. Per-entry bespoke components are forbidden; this is the trick that lets ComfyUI scale to thousands of node classes with one renderer.
3. **Node kinds by silhouette and glyph, never hue.** MR8's rule holds. The seven `ProgramNodeKind` variants get seven header glyphs and are legible in grayscale.
4. **Port and wire identity by shape class, encoded in a constrained hue family.** This is the one deliberate color spend on the surface and it is functional encoding, not decoration. At most five shape classes: graph-plane, tabular, tensor-and-model, scalar-value, artifact-and-sink. Hues derive in OKLCH from the paper system, chroma held low, each class also carried by a port glyph shape so grayscale stays legible and color is never the only channel. If this choice is vetoed, the fallback is monochrome wires with port glyphs and hover labels only, and PG5 ships identically either way. CS5's amber rule is untouched: amber remains reserved for divergence and action.
5. **`ProgramDefinition` is the workflow format.** No parallel JSON. ComfyUI's split between workflow JSON and API JSON is a flaw, not a pattern.
6. **Layout is never program identity.** Node positions live in a `program.layout` object keyed by the program's graph node id, written through `ObjectAction`, never inside `ProgramDefinition`, never inside `content_id()`. Moving a node must not change what the program is. `canvas_projection` provides initial layout when none is stored.
7. **The server is the connection law.** `isValidConnection` runs a client mirror of `types_compatible` for hot-path drag feedback; the authoritative check on connect is `validate_edge_schema` on the server, and its tri-state is rendered honestly: undetermined is never shown as valid.
8. **One satisfaction function serves human and agent.** The filter behind the drag-release palette is the same shape-satisfaction computation behind `render_for_agent_with_catalog`'s valid next operations. Byte for byte the same answers for the same boundary. Divergence between what the agent is told and what the human is offered is a bug class this choice deletes.
9. **Run rides the harness.** Run means `validate_program`, then `materialize` if dirty, then a harness run whose stream events drive per-node `ProcessLiveness`. No execution engine in the browser. Caching semantics come from `content_id` over each node's upstream closure, the honest analog of ComfyUI's input-hash cache.
10. **Contracts are generated.** All TypeScript types for this surface come from the Rust crate through the same codegen MR1 establishes, in a new `packages/program-contracts`, with the same CI drift check. No hand-maintained mirror.

## Deliverables

### PG1. Program contracts generated to TypeScript

`packages/program-contracts/` (new), `rustyredcore_THG/crates/rustyred-thg-programmable-graph/`

Generate TypeScript for: `ProgramDefinition`, `ProgramNode`, `ProgramEdge`, `ProgramPort`, `ProgramNodeKind`, `ProgramAuthority`, `SinkEffect`, `ProgramTrigger`, `SentinelWatch`, `CatalogEntry`, `CatalogSource`, `FitStateClass`, `ShapeSpec`, `EdgeSchemaStatus`, `SchemaMismatch`, `ProgramRefusal`, `ValidationReceipt`, `CanvasProjection`, `CanvasNode`, `CanvasEdge`, `ProcessLiveness`, `CompilerProposal`, `ProgramDiff`, `DataTypeBadge`, `FitState`. Use whichever of `ts-rs` or `schemars` MR1 picked; if MR1 has not landed, this deliverable makes the pick and MR1 inherits it. Header names the source crate and commit. CI fails when the generated file drifts.

Accepted when the console compiles against the generated package, adding a Rust enum variant without regenerating fails CI, and no hand-written duplicate of any listed type exists in `apps/console` or `packages/`.

### PG2. Serving: catalog, list, load, save, valid-next

`rustyredcore_THG/crates/rustyred-thg-mcp/src/programmable_graph.rs`

Extend the read actions: `catalog` returns `embedded_catalog()` plus published-block entries, cached on graph version; `list` returns the tenant's programs with authority, trigger, liveness summary, and content id; `load` returns a `ProgramDefinition` by graph node id plus its stored `program.layout` if any; `valid_next` takes a boundary shape and returns the catalog entries whose input requirement it satisfies, computed by the same function `render_for_agent_with_catalog` uses. Extend the apply actions: `save` upserts a draft `ProgramDefinition` as a real graph object without materializing, drafts labeled as drafts.

Route these through whatever transport the console's model view uses today, per Verify First; do not invent a second seam while the MCP serving tier cutover is in flight.

Accepted when the console fetches a catalog containing every `embedded_catalog` entry, loads a materialized program by id with `content_id` round-tripping unchanged, `valid_next` for a categorical-column boundary returns the encoders and excludes numeric-only transformers, and a saved draft reloads as a draft.

### PG3. The surface and the shell

`apps/console/src/views/program/ProgramView.tsx`, `apps/console/src/views/registry.tsx`

Register the view so the palette generates it, per CN2. `ReactFlowProvider`, dark canvas at register, dot-grid `Background`, `Controls`, `fitView`, pan and zoom defaults tuned for large graphs. A program picker fed by PG2 `list`, and autosave of drafts through PG2 `save` on a debounce. The full console gate suite passes, including `gate:persistence`, `gate:register`, `gate:radius`.

Accepted when the program view opens from the palette, loads a real program from the substrate, autosaves an edit and reloads it, no fixture path exists, and `npm run gates` passes.

### PG4. The catalog-driven node

`apps/console/src/views/program/ProgramNodeView.tsx`, `PortHandle.tsx`, `WidgetRow.tsx`

One component renders every operation. Header: kind glyph, display name, status ring, collapse toggle. Body: widget rows generated from the entry's parameter declarations, using combo, number stepper, text, and toggle controls; ports as left input and right output handles carrying the shape-class glyph. Isometric register on the card, no accent at rest, concentric radius per the radius rule. A parameter the contract declares as port-feedable renders a promote affordance that converts the widget to an input port whose shape is the parameter's scalar shape, and back; if Verify First finds the model does not yet carry parameter port-feeding, add it to `ProgramNode` in Rust first, because a promoted parameter is a different program and must move `content_id`.

Pull React Flow UI `base-node` and `labeled-handle` as scaffolds through the shadcn CLI, then reskin; or hand-roll if the scaffolds fight the register. Either way, one component.

Accepted when every catalog entry renders through the one component with correct ports and widgets, the seven kinds are distinguishable in a grayscale screenshot, collapse state round-trips through save and reload, and promoting a widget to an input adds a validating port and changes `content_id`.

### PG5. Typed edges and the connection law

`apps/console/src/views/program/ProgramEdgeView.tsx`, `connection.ts`, `shapeHue.ts`

Bezier edges tinted by shape class per named choice 4. During drag, `useConnection` drives the client mirror of `types_compatible`: incompatible target handles dim, compatible ones lift. On connect, the server's `validate_edge_schema` is authoritative. `EdgeSchemaStatus` renders in three honest states: valid is quiet; undetermined is dashed with an undetermined chip and never reads as valid; mismatch is refused, the edge does not land, and a toast anchored at the port names the column and both shapes from `SchemaMismatch`, never a generic invalid-connection string. `onBeforeDelete` confirms deletions that orphan required inputs. Edges are reconnectable by dragging an end.

Accepted when connecting a nullable string output into a non-null numeric input is refused naming the column and both shapes, a compatible connect lands quietly, an edge below an unfitted operation renders dashed undetermined, and no refusal anywhere shows a generic message.

### PG6. Drag-release palette and insert-on-wire

`apps/console/src/views/program/NodePalette.tsx`

`onConnectEnd` over empty pane opens a cmdk palette filtered by PG2 `valid_next` for the dragged port's shape, results cached per shape hash; selecting inserts the node at the drop point and auto-connects through PG5's law. Double-click on empty pane opens the unfiltered palette grouped by catalog group. Dropping a node onto an existing wire splices it: two edges validated, the splice atomic, refused whole if either edge fails.

Accepted when dragging from a categorical column port offers the encoders and excludes numeric-only transformers, the filtered list for a boundary equals `render_for_agent_with_catalog`'s valid next operations for the same boundary, an incompatible splice refuses atomically leaving the original wire intact, and the palette inserts and connects in one gesture.

### PG7. Run, liveness, and the dial

`apps/console/src/views/program/RunRail.tsx`, `liveness.ts`, plus the Rust seam Verify First names for run events

Run rail: Run triggers `validate_program`, then `materialize` when the definition is dirty, then a harness run. Stream events map onto `ProcessLiveness` per node: queued, running with progress, cached, done, refused. A cached node renders cached, never as freshly run. Active edges pulse while data flows. Each completed node carries a receipt chip opening the why-trace drawer. Nodes downstream of a `Rule` over derivations get the semiring dial fed by the `recalculate` action: supported, independent lines, weakest link, probability, with the why trace one click away. `ProgramAuthority::AuthorizationCommit` routes through approval before the run starts; Advisory runs directly; an Advisory program carrying an External sink is already refused by `validate_program` and the refusal surfaces on the offending node.

If Verify First finds no per-node run events exist yet, this deliverable includes emitting them server-side from the run path; the frontend does not simulate liveness.

Accepted when a run shows per-node status transitions driven by real stream events, a cached node is visibly cached, a refused node names its `ProgramRefusal`, the dial shows all four folds with the trace reachable, and an AuthorizationCommit run demands approval before executing.

### PG8. Node states, groups, notes, reroute

`apps/console/src/views/program/` and `rustyredcore_THG/crates/rustyred-thg-programmable-graph/src/model.rs` if flags are absent

Bypass passes a node's input through to its output and revalidates the rewired edges; mute disables a node and marks its downstream undetermined. Both render dimmed with distinct hatching, both are program state not view state, and both move `content_id`, so if the model lacks the flags, add them in Rust first. Groups use xyflow `parentId` subflow with a label and a neutral tint, dragging as one. Note nodes carry text, no ports, excluded from validation. Reroute is a zero-logic pass-through node whose ports adopt the incoming shape and preserve validation across it.

Accepted when bypassing a scaler mid-chain revalidates around it and changes `content_id`, muting a branch renders downstream undetermined, a group drags as one and survives reload, and a reroute preserves shape and validation.

### PG9. Subgraph to published block

`apps/console/src/views/program/publish.ts`

Multi-select a subgraph, inspect its computed `boundary_shape`, and publish through the existing apply `publish` action, which writes the `Block` node, the contract, the conformance, and the `PUBLISHED_AS` edge. Published blocks appear in the palette as catalog entries with a published source, insertable as one composite node exposing the derived boundary ports. Fork opens an editable copy with lineage named. Grants gate visibility per the existing block machinery. A selection with a dangling required input refuses with the port named.

Accepted when publishing a valid subgraph yields a Block reachable in the palette, inserting it renders one node with the derived boundary ports, forking opens an editable copy naming its lineage, and an invalid selection refuses naming the port.

### PG10. Proposal overlay: the agent as compiler

`apps/console/src/views/program/ProposalOverlay.tsx`

A `CompilerProposal` renders as a ghost layer over the open program: proposed nodes and edges at reduced opacity with an Advisory badge, and `diff_programs` output as a reviewable change list naming every add, remove, and parameter change. Accept runs `validate_proposal_before_execution` and then materializes with `compiler_id` and `compiler_receipt_id` threaded into the receipt; reject discards with the reason recorded. A proposal carrying a schema mismatch surfaces the `SchemaMismatch` inline and cannot be accepted. This is `HANDOFF-BLOCK-CONTEXT` deliverable 7 and MR6's review posture on screen, and it is the surface for north-star rung 7.

Accepted when an agent-emitted proposal renders as ghosts over the live program, the diff list names every change, accepting produces a materialized program whose receipt names the agent as compiler, and a mismatched proposal is visibly unacceptable with the mismatch named.

### PG11. Placeholders, undetermined, layout, empty

`apps/console/src/views/program/PlaceholderNode.tsx`, `layout.ts`

A program referencing an unknown catalog id opens anyway: the unknown node renders as a placeholder with its id, raw ports, and a refusal banner, and whole-program validation names it. Undetermined shapes render as undetermined everywhere, badge and dashed ports, never as zero columns. A program without stored layout takes its initial positions from `canvas_projection`, with a dagre relayout command available; positions persist per named choice 6 and reloading holds them with `content_id` unchanged. Empty state invites the palette and lists recent programs.

Accepted when a program with a missing catalog entry opens with a placeholder and a named refusal, an unfitted operation's output never renders as a column count, moving nodes and reloading holds positions while `content_id` is unchanged, and a fresh program auto-lays out.

## Verify First

- **Transport.** What the console's model and canvas views use to reach the substrate today, given `commonplace-api` is undeployed and the MCP serving tier cutover per `SPEC-THEOREM-MCP-SERVING-TIER-1.0` is in flight. PG2 rides that seam, whichever it is.
- **`model.rs` current fields.** Read before PG1 codegen: whether `ProgramNode` carries parameters, enablement or bypass flags, and how `SentinelWatch` and `ProgramTrigger` are shaped. PG4 and PG8 add Rust fields only where genuinely absent.
- **`catalog.rs`.** Whether `embedded_catalog` meets `HANDOFF-BLOCK-CONTEXT` deliverable 3's acceptance, the current `CatalogSource` variants, and whether a published-block source exists for PG9.
- **`materialize.rs`.** What `canvas_projection` emits for positions and what `ProcessLiveness` states exist, before PG7 and PG11 build on them.
- **Run events.** Whether any per-node execution events stream from harness runs today. If none, PG7's server-side half is real work; name its seam before starting.
- **Codegen tool.** Whether `ts-rs` or `schemars` is in the Theorem tree and whether MR1 landed. PG1 aligns with it.
- **Registry palette.** Whether CN2's registry-generated palette landed in `registry.tsx`; PG3 registers accordingly.
- **`@jalco/json-viewer`.** MR8 named it for shape inspection; confirm availability or substitute inside the sourcing spec's process, not silently.
- **`gate:persistence` rules.** Read `scripts/lint-persistence.mjs` so PG3's write path passes by construction.
- **React Flow UI scaffolds.** Confirm MIT at pull time and record versions, per the sourcing discipline.

## Borrowed from ComfyUI

Read for ideas only; both repos are GPL-3.0 and the frontend is GPL-3.0-only with the litegraph fork merged into it. No code adaptation.

Taken: backend-registered definitions rendered by one generic component; typed ports with connection filtering; drag-from-port release into a compatibility-filtered search; drop-on-wire splice; per-node execution status with honest cache rendering; bypass and mute; groups, notes, reroutes; missing nodes never blocking a load; the workflow traveling with the artifact, translated into sink artifacts linking program `content_id`; the run rail posture.

Not taken: any code; the litegraph canvas2D renderer and the frontend's dual rendering modes; Vue, Pinia, PrimeVue; the workflow-JSON versus API-JSON split; positions inside the program document; the custom-node install ecosystem, because publish plus Grants is the distribution story here.

## Anti-scope

- No ComfyUI or litegraph code in the tree. Read and reimplement only.
- No per-entry bespoke node components. One renderer.
- No second workflow serialization format. `ProgramDefinition` is it.
- No layout inside `ProgramDefinition` or `content_id`.
- No seven-hue node-kind palette. The hue budget, if named choice 4 stands, is spent once, on port shape classes.
- No merge with the data canvas. MR9 holds.
- No authoritative validation in the client. The mirror is advisory; the server is law.
- No execution engine in the browser.
- No simulated liveness, progress, or cache state. Stream events or nothing.
- No `localStorage`. No fixture path.
