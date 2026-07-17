# HANDOFF-CONSOLE-COLORATION

Repo `Travis-Gilbert/CommonPlace`, app `apps/console`. Register: execution handoff; named choices are requirements. Companions in force: int-ui-register.css (pinned dark), HANDOFF-GREENFIELD-CONSOLE G2 (register stack and contrast gate), SPEC-MDT-CONSOLE-FIXTURE (the WCAG machinery this reuses).

Scope sentence: the console gains a real light mode, an auto day and night switch, and a two-knob theme engine (background tint, highlight color) with named presets, all under the contrast gate, without breaking the pinned-verbatim discipline that makes the chrome read as JetBrains.

## Why two knobs instead of theme plugins

The register derives nearly everything from anchors and percentage mixes. That was the convergent law the extraction found, and it pays off here: a theme is not seven hundred colors, it is a neutral ramp, an accent, and a highlight set. Tinting the ramp and choosing a highlight re-derives the whole surface. A TypeScript plugin API can exist later for full themes; the knobs cover what people actually want (the navy-and-light-red screenshot) at near zero cost, and every knob combination passes through the same contrast gate as the shipped presets, so expressiveness never costs legibility.

## Named choices

1. Stock presets are pinned and byte-stable. IntelliJ Dark stays the shipped `int-ui-register.css` untouched; IntelliJ Light lands the same way, generated once from `expUI_light.theme.json` at the same upstream SHA discipline and then pinned. The theme engine's stock presets resolve to these files exactly; authenticity is never an emergent property of a generator.
2. Derived themes re-anchor in oklch. The engine extracts the lightness ladder from the pinned neutral ramp (fourteen steps) and re-emits it as `oklch(L_i, C_tint, H_tint)` where the tint knob supplies chroma (bounded, roughly 0 to 0.04) and hue. Chroma zero at any hue reproduces the stock ramp within rounding. The Int UI inversion (seams darker than surfaces) is a property of the ladder and survives every tint.
3. The highlight knob supplies one hue; the engine derives the slot set from it at solved lightness: selection background, inactive selection, editor line highlight, search match, and text selection. The accent (focus, active underline, primary button) remains its own slot and is preset-controlled, not knob-controlled, so the chrome identity stays coherent while highlights personalize.
4. Every generated theme passes the contrast gate before it applies. The gate (markdown-theory wcag machinery, already in CI per G2) also runs at runtime over a knob change; a failing combination clamps to the nearest passing values and says so in the appearance panel. No knob setting can produce an illegible console.
5. Mode is binary plus auto. `[data-theme="dark" | "light"]` with an auto setting following `prefers-color-scheme`, which is the day and night answer: the console follows the room unless told otherwise.
6. Shipped presets: IntelliJ Dark (stock), IntelliJ Light (stock), GitHub Dark and GitHub Light with palettes sourced from Primer primitives (MIT, `primer/primitives`), and Navy, a knob preset (tint hue near 250 at low chroma, highlight a light red) matching the reference screenshot. The Material Theme UI plugin family is not a source; its licensing is not clean and Primer covers the look legitimately.
7. Icons are Noun Project under the existing subscription license, rendered monochrome on the icon ladder by default. Expressiveness comes from two sanctioned channels: domain accent tinting (`--ij-memory`, `--ij-agent`, `--ij-room`, `--ij-graph`) on domain icons, and file-kind color dots in trees and tabs. No third-party icon theme packs.
8. All theme output lives in register files; the raw-value lint applies to the generator's output like any register file. Components never learn about themes; they consume the same tokens.

## Deliverables

### T1. Light register
Build: `int-ui-register-light.css` generated from `expUI_light.theme.json` (same structure, same token names, light values, seams from the dark end of the light ramp preserving the inversion), pinned after review; the `[data-theme]` switch wiring in the register bridge; Galley's light plane bridge (`--gy-*` resolving to the light editor surfaces per SPEC-MDT's console-dark sibling, a `console-light` generation pass).
Acceptance: flipping `data-theme` restyles every surface with no component edits; the five signatures hold in light (seams darker than surfaces, accent underline, solid stripe button, run green, type metrics); the contrast gate passes both themes; visual baselines land for light at 1280 and 1440.

### T2. The theme engine
Build: `apps/console/src/styles/theme-engine.ts` extracting the L ladder from the pinned ramps once at build, emitting derived ramps from `{ tintHue, tintChroma, highlightHue }`, deriving the highlight slot set at solved lightness per mode, and writing custom properties scoped under `[data-theme-derived]`; stock preset selection bypasses the engine entirely and loads the pinned files.
Acceptance: chroma zero reproduces stock within a stated oklch rounding tolerance (asserted numerically in a unit test); a navy tint preserves the seam inversion (numeric assertion that seam L stays below surface L at every step); the engine's output passes the register lint; no component file changes.

### T3. Contrast clamping
Build: the runtime gate: on knob change, evaluate the declared pairs (ink on chrome, info on chrome, selection ink on selection, accent on chrome, gold on chrome) via the wcag machinery; clamp failing values to the nearest passing lightness and surface a quiet note in the panel naming what was clamped and why.
Acceptance: deliberately hostile knob values (highlight at low contrast) produce a usable console and a visible clamp note; the CI gate covers all shipped presets and three adversarial knob fixtures.

### T4. Presets and the appearance panel
Build: the preset registry (five named presets per named choice 6, each a `{ mode, source }` record: pinned file or knob values); the appearance panel on a minimal Settings surface (blocks copy-in per the sourcing addendum, reskinned by tokens): mode segmented control (dark, light, auto), preset row, the two knobs (tint hue and chroma as one control, highlight hue) with live preview, and the clamp note slot; preset and knob state persists per user; Command mode gains set-theme actions and the omnibar search scope finds them.
Acceptance: switching presets is instant with no flash of unthemed chrome; auto mode follows a simulated `prefers-color-scheme` flip in e2e; GitHub presets visibly match Primer reference values (spot-assert four anchors); Navy reproduces the reference screenshot's character in a side-by-side capture; settings persist across reload.

### T5. Icon color policy
Build: the icon pipeline note and enforcement: Noun Project SVGs enter through one directory with a normalization script (strip fills to `currentColor`), default rendering on the icon ladder, the two expressive channels wired (domain tint prop on the icon component, kind dots in tree rows and tab labels); a lint scan rejecting hardcoded fills in icon SVGs.
Acceptance: the stripe, toolbar, and tree render Noun Project icons at rest on `--ij-ink-info`; a memory domain icon renders in `--ij-memory` where domain context applies; the fill scan fails a probe SVG with a hardcoded color; no Atom or Material icon assets exist in the tree.

## Verify first

- `expUI_light.theme.json` structure parity with dark at the pinned SHA (spot check the keys the register maps; note any missing key and resolve from the light ramp).
- Primer primitives current package shape for the four GitHub anchor sets (canvas, fg, border, accent) and its MIT license file at the version pinned.
- oklch conversion fidelity for the pinned hex ramp (the L extraction must round-trip; pick the color library already in the toolchain or vend a tiny conversion, no new heavyweight dependency).
- Noun Project subscription terms for redistribution inside a deployed product (the standard subscription grants royalty-free use without attribution; confirm the tier).

## Out of scope

Full theme plugin API, per-surface theme overrides, syntax highlighting themes for CodeMirror beyond the two modes (the single editor theme file gains a light block and stops there), and marketing site theming.
