# SPEC-DATA-CANVAS-GRAPH-NATIVE-1.0

Repo `Travis-Gilbert/CommonPlace`. Apps `apps/console`, packages `packages/block-view`,
`packages/theorem-acp`, and a new `packages/json-canvas`. Register: execution handoff; named
choices are requirements.

The data canvas is a graph-native spatial surface, not a foreign document format. It renders and
arranges real graph objects, persists arrangement as graph state, and speaks JSON Canvas 1.0 only
at its edge for import, export, and Obsidian interop. It is a block with a block contract, so it can
open in a pane or a collapsible companion rail on the web and desktop surfaces.

Writing rules: no em dashes anywhere, in code, comments, UI strings, or this doc. No invented
numbers. Status leads with what is not done. Search before asserting absence; listings truncate.

## The decision, stated so no head reopens it

Two formats were on the table for the data canvas, plus a third shape that was not.

- Obsidian JSON Canvas 1.0 (obsidianmd/jsoncanvas): two arrays (`nodes`, `edges`), four node
  types (`text`, `file`, `link`, `group`), six preset colors whose values apps define, MIT,
  extensible with ignored custom fields, roughly 3KB of spec. A knowledge canvas format.
- Pen Schema v1 (`jian-ops-schema`, ZSeven-W/openpencil): the document model for `.op` files. In
  OpenPencil's own words an `.op` file is an app. It describes vector-design and declarative-UI
  documents, driven by the jian GPU-Skia runtime, with widgets, taffy flexbox layout, a StateGraph,
  an Action DSL, and expressions. A design-tool format, meaningful only with its runtime.

Pen Schema is rejected as the canvas model. It is the wrong category (design documents, not
knowledge arrangements), and its value is unreachable without the jian and OpenPencil renderer,
which this product is not building. Adopting it would buy a heavier format with no renderer we own.

JSON Canvas is not adopted as the model either, because a foreign canvas file as the source of
truth is a second source of truth, which the standing architecture forbids (the graph is the only
source of truth; secondary models are lenses over the one graph store, never copies). JSON Canvas is
adopted as the interchange lens at the edge only.

The model is the graph. The canvas is a lens over graph objects, arrangement is graph state, and the
block contract already carries every action the canvas needs. This is the third shape, and it is the
one that ships.

## Verify first

Two of these decide the shape of the work and lead the first status report.

1. Whether a canvas object type and an arrangement persistence pattern already exist. AMENDMENT-02
   states that layouts persist as `view-instance` objects, and the Goal Stack persists pinned node
   positions through a `pin_position` action. Find the real mechanism before creating a parallel
   one. If a `view-instance` type carries per-object positions, the canvas arrangement rides it. If
   not, D1 defines the placement objects. Search the type or shape registry and
   `apps/console/src/views/goal-stack/` for how pins persist today.
2. Which block placement vocabulary is current on the target branch. The default-branch
   `packages/block-view/src/types.ts` confirmed this session uses `MountPoint`
   (`stripe | chrome | island | surface | companion`), `BlockSize` (`s | m | v | sq | w | full`),
   and `BlockPresentation` with `mounts`, `sizes`, `density`, `surfaceClass`, `kindGlyph`,
   `bodyBleed`. AMENDMENT-02 describes a dimensionality vocabulary (`BlockPlacement`
   `rail | dock | ground | full` with free geometry). Declare the canvas placement in whichever
   vocabulary the target branch actually carries. Do not assume the amendment has landed.
3. Whether an Obsidian sync seam exists in the repo today. The phone surface is stated to stay on
   Obsidian. If a sync pipe exists, D6 wires JSON Canvas through it. If it does not, D6 is file
   import and export through the existing files surface, and live Obsidian sync is a later spec.
   Search for `.canvas`, `obsidian`, and any sync worker before assuming a pipe exists.
4. The confirmed block contract this spec binds to: `packages/block-view/src/types.ts` at HEAD.
   `BlockHost.query(ObjectQuery): MaybePromise<ObjectSet>` and
   `BlockHost.emit(ObjectAction): Promise<Result<ObjectActionReceipt>>`. `ObjectAction` includes
   `create`, `update`, `move`, `delete`, `link`, `unlink`, `open`, `select`, `run_agent`,
   `invoke_tool`, `dispatch`. `ObjectRef` carries `properties`, `relations`, and
   `axes` (`h3`, `valid`, `embeddable`). `ViewDescriptor` carries `accepts` (`ObjectShapeMatch`),
   `emits` (`ActionKind[]`), `render`, `source` (`ViewSource`), and optional `block`
   (`BlockPresentation`). Read in full this session.
5. `apps/console/src/views/registry.tsx`, where view descriptors register. Confirmed present, not
   read in full. The canvas descriptor registers here.

## Named choices

### 1. The model is the graph, not a canvas file

A canvas is a graph object. A card on the canvas is a reference edge from the canvas object to a
real graph `ObjectRef` (a note, a captured page, a run, a memory, a document). A connection drawn on
the canvas is a graph edge. The canvas holds no copy of the referenced object's content; it
references it. This is what makes an arrangement a graph query away rather than a file to parse, and
it is why the data canvas grows the data-gravity moat rather than sitting beside it.

All reads and writes route through the block host. Placing a card runs a `query` or references an
existing id and emits `create` plus `link` for the card membership. Moving a card emits `move` or an
`update` patch on its position. Drawing a connection emits `link`. Removing a connection emits
`unlink`. Deleting a card emits `unlink` from the canvas, never a `delete` of the referenced object
unless the user explicitly deletes the object itself. Every write returns an `ObjectActionReceipt`.

### 2. Arrangement persists graph-native

Per-card position (`x`, `y`, `width`, `height`, optional `z`), edge routing (`fromSide`, `toSide`),
group membership, and preset color persist as graph state, resolved through Verify First item 1. If
a `view-instance` type carries these, the canvas is a `view-instance`. If a dedicated placement
object is cleaner, D1 defines a `CanvasPlacement` shape keyed by `(canvas_id, object_id)`. Either
way the arrangement is queryable, provenance-carrying, and synced through the same graph transport as
any other graph state. No sidecar `.canvas` file is the truth.

### 3. JSON Canvas 1.0 is the interchange lens at the edge

Import and export map between the graph-native canvas and a spec-valid JSON Canvas 1.0 document.

Export mapping:
- A card referencing a text-bearing object becomes a `text` node carrying a Markdown projection, or
  a `file` node when the object resolves to a file path in the files surface.
- A card referencing a URL object becomes a `link` node.
- A card referencing any other graph object becomes a `file` node whose `file` is a stable
  reference, plus a custom field carrying the graph object id (spec-valid; other apps ignore unknown
  fields).
- A group becomes a `group` node.
- A connection becomes an `edge` with `fromNode`, `toNode`, and, when present, `fromSide`, `toSide`,
  `label`, `color`.
- Every exported node and edge carries a custom field with its originating graph id and, where it
  exists, the arrangement's provenance reference, so a re-import reconstructs identity rather than
  duplicating.

Import mapping is the reverse, resolving custom graph-id fields when present and otherwise creating
or matching graph objects: `text` to a note, `file` to a graph object by path or a new object,
`link` to a URL object, `group` to a container. Import validates the document against the JSON Canvas
1.0 structure first and rejects malformed input with a named reason, never a silent partial.

Named choice: colors are the six presets mapped to console tokens. Reuse the existing preset-to-token
mapping if one is present in the tree; otherwise define it in D5. Hex colors are accepted on import
and preserved round-trip on the objects that carried them, and presets are what the canvas emits.

### 4. The canvas is a block with a block contract

The canvas registers as a `ViewDescriptor` with a `BlockPresentation`, so it mounts in a pane and in
the collapsible companion rail. Using the confirmed default-branch vocabulary:

- `mounts`: `["surface", "companion"]`. `surface` is the full-pane form. `companion` is the
  collapsible rail-adjacent form. If the target branch carries the dimensionality vocabulary
  instead, declare `rail` and `full` per AMENDMENT-02 and record which vocabulary shipped.
- `sizes`: include `v` (the vertical 3x5 span) for the rail form and `full` for the pane form.
- `surfaceClass`: `editor`.
- `kindGlyph`: `canvas`. This value is not in the `IslandKindGlyph` union today, so D6 adds it.
- `bodyBleed`: `flush`, so the canvas reaches the block edge.
- `accepts`: a broad `ObjectShapeMatch` admitting spatial-capable object sets (any object the user
  can place). `emits`: `["create", "update", "move", "link", "unlink", "delete", "open", "select"]`.

### 5. The renderer is React Flow, already in the tree, wrapped as a view source

`@xyflow/react` is already sourced by the Goal Stack canvas and is a sufficient infinite-canvas
renderer for cards and edges. The canvas view declares
`source: { package: "@xyflow/react", component: "ReactFlow", mode: "wrap", regime: "css-vars" }`.
No foreign design runtime is adopted. If a lighter dedicated infinite-canvas library is later
preferred, it is a bounded swap behind this descriptor, and React Flow is the default only because it
is present and the goal-stack already proves it renders cards, edges, panning, and pinning.

### 6. Agent authorship goes through the same seams, not through bytes

An agent arranges or edits a canvas one of two ways, both bounded and receipted. It emits
`ObjectAction`s directly (`create`, `link`, `move`, `update`), or it emits a JSON Canvas document
that the D3 importer validates against the spec and applies as `ObjectAction`s. An agent never writes
into a foreign design format, and the bounded vocabulary (JSON Canvas's four node types plus the
graph's own types) is what keeps agent output constrained and reviewable. This is the same authorship
discipline the earlier canvas work identified: a model editing a canvas chooses among enumerations,
it cannot author style.

### 7. Distinct from the programmable DAG, shared substrate

The data canvas is its own descriptor. It does not render the programmable DAG, and the programmable
DAG does not render through it. The DAG keeps its typed projection (`programmable-graph-canvas/1`,
`PlanCanvasSnapshot`) and its computed layout. The two share the substrate, both are blocks under one
contract, and both persist arrangement graph-native, and both may mount in the rail, but neither is
the other's format. Named here so no head merges them into one surface.

### 8. Obsidian stays at the edge

JSON Canvas import and export is the Obsidian interop path. The phone surface stays on Obsidian by
reading and writing `.canvas` files at the edge. No Obsidian format enters as the internal model, and
no two-way live Obsidian sync is in scope here (see Verify First item 3 and Out of scope).

## Deliverables

### D1. The canvas object model and arrangement persistence
Files: the type or shape registry (path pending Verify First item 1), plus a placement definition if
a `view-instance` does not already carry positions.

Define the canvas object, the card membership edge to referenced `ObjectRef`s, the connection edge,
and the per-card arrangement fields (`x`, `y`, `width`, `height`, optional `z`, side hints, preset
color, group membership). Persist arrangement as graph state through the resolved mechanism.

Acceptance: creating a canvas, placing a reference to an existing graph object, and moving it produces
graph state that a query returns without reading any file; the referenced object is unchanged;
removing the card unlinks it from the canvas and leaves the referenced object intact; the arrangement
is tenant-scoped.

### D2. The JSON Canvas interchange package
File: `packages/json-canvas/` (new), TS types plus the bidirectional mapping from named choice 3.

Ship JSON Canvas 1.0 TS types (`CanvasNode` union, `CanvasEdge`, `CanvasData`), a validator that
rejects malformed input with a named reason, and `toJsonCanvas(canvas)` and
`fromJsonCanvas(document)` mapping to and from the D1 model, carrying graph ids and provenance in
custom fields.

Acceptance: exporting a canvas produces a document that validates against JSON Canvas 1.0 and opens
in Obsidian; importing the JSON Canvas sample document produces graph objects and placements;
export then import then export is stable on ids and topology (a round-trip property test against a
fixture set, including a document that carries hex colors, which are preserved); an invalid document
is rejected with a named reason and never applied partially.

### D3. The canvas view and block
Files: `apps/console/src/views/canvas/CanvasView.tsx` (new) and registration in
`apps/console/src/views/registry.tsx`.

Render the D1 canvas through React Flow: cards as nodes, connections as edges, panning, group nodes,
drag to move emitting `move` or `update`, connect emitting `link`, disconnect emitting `unlink`,
delete emitting `unlink` from the canvas. Declare the `ViewDescriptor` and `BlockPresentation` from
named choice 4. Reads and writes go through `BlockHost.query` and `BlockHost.emit`.

Acceptance: the canvas renders referenced graph objects as cards; dragging a card persists its
position through a receipted `move` or `update`; drawing a connection persists a receipted `link`;
the block mounts as `companion` at size `v` in the rail and as `surface` at `full` in a pane; the
canvas contents are a graph query, not a file read.

### D4. Agent authorship path
Files: the D2 package plus the console action seam.

Wire the two authorship routes from named choice 6: direct `ObjectAction` emission, and emit a JSON
Canvas document that the D2 validator checks and the seam applies as `ObjectAction`s.

Acceptance: an agent-emitted JSON Canvas document that validates is applied as receipted
`ObjectAction`s and appears on the canvas; an invalid one is refused with a named reason and applies
nothing; a direct `link` emitted by an agent appears as a connection with a receipt.

### D5. Preset color to token mapping
Files: the D2 package plus the console register tokens.

Map the six JSON Canvas presets to console tokens. Reuse an existing mapping if present; otherwise
define it here. Accept hex on import, preserve it round-trip on the carrying object, emit presets.

Acceptance: a canvas colored with presets exports preset color values and re-imports to the same
console token rendering; a document authored elsewhere with hex colors imports, renders through the
nearest token, and re-exports its original hex on the objects that carried it.

### D6. Block contract additions and the Obsidian edge
Files: `packages/block-view/src/types.ts` for the glyph, plus the files surface or the sync seam per
Verify First item 3.

Add `canvas` to `IslandKindGlyph` (or the equivalent glyph enum on the target branch). Wire JSON
Canvas import and export at the edge: through the Obsidian sync seam if one exists, otherwise through
file import and export in the files surface.

Acceptance: the canvas block header resolves the `canvas` glyph; a `.canvas` file exported from the
canvas opens in Obsidian and re-imports with fidelity; if a sync seam exists, a canvas round-trips
through it, and if it does not, the file import and export path round-trips and live sync is recorded
as out of scope.

## Acceptance, system level

Report status as a scannable list leading with what is not done.

- A user places graph objects on a canvas, draws a connection between two of them, and the whole
  arrangement is returned by a graph query with no file involved.
- Export produces a spec-valid JSON Canvas document that opens in Obsidian; import of an Obsidian
  `.canvas` produces graph objects and placements, and a round-trip is stable on ids and topology.
- The canvas is a block that mounts in the collapsible companion rail at a vertical size and in a
  full pane, resolving the `canvas` glyph.
- An agent authors an arrangement by emitting `ObjectAction`s or a validated JSON Canvas document,
  never by writing a foreign format, and every write carries a receipt.
- The programmable DAG is untouched and remains its own descriptor.
- `pnpm gates` passes.

## Out of scope

The OpenPencil and jian renderer, and Pen Schema as a canvas model. Consuming OpenPencil over MCP for
actual vector design work is a separate later spec with its own trust and rendering story, and nothing
here depends on it. Any change to the programmable DAG's projection or the Goal Stack. A durable
two-way live Obsidian sync if no seam exists today; import and export is the edge for now. The
force-directed or scatter surfaces, which are their own specs.
