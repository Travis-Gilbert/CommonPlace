# SPEC-ISOMETRIC-REGISTER

Repo `Travis-Gilbert/CommonPlace`, app `apps/web`. Register: execution handoff; named
choices are requirements. A distinctive product skin (extruded halftone squircles, hard
keylines, one warm accent) delivered as a scoped register over unstyled behavior
primitives, applied to chrome and overview surfaces only, with work surfaces staying flat.
Companion to SPEC-WORK-SURFACE-EXECUTION (shares the token discipline and the enforcement
pattern) and to the PET handoff's play-skin precedent (a scoped aesthetic register over
shadcn/Radix primitives). This is paint, not a UI framework: one primitive, four seed
tokens, one pattern def, one register scope.

## The thesis, stated so no head dilutes it

The reason everything looks like a worse Notion is that everyone paints flat cards with a
1px border and a subtle shadow, because that is what every component library ships. The
distinctive look is not a different component set; it is a different **paint** over the
same accessible primitives. So: behavior is Base UI and Radix, unstyled and untouched.
Paint is one CSS/SVG treatment applied through the register. The two never merge. An agent
that reaches for a bespoke isometric dropdown has already failed; the dropdown is Base UI,
wearing the skin.

The line that keeps it usable, and the reason Coda itself flattens its product while its
marketing is isometric: **isometric for chrome, flat for work.** Tilted body text blurs
(subpixel rendering on a transformed plane) and tilted hit-targets fight the pointer.
Chrome (nav, tiles, overview maps, empty states, the pet, the growth card, the compounding
statement, room overviews, the search constellation frame) is where the style lives and
where it is stunning. Work surfaces (Compose reading plane, the code editor, data tables,
any running text or precise pointer target) sit flat, optionally inside an isometric frame
whose content plane is un-transformed. E6's gate makes a violation fail the build.

## Verified starting point (from apps/web/package.json at HEAD)

Installed and used by this spec, nothing new required for the core:
- `@base-ui/react` 1.3.0 and the full `@radix-ui/*` primitive set plus `radix-ui` 1.4.3:
  the behavior layer. Both are present; the pin below picks per-primitive by what is
  already imported elsewhere in the app, to avoid a third accessibility dependency.
- `class-variance-authority` 0.7.1 + `clsx` + `tailwind-merge`: the variant mechanism for
  the primitive's props (depth, accent, tilt, interactive).
- `@linaria/react` 8.0.0: zero-runtime CSS-in-JS already in the tree, the right host for
  the static transform and pattern CSS (no runtime style cost on a surface that repeats a
  card many times).
- Tailwind v4.1.18 emitting from the register `@theme`; the existing `build-register.mjs`
  and `lint-console-register.mjs` scripts and the `--cr-*` console register from
  SPEC-WORK-SURFACE-EXECUTION and the v2 work.
- `roughjs` 4.6.6 and `rough-notation` 0.5.1: already present. Relevant to the halftone
  decision below (an option considered and, by default, not used for fills; see D-Halftone).
- `size-limit` 11.2.0 with `@size-limit/preset-app`: the bundle gate E6 hooks.
- `motion` 12 for the one permitted entrance; framer-motion and gsap are present in the
  tree but are not used on this register (the SL0 consolidation applies here too: no gsap,
  no framer-motion in new register code).

No new runtime dependency is required to ship the core primitive. The isometric transform,
the halftone pattern, the keyline, and the shadow are CSS and inline SVG. `isometric-react`
was evaluated and is not adopted: its primitives are cube/plane/grid (wrong abstraction for
a card surface), it carries no halftone or keyline system, and it shows no maintenance
signal. Building the one primitive we need is smaller than bending it.

## The seed additions (the whole "library" is four tokens plus a pattern)

The parametric design system's seed gains four values; the register derives everything from
them, so the entire product refaces by editing the seed (the malleability thesis made
literal). Add to the seed and emit through the register build:

| Token | Default | Meaning |
|---|---|---|
| `--iso-angle` | `30deg` | the isometric projection angle; drives the transform matrix |
| `--iso-depth` | `10px` | extrusion depth of the side face (the card thickness) |
| `--iso-halftone-density` | `3px` | dot pitch of the extruded-edge halftone pattern |
| `--iso-keyline` | `1.5px` | keyline stroke weight around every isometric solid |

Derived in the register stylesheet from the seed and the existing `--cr-*` palette:
`--iso-transform` (the matrix built from `--iso-angle`), `--iso-shadow` (one soft shadow,
emitted from the palette solver so the no-literal lint keeps passing, same escape hatch the
galley shadow uses), `--iso-accent` (aliases the register's single accent, oxblood on the
console register; on a play or marketing register it can alias the warm orange), and the
halftone `<pattern>` id. The accent stays one hue per register: the standing one-color rule
from Compose and the work surface holds here too.

## The primitive

One component, `apps/web/src/components/iso/IsometricSurface.tsx`, plus its Linaria style
module and one shared SVG `<defs>` mount. This is the only new visual code; everything
below is composition of it with Base UI or Radix.

### Contract

```tsx
type IsoDepth = "flat" | "raised" | "deep";        // maps to 0, --iso-depth, 2x
type IsoTilt = "iso" | "flat";                      // flat = paint only, no transform
interface IsometricSurfaceProps {
  depth?: IsoDepth;                                  // default "raised"
  tilt?: IsoTilt;                                    // default "iso"
  accent?: boolean;                                  // accent keyline + edge, default false
  interactive?: boolean;                             // hover/press response, default false
  as?: React.ElementType;                            // polymorphic host, default "div"
  contentFlat?: boolean;                             // force the content plane un-transformed
  children: React.ReactNode;
}
```

Structure the component emits (three layers, one group):
1. **Top face**: a squircle (`border-radius` plus a superellipse `clip-path` for the true
   Coda squircle, not a rounded rectangle), `background: var(--cr-surface)`, keyline via a
   drawn border at `--iso-keyline` in ink (or `--iso-accent` when `accent`).
2. **Extruded side**: a parallelogram offset down-and-left by `--iso-depth` along the iso
   axes, `fill: url(#iso-halftone)` (the dot pattern), behind the top face in paint order.
3. **Shadow**: one `--iso-shadow`, never a second layer.

The group carries `transform: var(--iso-transform)` when `tilt="iso"`. When `tilt="flat"`
or `contentFlat`, the paint (squircle, keyline, halftone edge, shadow) renders but the
content plane is not transformed, so text inside stays axis-aligned and crisp. `depth`
scales the extrusion; `interactive` adds a press response (translate along the iso axis by
2px on press-down, per the physics spec's press-down rule) and a hover keyline brighten,
both through `motion` and both zeroed under reduced motion.

### Behavior layer pin (no new accessibility dep)

Interactive surfaces compose the primitive as the *visual host* of an existing unstyled
primitive; the primitive never implements focus, roles, or keyboard behavior itself.

| Interactive chrome element | Behavior primitive (already installed) | Notes |
|---|---|---|
| Tile / card button | Base UI (`@base-ui/react`) button/`useRender`, or a plain focusable element | `IsometricSurface as={...} interactive` wraps it |
| Menu (tile context, register switcher) | `@radix-ui/react-dropdown-menu` (already imported app-wide) | menu content is a `tilt="flat"` surface so items read crisp |
| Dialog / sheet | `@radix-ui/react-dialog` or `vaul` (both installed) | panel is `contentFlat` |
| Tabs (overview switchers) | `@radix-ui/react-tabs` | tab triggers are small iso tiles; panels flat |
| Tooltip | `@radix-ui/react-tooltip` | never iso (small text) |
| Toggle group (view mode) | `@radix-ui/react-toggle-group` | iso tiles allowed, labels flat |

Rule: pick the primitive already imported elsewhere in `apps/web` for a given role, to
avoid adding a Base-UI equivalent beside a Radix one already in the tree (the app has
both; do not grow both for the same role). Record the pick per element in the PR.

## D-Halftone (named decision)

The extruded edge's dot pattern is an **inline SVG `<pattern>`** of small circles at
`--iso-halftone-density` pitch, referenced by fill on the side parallelogram, defined once
in a shared `<defs>` mounted at the register root and reused by id. Reasons over the
alternatives: it is deterministic, resolution-independent, themeable (dot color mixes from
the palette), and zero-runtime. `roughjs` (installed) was considered for a hand-drawn
stipple and is not used for the edge fill: it renders to canvas/imperative SVG per instance,
which fights repetition across many cards and is non-deterministic frame to frame. `roughjs`
and `rough-notation` stay available for one-off marketing illustrations and the constellation
annotations, not for the repeated product-chrome edge. A CSS `repeating-radial-gradient`
halftone is the documented fallback if the SVG pattern shows seams at some zoom levels
(record which path shipped).

## Deliverables

### I1. Seed tokens and register scaffold
Build: the four seed tokens and their derived values, emitted by the register build into a
scoped block. The register activates under `[data-register="isometric"]` exactly as the
umber and play-skin registers already scope (the PET precedent), so it never leaks into the
sober console surfaces. Mount the shared halftone `<defs>` once at the register root. Add
the `--iso-*` namespace to the register lint's known-token set so E6 stays green.
Acceptance: setting `data-register="isometric"` on a container resolves all `--iso-*`
values; unsetting it removes them with zero effect on console surfaces; the halftone defs
mount once (not per card, asserted); editing `--iso-angle` in the seed visibly re-tilts
every surface (one source of truth proven).

### I2. The IsometricSurface primitive
Build: the primitive per the contract, its Linaria style module, the squircle clip-path,
the extruded halftone side, the single shadow, the `cva` variant wiring for
depth/tilt/accent/interactive, the polymorphic `as`, and the `contentFlat` content-plane
un-transform. Press-down and hover responses through `motion`, zeroed under reduced motion.
Acceptance: the primitive renders a Coda-grade extruded squircle at `depth="raised"`;
`depth="deep"` doubles the edge; `accent` recolors keyline and edge to the register accent;
`tilt="flat"` paints the skin with no transform; `interactive` fires press-down translate
and hover brighten; a Playwright snapshot matches at two viewports; reduced motion renders
static with no transform animation.

### I3. Chrome adoption set (the proof it is a product skin, not a demo)
Build: convert a bounded set of real chrome surfaces to the register, each composing the
primitive over its existing behavior primitive, each themed from the seed, none
hand-rolled: the register switcher menu, the overview tile grid on the Index (destinations
and saved views as iso tiles), the empty states for the Index and the run view, and one
hero overview surface chosen with Travis (candidate: the room overview or the growth card).
Every interactive tile keeps its Base UI or Radix behavior; only the paint changes.
Acceptance: the tile grid renders as iso tiles that are keyboard-focusable, screen-reader
labeled, and pointer-correct (hit-target matches the visual top face within tolerance);
the menu opens with crisp flat items inside an iso trigger; empty states read as
intentional iso compositions, not blank; removing `data-register="isometric"` returns each
surface to the flat console register with no broken layout (the skin is separable).

### I4. Content-plane discipline
Build: the `contentFlat` path verified on a surface that holds text: an iso-framed card
whose body is a flat, axis-aligned content plane (the frame tilts, the words do not). Wire
the same escape into the work-surface tool cards if any adopt the iso frame, so a tool card
can wear an iso border while its result renders flat.
Acceptance: an iso-framed card with a paragraph of body text renders the frame tilted and
the text axis-aligned and crisp (no subpixel blur, verified by a snapshot diff against the
same text on a transformed plane, which must differ); a data table inside an iso frame has
correct pointer hit-targets on every cell.

### I5. Reduced motion and dynamic type
Build: `prefers-reduced-motion` flattens the register: the transform holds (static tilt is
fine; it is not motion) but all press/hover/enter animation zeroes, and the optional
halftone shimmer (if any is added for the pet surface) becomes a single static frame. A
`prefers-reduced-transparency`/high-contrast pass ensures the keyline and edge stay legible
(the keyline carries the shape; the halftone is decoration and may drop). Dynamic type does
not clip iso tile labels (labels are flat text, so they reflow normally).
Acceptance: a reduced-motion recording shows a fully static register with all chrome still
legible; a high-contrast pass keeps every keyline visible; an XL dynamic-type pass shows no
clipped tile label.

### I6. Gates
Build: CI additions scoped to `src/components/iso/**` and any surface carrying
`data-register="isometric"` (extend the existing `lint-console-register.mjs` and the
Playwright suite, do not duplicate):
1. **The tilted-text blocker (the load-bearing gate).** A lint that fails if a text-bearing
   element (paragraph, editor mount, table cell, input) is a descendant of an
   iso-transformed node without an intervening `contentFlat`/`tilt="flat"` boundary. This
   is what enforces "isometric for chrome, flat for work" mechanically. Implement as a DOM
   assertion in a Playwright fixture that walks the register surfaces and checks computed
   transforms on text ancestors, plus a static lint on the primitive's usage where feasible.
2. No hand-rolled interactive control on the register: a grep/AST check that interactive
   iso surfaces compose a Base UI or Radix primitive (no bespoke `onKeyDown` role handling
   inside `IsometricSurface` consumers for menu/dialog/tabs roles).
3. The register lint's no-literal rules extended over `--iso-*` (no raw hex, no
   arbitrary-value classes; the shadow and dot color come from the palette solver).
4. `size-limit` budget on the register chunk so the primitive plus adoption set does not
   regress bundle (the primitive is CSS-heavy, JS-light; assert it).
5. Playwright snapshots: the primitive at two viewports, the tile grid, the flat-content
   card, and the reduced-motion static frame, as merge blockers.
6. Separability: a test that renders an I3 surface with the register off and asserts a
   valid flat layout (the skin never becomes load-bearing for structure).
Acceptance: introducing tilted body text fails gate 1 on a branch (demonstrated once,
recorded); a bespoke iso menu fails gate 2; a raw hex on the register fails gate 3; the
suite is green with I1 through I5 landed.

## Verify first

- V1 The register scoping mechanism exactly as umber and play-skin implement it
  (`[data-register=...]` attribute vs a class), so I1 matches the existing pattern rather
  than inventing a parallel one. Read the porcelain umber opt-in and the PET play-skin
  scaffold.
- V2 The seed's current shape and where `build-register.mjs` reads it, so the four tokens
  slot into the real seed structure, not an assumed one.
- V3 Which behavior primitive is already imported for each I3 role (dropdown, dialog,
  tabs) so the pin uses the incumbent and does not add a Base-UI-beside-Radix duplicate.
  Grep `@radix-ui` and `@base-ui` import sites in `apps/web/src`.
- V4 Squircle fidelity: confirm the target browsers render the chosen `clip-path`
  superellipse acceptably; if Safari/WebKit (the desktop Tauri and Capacitor iOS targets)
  shows artifacts, fall back to a high-radius rounded rect and record the compromise.
- V5 Linaria vs the register's Tailwind `@theme` emission for the static transform CSS:
  confirm the primitive's styles can read the `--iso-*` custom properties whichever host
  emits them; if Linaria static extraction fights runtime custom properties, author the
  primitive's CSS as a plain scoped stylesheet consuming the vars instead.
- V6 Whether any existing surface already sets a transform on a text container (so gate 1
  does not immediately fail on pre-existing code outside this register's scope; scope the
  gate to the iso register only).

## Where it lands

`src/components/iso/IsometricSurface.tsx` and its style module; the four seed tokens in the
design-system seed with derived values in the register build; one shared halftone `<defs>`
at the register root; the I3 adoption set on real Index and overview surfaces under
`[data-register="isometric"]`; the gates extending the existing register lint and Playwright
suite. Nothing here touches the console register's sober surfaces, and the skin is provably
separable (gate 6), so it can ship on chrome, be lived with, and spread or retreat by
surface without risk to the product's structure.

## The five-minute test

Flip the register on the Index overview: the destination tiles rise into extruded halftone
squircles with hard keylines and one warm accent, and they are still tabbable, still
labeled, still click where they look. Open the register switcher: the trigger is an iso
tile, the menu items inside are crisp and flat. Drop a paragraph into an iso-framed card:
the frame tilts, the words stay straight and sharp. Turn on reduced motion: the tilt holds,
nothing animates, everything is legible. Flip the register off: every surface falls back to
the flat console register, intact. Run the greps, including the tilted-text blocker:
silence. It looks nothing like Notion.
