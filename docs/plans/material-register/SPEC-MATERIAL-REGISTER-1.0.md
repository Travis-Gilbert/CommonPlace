# SPEC-MATERIAL-REGISTER-1.0

Repo `Travis-Gilbert/CommonPlace`, app `apps/console`, packages `packages/block-view`.
Register: execution handoff; named choices are requirements.

Defines the console's material system: what every visual property means, and the measured floors
each must meet. Companion to SPEC-ISOMETRIC-REGISTER, which this treats as the paint reference for
node surfaces, and to HANDOFF-FORME-TYPE-SYSTEM, which produces the `DischargeState` values the
texture axis renders.

Writing rules: no em dashes anywhere, in code, comments, UI strings, or this doc. No invented
numbers; every threshold here is either a measured floor to be verified with a tool or a named
choice. Status leads with what is not done. Search before asserting absence; listings truncate.

## The diagnosis this corrects

Stated as measurable properties so the work can be verified rather than argued about.

1. The lightness histogram has a single narrow peak. Ground, rail, pane, panel, and input surfaces
   all sit in one narrow band, and body text sits far below it with nothing between. The interface
   has two values rather than a range, so it reads flat regardless of palette.
2. Surface edges are carried by diffuse shadow with no keyline against a near-identical background,
   which produces a soft edge on a warm light ground.
3. Corner radius is a single value applied across surfaces spanning an order of magnitude in size,
   and it is a circular arc, whose curvature discontinuity is visible at large surface sizes.
4. Rail icons and labels sit below the contrast floors for their roles, and the selected state is
   signalled by fill alone.
5. Panes are sized by the viewport while content is top-aligned inside them, so content clusters and
   leaves voids. Section headings render over empty regions with no empty state.
6. Color appears only as status. No visual property carries object kind, so nothing is scannable by
   sight and every row must be read.

## Verify first

The first two decide scope and lead the status report.

1. The current token inventory: read `apps/console` token definitions for the `--ij-*` and `--rec-*`
   families and record, per token, its measured OKLCH lightness. The value-range work in D1 is a
   retune of existing tokens if the families are complete, or an extension if they are not. Do not
   guess which; measure.
2. Whether a contrast gate already exists. The data canvas report names `gate:fence`,
   `gate:register`, `gate:icons`, and a motion gate, and mentions contrast among gates not re-run.
   If a contrast gate exists, D3 extends its thresholds rather than adding a second gate.
3. The `DECLARED_PAINT_SURFACES` list and the motion gate's in-file `getContext` requirement, which
   blocked declaring `CanvasPaperGround`. D6 depends on the exact rule.
4. Whether `IslandKindGlyph` (or the current glyph enum on the branch) is the complete kind list. D4
   assigns one hue per kind and needs the closed set.
5. Which block placement vocabulary is live: the `MountPoint` and `BlockSize` families, or the
   `BlockPlacement` dimensionality vocabulary from AMENDMENT-02. Radius scale in D2 keys off surface
   size, and the size vocabulary decides how it is expressed.

## Named choices

### 1. Every visual property carries one meaning, and no property is decorative

The axis assignment, which is the spec. A property may not be used for a second purpose, and a
meaning may not be carried by two properties, except where redundancy is required for accessibility.

| Axis | Carries | Source of truth |
| --- | --- | --- |
| Lightness tier | Elevation layer | surface role |
| Keyline contrast | Surface boundary and focus | interaction state |
| Hue | Object kind | kind glyph enum |
| Texture | Epistemic status | `DischargeState` |
| Extrusion | Register, run versus program | `PlanCanvasSnapshot.register` |
| Motion | Liveness, reported only | `ProcessLiveness` |
| Radius | Surface scale | container size |
| Type weight and size | Information rank | content role |

Consequence worth stating: hue is spent on kind, not on status, so status is carried by keyline,
icon, and label together. This is what keeps color scannable rather than alarming.

### 2. Five elevation tiers with a real value range

Named tiers, each with a defined background lightness, keyline, and shadow:

- `sunken`: wells, inputs, code, empty regions that are containers rather than voids.
- `ground`: the app substrate.
- `raised`: panes and cards.
- `floating`: menus, popovers, dialogs, drag previews.
- `scrim`: modal backdrop.

Named choice: the spread from `sunken` to `floating` is widened materially beyond the current band,
and the exact OKLCH lightness per tier is set in D1 against the measured inventory. Adjacent tiers
must be distinguishable without a keyline when placed side by side, verified by the D3 gate.

Named choice: `raised` and above each carry a keyline. Shadow is permitted only on `floating` and
`scrim`. This is the reversal that fixes the soft-edge problem: on a warm light ground the keyline
does the work and the shadow is reserved for surfaces that genuinely float above the plane.

### 3. Radius is proportional, nested, and continuous-curvature

Three rules, all of which currently fail.

- Proportional: radius is drawn from a scale keyed to surface size, not one token for every surface.
  A rail row, a chip, a panel, and a full pane take different steps of the same modular scale, so the
  ratio of radius to surface reads constant.
- Nested: an inner surface's radius equals its parent's radius minus the gap between them. An inner
  radius equal to or greater than its parent's is a defect.
- Continuous curvature: surfaces at `raised` and above use `corner-shape: squircle`, which is
  `superellipse(2)`, alongside `border-radius`. Corner shape is applied through the token layer, not
  ad hoc per component.

Named choice on support, stated so it is not rediscovered as a bug: `corner-shape` is Chromium-only
at time of writing and degrades to a plain rounded corner where unsupported, because `border-radius`
still applies. The desktop shell's system webview on macOS is WebKit and will therefore render round
corners while Chromium surfaces render squircles. This difference is accepted. Do not build a
`clip-path` or SVG squircle bridge to force parity, because clipping costs `box-shadow`, `border`,
and overflow behavior, which are load-bearing here.

### 4. Hue carries kind, from one ramp at fixed lightness and chroma

One hue per entry in the kind glyph enum, generated by rotating hue around a single OKLCH ramp while
holding lightness and chroma constant, so every kind reads at equal visual weight and the difference
between them is purely categorical. Kind hue appears on the glyph and on a short edge marker, never
as a surface fill, so it never competes with the elevation tiers.

Named choice: kind hues are generated parametrically from the ramp definition, not hand-picked, and
the generator is checked in. Hand-picking produces unequal weights, which reintroduces accidental
hierarchy.

### 5. Texture carries epistemic status

The material vocabulary bound to `DischargeState` from HANDOFF-FORME-TYPE-SYSTEM, plus the refused
case from `ProcessLiveness`:

- `Deterministic`: no texture. Clean surface.
- `Discharged`: fine grain at low amplitude. Visible, resolved.
- `Undischarged`: coarse dither at higher amplitude. Visibly unresolved, because it is.
- `Refused`: fluted or obscured. Something is present and cannot be seen through.

Named choice: texture never carries hue. It modulates the surface's own tier lightness only, so
texture and kind stay independent.

Named choice: until D4 of HANDOFF-FORME-TYPE-SYSTEM lands, the texture axis renders a single state,
`Deterministic`, and the other three are defined but unreachable. Rendering a discharge state the
backend cannot produce would be an invented signal.

### 6. Motion is scarce, reported, and budgeted

Inherited from the progress-edge discipline and stated here as material law.

- Only `Running` and `Verifying` animate. Every other state is static.
- Motion is never extrapolated. If the backend did not report progress, nothing moves.
- At most one live WebGL context per surface region, hard-capped. Browsers cap live contexts in the
  single digits to low teens, so a per-node context on a graph of any size fails outright. Nodes not
  currently running render a pre-rendered static material.
- `prefers-reduced-motion` sets every shader to `speed=0` and disables edge animation. The material
  stays; the motion goes.

### 7. Shaders paint chrome and material, never content

The same rule the isometric register sets for extrusion. Text, values, and controls ride a flat
plane above any textured surface. A shader may never sit behind a text run.

Named choice on the architecture: shader surfaces are mounted through a repo-owned `ShaderSurface`
component built on the vanilla `@paper-design/shaders` package and its `createShader(canvas, opts)`
entry, not the React `ShaderMount`. The component owns the canvas element and therefore `getContext`
in-file, which is what the motion gate requires and what blocked declaring `CanvasPaperGround`. This
also gives one seam to enforce the context budget, the reduced-motion rule, and offscreen pause.

Named choice: the package is pinned. It ships breaking changes under `0.0.x`.

Named choice: shader colors are resolved from computed CSS custom properties through one converter
at mount and on theme change. Shaders never carry literal color values. This is what keeps them from
becoming a second color system, per the standing sourcing doctrine.

### 8. Contrast floors are measured, not eyeballed, and selection is never fill alone

Floors, verified by tool in the D3 gate:

- Body and interactive label text: 4.5:1 against its own surface tier.
- Large text and headings at or above the large-text threshold: 3:1.
- Icons, glyphs, keylines carrying meaning, and focus rings: 3:1.
- Decorative keylines that carry no meaning are exempt and must be declared as decorative.

Named choice: a selected or active state is signalled by at least two of fill, keyline, edge marker,
and type weight. Fill alone is not a selection state. This is the specific correction for the rail.

Named choice: shortcut numerals and other annotations render at a lower contrast tier and smaller
size than the label they annotate. An annotation at equal weight competes with its subject.

### 9. Containers size to content, and empty is a state with a shape

- A pane or panel sizes to its content between declared minimum and maximum, and does not reserve
  viewport-derived height it cannot fill.
- An empty region renders an empty state at `sunken`, anchored to a declared position, carrying a
  cause and the action that resolves it. A heading over nothing is a defect.
- An empty state distinguishes no-results from not-loaded from not-connected, and says which. The
  current "No records match." on a disconnected surface reports a filter outcome for a connection
  failure.

## Deliverables

### D1. The value range and elevation tiers
Files: the console token definitions found in Verify First item 1.

Retune or extend surface tokens to the five tiers in named choice 2, with OKLCH lightness set against
the measured inventory. Record the before and after lightness per token in the PR body so the widening
is reviewable as a number rather than a screenshot.

Acceptance: the five tiers are distinguishable pairwise without keylines in a side-by-side fixture;
no two tiers resolve to the same lightness; `raised` and above carry keylines and only `floating` and
`scrim` carry shadow.

### D2. The radius scale, nesting rule, and corner shape
Files: the token definitions plus a lint rule under the console's existing gate scripts.

Radius scale keyed to surface size; `corner-shape` applied through tokens at `raised` and above; a
lint rule that fails when a component sets a raw radius value instead of a scale token, and when a
nested surface's radius is greater than or equal to its parent's minus the gap.

Acceptance: the lint fails on a seeded violation of each kind and passes on the tree; a `raised`
surface renders a squircle on Chromium and a round corner on WebKit with no layout difference;
`box-shadow` and `border` still render correctly on corner-shaped surfaces.

### D3. The contrast gate
Files: the existing gate location per Verify First item 2.

Compute contrast for every token pairing declared in a role map and fail below the named-choice-8
floors. Include the selection rule: a state declared as selected must differ from its unselected form
on at least two of the four listed properties.

Acceptance: the gate fails on the rail's current icon and label pairings before D5 and passes after;
a seeded fill-only selection state fails; decorative keylines must be declared to be exempt, and an
undeclared low-contrast keyline fails.

### D4. Kind hue generation
Files: a generator module in the console plus the kind glyph enum from Verify First item 4.

Generate one hue per kind by rotating around a single OKLCH ramp at fixed lightness and chroma. Apply
to glyph and edge marker only.

Acceptance: every kind in the enum resolves a hue; all kind hues measure equal lightness and chroma;
adding a kind to the enum produces a hue without hand editing; no kind hue is used as a surface fill.

### D5. The rail
Files: the console rail component and its tokens.

Apply the tiers, contrast floors, and selection rule. The rail becomes a distinct surface tier from
the ground. Icons and labels meet their floors. Selection carries an edge marker plus fill. Shortcut
numerals drop to a lower tier and smaller size. The three rail groups are separated by tier or spacing
rather than by a single hairline.

Acceptance: D3 passes on every rail pairing; the selected item is identifiable in a grayscale
screenshot; the rail reads as a surface distinct from the ground with the pane hidden.

### D6. `ShaderSurface` and the material vocabulary
Files: a new `ShaderSurface` component in the console, plus the material map.

Build on the vanilla package per named choice 7, owning the canvas and `getContext` in-file. Enforce
the context budget, reduced-motion, offscreen pause, and token-derived colors. Define the four
materials from named choice 5, with only `Deterministic` reachable until the backend produces the
others. Re-express `CanvasPaperGround` through it and add it to `DECLARED_PAINT_SURFACES`.

Acceptance: `CanvasPaperGround` is declared and the motion gate passes; exceeding the context budget
falls back to static material rather than failing; `prefers-reduced-motion` yields zero animation
across every surface; no shader carries a literal color; the package version is pinned.

### D7. Container sizing and empty states
Files: the console pane and panel primitives, plus every surface currently rendering a heading over
an empty region.

Implement named choice 9. Empty states distinguish and name their cause.

Acceptance: a pane with one line of content does not reserve viewport height; a disconnected surface
reports a connection cause and offers the reconnect action rather than reporting a filter result; no
section heading renders over an empty region without an empty state beneath it.

## Acceptance, system level

Report status as a scannable list leading with what is not done.

- The five elevation tiers are pairwise distinguishable and the measured lightness spread exceeds the
  pre-change spread, documented as numbers.
- Edges at `raised` and above are carried by keylines; shadow appears only on `floating` and `scrim`.
- Radius is scale-derived everywhere, the nesting rule holds, and corner shape degrades cleanly on
  WebKit.
- Every rail pairing passes its contrast floor and the selected item survives a grayscale test.
- Each object kind carries a generated hue at equal weight, on glyph and edge marker only.
- One `ShaderSurface` primitive exists, the context budget holds, reduced-motion yields no animation,
  and `CanvasPaperGround` is a declared paint surface.
- No pane reserves height it cannot fill, and no heading renders over an empty region.
- `pnpm gates` passes including the contrast and radius gates.

## Out of scope, and what this does not fix

Out of scope: the isometric node paint itself, which SPEC-ISOMETRIC-REGISTER owns and this spec
supplies tiers and radii to; the programmable DAG and data canvas surfaces beyond their tier and
radius tokens; dark mode tuning, which needs its own lightness strategy rather than an inversion; any
backend work.

Named honestly, because a material spec cannot fix them and they were visible in the same
screenshots. Each is an information architecture defect and belongs in a separate handoff:

- "Chat" appears twice in the rail, once as a numbered destination and once under Landmarks. One word,
  two meanings.
- "Thread" is both a rail destination and a docked panel.
- One backend condition is reported in four places with four vocabularies: a "reconnecting" label, a
  "Building" badge, a GraphQL 401 banner, and an "Identity refused" line outside the app frame. One
  connection state deserves one authoritative location.
- The Import a project form fuses two distinct tasks, opening an existing project and creating a new
  one, into a single undifferentiated input row.
- The rail's numbered items read as rank but denote keyboard shortcuts.
