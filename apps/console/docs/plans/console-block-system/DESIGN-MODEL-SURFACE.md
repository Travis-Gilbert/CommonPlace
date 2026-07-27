# DESIGN-MODEL-SURFACE

> Placement translation note, 2026-07-26: This pre-redesign brief is retained
> unchanged below. Read "editor well" as ground placement with
> `surfaceClass: "editor"`; "left tool window" and the fixed right inspector
> as left and right dock placements; "layout switcher" as a route segment plus
> rail row; and the constrained dnd-kit canvas as ground placement declaring
> `acceptsDrop: { semantic: "relate" }`. See
> `AMENDMENT-02-DIAGRAM-AND-MODEL-RECONCILIATION.md`.

Register: design brief, pre-handoff. The data model surface for the console: where kinds, fields, relations, destinations, and the automations attached to them are seen and shaped. Grounded in HANDOFF-INDEX (destinations, filing posteriors, rules as data IX6), DATAWAVE (field-facts, declared entity edges, HelperSpecs), HANDOFF-DOCUMENT-TYPES T3 (kind inference), NORTH-STAR-PROGRAMMABLE-GRAPH (the ladder and the freeze), and PR 53 (per-site policy as precedent for scoped rules). Twenty's data model editor supplies the interaction grammar; the substrate supplies an inversion Twenty cannot make.

## 1. The inversion that makes it Theorem's

Twenty's model is declarative: you define objects and fields, then data fills the shape you declared. The model is what you told it.

Theorem already has data before anyone declares anything. DATAWAVE ingest emits field-facts and declared entity edges from whatever arrives; T3 infers kinds. The substrate holds a de facto schema with evidence behind every part of it. So the Model surface renders the observed model first: kinds as cards, each field with coverage (sender present on 94 percent of correspondence atoms), each relation with its evidence count, everything carrying the same confidence the rest of the graph carries.

Declaration becomes pinning. Promote an observed field to expected, and arrivals missing it become Needs-you items instead of silent gaps. Declare a relation the substrate should maintain. Add a field a connector should map. The model is a reconstruction with a human hand on it, which is the house epistemics applied to schema: observed plus pinned, never invented.

The one-line contrast: Twenty's model is what you told it; Theorem's model is what it learned, plus what you pinned.

## 2. The interaction grammar (Twenty's, kept)

- Stacked kind cards in the editor well, one card per kind, standard and custom alike.
- A field palette in the left tool window, grouped by category: identity, text, number, time, select, relation, and the category Twenty does not have, provenance (source_ref, confidence, evidence, entity_edge). Drag a type onto a kind card to add a field.
- Drag one kind card onto another to create a relation; the drop opens the edge picker (edge semantics and cardinality: contains, references, sender, about-entity). Relations render as lines connecting the stacked cards. This is the connect gesture.
- Layering is field groups: shared fact bundles (a correspondence trait carrying sender and thread_id) that multiple kinds compose, rendered as a band crossing every card that carries the group. This is the layer gesture, and it is composition, not inheritance.
- Selection opens the right inspector (the same 500px slot): kind shows its field table, coverage, and a view-records jump; field shows type, coverage, sample values, and its automations; relation shows evidence and cardinality; rule shows predicate, action, and hit count.
- View records applies the Index layout filtered to the kind: the model and the data are one layout switch apart in both directions.

This surface is a constrained dnd-kit canvas, not the React Flow programmable canvas. The distinction is deliberate and protects the freeze.

## 3. Automations from the model (the synthesis with the programmable graph)

Twenty attaches workflows to objects. The equivalent here needs no new machinery, because HANDOFF-INDEX already defines it: rules are data (predicate to destination, priority, or notify level), watch queries are destinations, and PR 53 shipped a scoped policy object before the pattern had a name.

So every model element carries an add-automation affordance that creates a rule object scoped to that element:

- Kind scope: on arrival (file toward, notify at level, delegate For me with a prepared context pack).
- Field scope: on change or threshold (a number crosses a line, a status flips, a field goes missing against a pin).
- Relation scope: on connect (a new edge of this type appears; the sentinel case "tell me when something contradicts X" is a watch query attached here).

Rules render as chips pinned to the element they govern, so standing behavior is visible on the model rather than buried in settings. Every rule is an object; the Fix popover's "always do this" (IX6) creates the same objects from the other direction.

The programmable graph relationship, stated plainly: this ships rung one of the ladder (sentinels as scoped watch queries, rules as data) entirely inside HANDOFF-INDEX scope, so the launch freeze holds. When the canvas arrives later, it renders these same rule objects as nodes; nothing built here is thrown away, and the model surface is where simple automations continue to live even after the canvas exists, the way a spreadsheet keeps its cell formulas after macros arrive.

The filing engine closes the loop: each kind card shows its destination flows with the trailing precision and zone from IX3 (this edge files at 0.97, Auto unlocked; that one is Flagged). The model surface is thereby the control room of the filing engine, a thing Twenty's editor has no analog for, because Twenty's model has no learner underneath it.

## 4. System fit

Everything above is objects served by hosts: object_kind, field_def (with an observed versus pinned flag), field_group, relation_def, rule, destination. The model canvas, the palette, and the inspector panels are descriptors. The meta-model rides the same block-view contract as everything else, which means the data model surface is itself made of the data model, and the second-arrangement-with-zero-code property applies to it like any surface.

Shell placement: Model joins the layout switcher as a named surface. Left tool window holds the kind list and the palette; the editor document is the model canvas; the inspector is the standard right slot. The omnibar's Objects mode (`@`) resolves kinds and fields once this host exists, which makes the model addressable from anywhere.

## 5. Honest backend gaps (what the surface needs that may not exist yet)

1. A meta host: kinds, field defs with coverage stats, and relation defs queryable as objects. Kind inference exists (T3); the coverage aggregation over field-facts is likely a new engine query.
2. Pinning writes: a pinned field or relation is a standing assertion. The commitment machinery (commitment_check, supersede, retract) is a candidate implementation, which would make schema pins first-class commitments with the same lifecycle as every other standing decision. Flagged as an option, not assumed.
3. Rule objects CRUD: IX6 builds this; the model surface consumes it.
4. Destination posteriors readable per kind and destination: IX3 builds this.

Sequencing that follows: v1 of the Model surface (observed model, relation and rule attachment, destination readouts) lands after IX3 and IX6 exist; pinning and violation flow is v2. This brief banks the design so the Index rounds build toward it instead of past it.

## 6. Twenty license note, restated

The grammar above is reimplemented from observed product behavior and the extracted values in TWENTY-APP-VALUES. No Twenty component source is ported; the AGPL lane discipline from that document applies unchanged.
