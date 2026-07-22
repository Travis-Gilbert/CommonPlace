# AMENDMENT-02-DIAGRAM-AND-MODEL-RECONCILIATION

Amends HANDOFF-CONSOLE-ONE-BLOCK-MODEL. Reconciles two pre-redesign specs,
HANDOFF-DIAGRAM-REGISTERS-AND-MODEL and DESIGN-MODEL-SURFACE, with the block contract as it shipped
on `claude/console-dimensionality` (PR 93). Register: amendment; named choices are requirements.
Decided with Travis 2026-07-22.

Writing rules: no em dashes anywhere. No invented numbers. Status leads with what is not done.

## What this is

Two specs were written against the previous shell vocabulary: the editor well, the left tool
window, the standard right slot at 500px, the layout switcher. Their substance is sound, and in
several places they anticipated the redesign rather than conflicting with it. What is stale is
placement vocabulary, plus one gesture the shipped contract cannot currently express.

Neither spec is rewritten. Both remain the design of record for their substance. This amendment
translates the vocabulary, resolves the one conflict, and folds the render lanes into a block
family, so a head implementing either spec against the current tree does not have to guess.

## Verify first

Confirmed on `claude/console-dimensionality` before writing; confirm again if the branch has moved.

- `packages/block-view/src/types.ts`: `BlockPlacement` (`rail | dock | ground | full`),
  `BlockGeometry`, `BlockLimits`, `BlockAcceptsChildren`, `BlockSurfaceClass`, `BlockKindGlyph`,
  `BlockBodyBleed`, `BlockPresentation` with `placements` and `defaultSize`, and
  `ViewRenderProps.instance` carrying the note that it is required for container parenting
- `ObjectAction` in the same file, specifically the `move` and `link` variants
- The two subject specs
- `HANDOFF-CONSOLE-ONE-BLOCK-MODEL` (choices 2, 3, 7) and `AMENDMENT-01` (A4, the artifact-producing
  video block)
- `apps/console/src/views/blocks/` and the kanban block that shipped as the first container

Search before asserting absence. Listings truncate.

## Named choices

### 1. Placement vocabulary translation

Where the two specs name a shell location, read it as follows. This is a translation, not a
redesign of either surface.

- "editor well" becomes ground placement with `surfaceClass: "editor"`.
- "left tool window" becomes dock placement with the left edge on the instance.
- "the right inspector, the same 500px slot" becomes dock placement with the right edge. The slot is
  retired: under free geometry an inspector is resizable and movable, so 500px is an initial width
  rather than a fixed dimension. Specs that assumed a fixed slot get an initial width and a
  `minCols` clamp.
- "joins the layout switcher as a named surface" and "the stripe surfaces group" become a route
  segment plus a rail row.
- "stacked kind cards in the editor well" become kind blocks on the ground canvas.
- "constrained dnd-kit canvas" becomes ground placement with a declared drop semantic (choice 2),
  not a separate canvas implementation.

### 2. Drop semantics: `acceptsChildren` becomes `acceptsDrop`

The conflict, stated plainly. DESIGN-MODEL-SURFACE section 2 specifies that dragging one kind card
onto another creates a relation and opens the edge picker. That is a block dropped on a block
producing an edge, not a nesting. The shipped `BlockAcceptsChildren` carries exactly one semantic,
containment, so a kind card today must either accept children, which is wrong because a kind does
not contain a kind, or be inert to drops, which is wrong because that gesture is the center of the
surface.

Both semantics are legitimate. Containment is the default and is what was ratified for
block-on-block drops generally; relation is a declared exception belonging to surfaces whose blocks
represent things that connect rather than nest. Additive resolution:

```ts
export type BlockDropSemantic = "contain" | "relate";

export interface BlockAcceptsDrop {
  readonly semantic: BlockDropSemantic;
  /** contain only. */
  readonly layout?: "grid" | "stack" | "split" | "columns";
  /** relate only: the default edge; a target may open a picker to override. */
  readonly edge?: string;
  /** Descriptor ids or "*". Omitted means any block. */
  readonly accepts?: readonly string[];
}
```

`acceptsChildren` becomes `acceptsDrop` with `semantic: "contain"`; the kanban declaration migrates
mechanically. Blocks declaring neither stay inert, which is what keeps nested drag systems from
fighting.

The drop-priority rule is unchanged: the innermost declaring target under the pointer that accepts
the dragged descriptor wins, and otherwise the drop falls through to the ground canvas. Semantic
does not affect priority; it only decides what the drop emits.

Neither semantic needs a new action kind, because both already exist in `ObjectAction`:

- `contain` emits `move { id, new_parent, order }`
- `relate` emits `link { from, edge, to }`

So both produce receipts on the existing path, and a relation created by dragging a kind card is
recorded the same way a card moved into a kanban column is. Where a relate drop needs
disambiguation, the edge picker resolves the edge before emitting, and the picker belongs to the
target descriptor rather than to the drag layer.

### 3. The render lanes are artifact-producing blocks

N1, N3, and N4 of the diagram handoff (mermaid, TikZ, layerstack) join the family AMENDMENT-01 A4
opened with `video` and B8 opened with `document`. The family shape, stated once:

- The render runs server side behind a route, and its output is content-hash cached.
- The block renders source plus the cached artifact.
- The render is requested through `dispatch`, and the artifact returns with a receipt.
- The error state carries the renderer's own message, the parser message or the tectonic log tail,
  never a blank body.

This restates the diagram handoff's named choices 2, 3, and 4 in the contract's grammar rather than
as bespoke routes, and it means blocks reach the render routes through the object seam rather than
growing a second client grammar. The open transport question in that handoff's verify-first, whether
the routes live in `commonplace-api` or a sibling render service, is unchanged and still belongs to
that spec.

N2 (math) is not in this family. KaTeX renders client side inside the markdown pipeline, so it is a
property of the markdown renderer rather than a block, and its single scoped lint exemption stands
as written.

### 4. Diagram blocks want free geometry, and now have it

Under the retired preset grammar a diagram was stuck at `m`, `w`, or `full`. Notation has intrinsic
proportion: a mermaid sequence diagram is tall and narrow, a layerstack drawing is wide and short, a
class diagram is closer to square. Each diagram descriptor therefore declares `limits` sized to its
notation rather than inheriting a generic default, and declares `bodyBleed: "flush"` so the drawing
reaches the block edge. This is a capability the redesign added rather than a translation of
anything the original spec said.

### 5. The Model surface becomes more literal, not less

DESIGN-MODEL-SURFACE section 4 says the model canvas, the palette, and the inspector panels are
descriptors, and that the data model surface is itself made of the data model. Under the shipped
contract that stops being aspirational, because layouts persist as `view-instance` objects: the
Model surface's own arrangement is queryable through the same meta host it renders. One acceptance
is added to N5: the Model surface can display its own layout objects as kinds. If it cannot, the
meta host is incomplete, and that is a finding rather than a cosmetic gap.

Section 2's distinction between the constrained canvas and the React Flow programmable canvas
survives and is now carried by declaration: the model canvas is ground placement declaring
`acceptsDrop: { semantic: "relate" }` and declaring no `contain` semantic. The freeze holds because
the contract says what the surface accepts, not because a separate canvas was built.

### 6. What does not change

- The inversion in DESIGN-MODEL-SURFACE section 1: the observed model first, declaration as
  pinning, observed plus pinned and never invented. It is the surface's reason to exist and no shell
  vocabulary touches it.
- The Twenty license discipline in section 6. Reimplemented from observed behavior and extracted
  values, with no ported source. Extracted Twenty values, including the Tailwind v4 token dump and
  the motion tokens, are reference material that resolves through the register; they do not become a
  second token system, per the standing sourcing doctrine.
- The four honest backend gaps in section 5: the meta host with coverage aggregation, pinning
  writes, rule objects CRUD from IX6, and destination posteriors from IX3. The redesign closes none
  of them, and N5's discipline stands that every write affordance either performs a real write or
  names its missing capability.
- The diagram handoff's fallback discipline: a mermaid type whose mmdr output fails review falls
  back to client mermaid.js behind the same descriptor, recorded per type as a named decision, never
  silently.

## Deliverables

This amendment changes the contract and the reading of two specs. It does not restate their
deliverables; N1 through N6 and the Model surface sections keep their own.

**A2-1.** `BlockDropSemantic` and `BlockAcceptsDrop` in `packages/block-view/src/types.ts`;
`acceptsChildren` replaced on `BlockPresentation`. Package tests cover both semantics and the
inert default.

**A2-2.** Existing container declarations migrated to `acceptsDrop: { semantic: "contain" }`,
starting with the kanban block. No behavior change.

**A2-3.** The drag layer emits `move` for contain drops and `link` for relate drops, with the
priority rule unchanged and both paths returning receipts.

**A2-4.** A header note added in place to each of the two subject specs pointing at this amendment
for placement vocabulary, so a head reading either one is not misled. The specs' bodies are not
rewritten.

**A2-5.** Diagram descriptors, when N1, N3, and N4 land, declare notation-sized `limits` and
`bodyBleed: "flush"`, and declare the artifact-producer `dataNote` naming the render route and the
dispatch path.

## Acceptance

Report status as a scannable list leading with what is not done.

1. A block declaring `semantic: "relate"` receiving a drop emits `link` and returns a receipt; the
   same drop on a block declaring `semantic: "contain"` emits `move`.
2. A block declaring neither is inert to block drops, and the drop falls through to the ground
   canvas.
3. The kanban block behaves identically before and after the A2-2 migration.
4. Dropping one kind block on another on the model canvas creates a relation and never nests.
5. Both subject specs carry the A2-4 header note.
6. `pnpm gates` passes.

## Out of scope

Implementing N1 through N6 or the Model surface itself, the render-route transport decision, the
meta host and its coverage aggregation, IX3 and IX6, the React Flow programmable canvas, and any
change to the two specs' substance.
