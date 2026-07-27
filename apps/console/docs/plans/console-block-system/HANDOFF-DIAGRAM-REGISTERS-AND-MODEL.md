# HANDOFF-DIAGRAM-REGISTERS-AND-MODEL

> Placement translation note, 2026-07-26: This pre-redesign handoff is
> retained unchanged below. Read "editor well" as ground placement with
> `surfaceClass: "editor"`; "left tool window" and the fixed right inspector
> as left and right dock placements; "layout switcher" and "stripe surfaces"
> as a route segment plus rail row; and the constrained dnd-kit canvas as
> ground placement with a declared drop semantic. See
> `AMENDMENT-02-DIAGRAM-AND-MODEL-RECONCILIATION.md`.

Repo `Travis-Gilbert/CommonPlace` (console) with one render seam in the Rust data API. Register: execution handoff; named choices are requirements. Companions in force: DESIGN-MODEL-SURFACE (the design this implements), TWENTY-APP-VALUES, SPEC-MDT-CONSOLE-FIXTURE, AMENDMENT-SCENE-OS-INTUI (grammar graduation path).

Scope sentence: the console learns to render notation (mermaid, math, TikZ, and the layerstack architecture-drawing grammar) as document descriptors, and the Model surface lands in its observed-first v1.

## Named choices

1. Every renderer here is a view descriptor over document content in the existing registry. No bespoke pages, no iframe embeds.
2. Mermaid renders through mmdr (`mermaid-rs-renderer`, MIT, pure Rust) embedded server side behind a render route, SVG cached by content hash. Theme flows from the register: a themeVariables config generated from `--ij-*` values (Inter, 13px, chrome and accent colors), never hand colored. mmdr is early software; acceptance gates the four core types, and any type whose output fails review falls back to client mermaid.js behind the same descriptor, recorded per type as a named decision, never silently.
3. Math is KaTeX in the markdown path (`rehype-katex` in the console markdown pipeline). KaTeX ships its own stylesheet; it enters as one vendored file with a scoped lint exemption, the only such exemption, documented in the register lint config. Upstreaming math to markdown-theory is a later SPEC-MDT addendum.
4. Full LaTeX and TikZ render through tectonic (Rust LaTeX engine) server side: `.tex` to SVG via dvisvgm, content-hash cached. This is the fidelity lane for awesome-latex-drawing class content and for raw PlotNeuralNet sources.
5. The layerstack grammar is the PlotNeuralNet answer: a small declarative grammar (layers with kind, channels, spatial dims, label; connections; skip paths; groupings) rendered natively to SVG isometric volumes. It registers as `diagram.layerstack` and is designed to graduate into a SceneHost grammar when `packages/scene-host` lands. The visual language is content register, like the patent drawings: warm volume faces, teal flow arrows, mono dimension labels, on the editor well. PlotNeuralNet itself is the fidelity oracle: the same architecture rendered through the grammar and through the tectonic lane should read as the same drawing.
6. The Model surface ships observed-first per DESIGN-MODEL-SURFACE: kinds, fields with coverage, relations with evidence, view-records jump. Pinning and violations stay v2. Rule attachment renders only if the rules CRUD (IX6) exists by then; otherwise the affordance shows its unavailable state naming IX6. No fixture meta objects on user-reachable routes.

## Deliverables

### N1. Mermaid lane
Build: `mmdr` embedded in the data API (or a sibling render service if the API crate should stay lean; verify-first decides) behind `POST /render/mermaid` taking source and returning SVG with a content-hash cache header; the console `diagram.mermaid` descriptor rendering fenced ```mermaid blocks in markdown documents and standalone `.mmd` objects through the route; the register-derived themeVariables config generated at build from the token file, both themes.
Acceptance: the four core types (flowchart, sequence, class, state) render themed and legible in the editor well at 1280 and 1440; a repeated render of identical source is a cache hit; a syntactically invalid diagram renders the error state with the parser message, never a blank; fallback decisions, if any, are recorded per type in the descriptor file header.

### N2. Math
Build: KaTeX wired into the console markdown pipeline for inline and display math in `markdown.doc` and thread messages; the vendored stylesheet with its scoped exemption; display math respects the measured column.
Acceptance: a fixture brief with inline and display math renders correctly in Galley reading view and in a thread message; the register lint passes with exactly one documented exemption; math in a 640px pane wraps or scrolls without clipping glyphs.

### N3. TikZ lane
Build: tectonic behind `POST /render/tex` producing SVG, content-hash cached, with a compile timeout and a size cap; the `diagram.tex` descriptor for `.tex` objects and fenced ```tikz blocks; errors surface the tectonic log tail in the error state.
Acceptance: three drawings from the awesome-latex-drawing corpus and one stock PlotNeuralNet architecture compile and render in the editor well; a failing source shows the log tail; the route enforces its timeout and cap; repeated compiles are cache hits.

### N4. The layerstack grammar
Build: the grammar type (`LayerstackSpec`: ordered layers with kind, channels, dims, label; connections; skips; groups), the SVG renderer on register tokens with isometric projection, depth stacking, flow arrows, and mono dimension labels; the `diagram.layerstack` descriptor; two committed fixtures reproducing the two reference images (the FCN-style deconvolution net and the VGG-style classifier) from grammar source; an agent-facing note in the descriptor file documenting the spec shape so threads can emit it.
Acceptance: both fixtures render recognizably as the reference drawings to a person who has seen PlotNeuralNet output; the same VGG fixture rendered through N3 from its original `.tex` and through N4 from grammar source read as the same drawing; skip connections route below the stack per the reference look; all colors and type resolve to tokens; reduced motion is irrelevant (static) and the SVG carries accessible labels per layer.

### N5. Model surface v1
Build: per DESIGN-MODEL-SURFACE sections 2, 4, and 5: the meta host answering `object_kind`, `field_def` (observed, with coverage), and `relation_def` queries; the model canvas editor document (stacked kind cards, relation lines, dnd-kit drag for relation creation where the seam accepts writes, otherwise read-only with the write affordance in its unavailable state); the field palette tool window; inspector panels for kind, field, and relation; view-records applying the Index layout filtered to the kind; the Model surface joins the layout switcher and the stripe surfaces group.
Acceptance: the canvas renders the tenant's real observed kinds with live coverage numbers; selecting a field shows sample values from real records; view-records lands on the Index filtered correctly; every write affordance either performs a real write or names its missing capability; the surface passes the register and motion lints.

### N6. Gates
Build: render-route contract tests from captured outputs; a visual baseline per renderer (mermaid core four, one math brief, one TikZ drawing, both layerstack fixtures, the model canvas); cache-hit assertions; the lint exemption test proving exactly one exemption exists.
Acceptance: CI blocks merge on all; baselines regenerate deterministically from fixtures.

## Verify first

- Where the render routes live: inside `commonplace-api` or a sibling `render` service on Railway; tectonic's binary and TeX bundle footprint on the Railway image decides (tectonic downloads packages on first use; the image needs a warm cache or a pinned bundle).
- The data API's ability to aggregate field coverage per kind (distinct kinds exist; coverage percentages may need a new aggregation query). If absent, N5 ships kinds and relations with coverage in its unavailable state and the aggregation lands as a named API task.
- mmdr output quality at our theme for the diagram types beyond the core four that documents actually use (check ER and gantt early).
- dvisvgm availability alongside tectonic on the deploy image, or the SVG-producing alternative tectonic supports.
- dnd-kit relation-write path: whether the seam exposes relation declaration today or v1 ships read-only.

## Out of scope

Pinning and violation flow (model v2), rule authoring (IX6 owns it), the React Flow canvas, mermaid editing UX beyond source-and-render, and any use of layerstack outside the descriptor (its SceneHost graduation is the amendment's concern).
