# HANDOFF-CONSOLE-ISLANDS-AND-MATERIAL

Repo `Travis-Gilbert/CommonPlace`, app `apps/console`, sitewide. Register: execution handoff; named choices are requirements. Decided with Travis 2026-07-20 after a side-by-side of his IntelliJ (new UI islands with the Material theme) against the console. This is the highest-leverage sitewide change on the board: the shell adopts the Islands layout model, and paint leaves CSS for a shader-rendered Material Layer. Companions: 33-RULING-OBJECT-SYSTEM (this handoff gives all three systems one material engine), 14-HANDOFF-CONSOLE-DIMENSIONALITY (its lints evolve here as specified), int-ui-register.css and the light register (token sources for the shader uniforms), the reference proof `islands-material-proof.html` (renderings are the spec).

## The diagnosis this implements

What the side-by-side showed: modern IntelliJ renders tool windows as floating rounded islands separated by gutters where a darker frame shows through, each island subtly elevated and lit. The console implemented the older flush-seam model. The perceived richness gap is two things: the Islands layout model (gaps, curvature, frame gutters, elevation) and the material (per-surface luminance gradient, lit top edge, film grain, shadows into the gutters). CSS cannot produce the second well (banding gradients, no dithering, no grain), so the paint moves to a shader while the DOM keeps text, layout, focus, and hit testing.

## Named choices

1. The Islands layout model, sitewide: panels are rounded islands (radius 10) separated by 10px gutters on the frame ground. The frame is visibly darker than islands in dark and visibly toned in light. Tool windows, the editor well, companions, and the terminal are all islands. Exact constants verify against the JetBrains islands theme values in intellij-community before pinning (10 and 10 are the observed working values from the proof and the owner's IDE).
2. The Material Layer: one full-viewport WebGL canvas under the DOM renders every shell surface. Fragment shader per pixel: SDF rounded rectangles for islands, shadow falloff into the gutters (offset downward, soft), vertical luminance gradient per island (roughly 3 percent, brighter at top), a lit top edge (about 1.5px), film grain that also dithers the gradients (banding is structurally impossible), hairline boundary in dark. All colors arrive as uniforms resolved from the register tokens at render time; the shader knows no hex.
3. The DOM paints nothing in shell regions. Backgrounds, borders, and shadows are deleted from shell CSS; the paint-required lint from the dimensionality handoff inverts for shell regions into a paint-forbidden scan (a shell region resolving any background or border fails CI). Text, controls, focus rings, selection, and hover states remain DOM (hover fills are allowed as translucent overlays since they are interaction states, not material).
4. Rendering is static: the layer re-renders on layout change, resize, theme change, and panel movement only, synced from the DOM by ResizeObserver. Zero idle GPU. An ambient mode (slow grain drift) may exist later behind the motion inventory; it is not in this round.
5. Fallback: if WebGL is unavailable, a Canvas2D path renders the same model (flat fills, box shadows, no grain); if canvas is unavailable, a CSS fallback class restores minimal painted backgrounds. Both fallbacks are honest and unadvertised.
6. One material engine, three systems: the object surfaces' lifted cards (33-RULING) render through the same layer as island children (cards are islands with smaller radius and lighter shadow), so the Capacities system and the IntelliJ shell share one light model. The existing GroundCanvas and the Composer sheen fold into the layer as regions with their own material parameters rather than separate canvases.
7. Declutter law, sitewide: no self-narrating copy. Text that restates a visible affordance is deleted ("Start from live tenant context", "Shift + Enter for a new line" as standing chrome, and their kin). Empty states show structure and affordances, never narration. The wordmark leaves the toolbar: the surface switcher stands alone at top left; the product does not announce its own name inside itself.
8. Spacing rules adopt the island constants: the 10px gutter is the only inter-island space; inside islands the existing 4px grid governs; nothing sits flush against anything at the shell level. "Everything lines up to the next thing" is the defect this rule ends.
9. Curvature and elevation are shell properties, not component properties: components never set radius or shadow at the shell level; the layer owns both.

## Deliverables

### N1. Island layout pass
Build: the shell grid re-spaced to gutters and radius per named choice 1; splitter handles become gutter-resident (drag targets living in the gaps); the frame ground exposed in all gutters; per-surface arrangement snapshots preserved.
Acceptance: every panel boundary shows frame through a 10px gutter; radius 10 on all islands; splitters still drag and persist; both themes.

### N2. The Material Layer
Build: the layer component (full-viewport WebGL1 canvas, DOM-synced island registry via ResizeObserver and mutation of the panel tree, devicePixelRatio-aware, static render scheduling) with the uniform bridge resolving register tokens per theme.
Acceptance: layout changes re-render within one frame; idle GPU and CPU are zero (profiled and recorded); token changes (theme flip, knob presets) restyle the layer with no component edits; teardown leaks nothing across route changes.

### N3. The shader
Build: the fragment shader per named choice 2, matching the committed proof's visual behavior (SDF islands, gutter shadows, gradient, top light, grain-as-dither, dark hairline), parameterized per island class (shell island, lifted card, composer) so the object system's cards render through the same pass with their own radius and shadow weights.
Acceptance: side-by-side captures against the proof match in both themes; a gradient-banding probe (large island, low-contrast gradient) shows no banding at any zoom; grain intensity is a single uniform tied to a register token.

### N4. CSS paint deletion and the inverted lint
Build: removal of all shell-region backgrounds, borders, and shadows from CSS; the paint-forbidden scan for shell regions in CI (inverting the dimensionality paint-required scan for these regions while keeping it for content-plane text containers); hover and selection states re-expressed as translucent overlay utilities.
Acceptance: the scan fails a probe shell region that paints; visual baselines confirm no double-painting seams; the register lint stays green.

### N5. Declutter pass
Build: the self-narrating-copy audit across all surfaces with deletions per named choice 7; the wordmark removal; the empty states re-checked against "structure and affordances, never narration."
Acceptance: a copy inventory lands in the PR listing every deleted string with its screen; no instructional text remains that restates a visible affordance; the toolbar's left edge is the switcher.

### N6. Gates
Build: baselines regenerated sitewide both themes; a parity capture against the owner's IntelliJ islands screenshot as evidence (not a pixel gate); the perf budget assertions (static render time, zero idle) in CI; the fallback paths exercised in a headless run.
Acceptance: CI blocks on all; the five signatures still pass, re-read against islands (seam inversion becomes gutter inversion: the frame in the gutter is darker than both adjacent islands, asserted on rendered pixels).

## Verify first

- The JetBrains islands theme constants in intellij-community (gutter, radius, elevation values) before pinning 10 and 10.
- WebGL context behavior inside the Tauri WebViews (the desktop shell consumes this layer; confirm context limits and DPR handling).
- ResizeObserver flood behavior during splitter drags (throttle to animation frames; the render is cheap but should coalesce).
- The GroundCanvas and Composer sheen fold-in order (the sheen's state-bound behavior survives as a region parameter set; its tests carry).
- Focus-visible and selection rendering on unpainted DOM (ensure focus rings remain fully visible over shader surfaces in both themes).

## Out of scope

Shader ambience and motion (inventory-gated, later), the sidebar rethink (its own conversation, noted), the masonry-by-relevance idea for proactivity (banked: card scale and position by salience is a Survey-adjacent layout worth a future pass), and any mobile application of the layer (mobile's material is Clay per its own language doc; a native sibling of this layer is a later decision).
