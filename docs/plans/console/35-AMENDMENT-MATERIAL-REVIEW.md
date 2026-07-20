# 35-AMENDMENT-MATERIAL-REVIEW

Register: amendment to Spec 34 (Islands and Material). Ratified 2026-07-20 from the islands-material-v2 HTML proof and owner review. Companions: `00-DECISIONS.md` decision 8 (islands), HANDOFF-CONSOLE-DIMENSIONALITY (paint audit inverted by this amendment for shell islands), `islands-material-v2.html` (visual proof).

## Why this exists

Spec 34 moved shell paint from CSS into a full-viewport shader Material Layer. Tonight's review corrected the material laws after the proof rendered: color was still fighting the islands, the toolbar was still an island, and island anatomy was homogeneous. This amendment is the contract for the CommonPlace `apps/console` implementation.

## Seven material laws

1. **Color lives in the ground.** The frame carries pronounced warm terracotta pools (strongest top-left, secondary lower-right). Islands stay near-neutral. Intensity is one uniform (`glow`); a Ground control may toggle it for review.
2. **Islands are neutral surfaces.** Tool islands use the chrome ladder slot; the editor island runs lighter (real Int UI behavior). No island carries the terracotta; the gutters do.
3. **Edge falloff, dimensional not 3D.** Roughly 4% brightness roll-off toward every island edge. Lit top edge and vertical light from above remain. No skeuomorphic extrusion.
4. **Grain pinned at plus.** Film grain as dither on ground and islands at the stronger proof value (dark ~0.028). Grain is part of the material, not a preference toggle in v1.
5. **Toolbar and status are frame-resident.** They wrap the workspace; they are not islands. The gradient flows through them. The switcher stands alone where the wordmark used to be. Gutters strengthen the moment the toolbar joins the ground.
6. **Island anatomy must vary.** Headers, type ramp, and per-island character are required. Homogeneity is a defect. Island headers are Manrope 600.
7. **Paint leaves CSS for shell fills.** The Material Layer renders SDF islands, gutter shadows, per-island gradient, lit edge, and grain. DOM keeps text, focus, and hit-testing. Shell island and frame-resident regions declare transparent backgrounds so the shader is the paint (inverted relative to X2's old "must paint CSS" rule for those regions). Content planes inside islands (composer, raised cards, popovers) still paint register tokens.

## Spacing contract

- Island radius: ~10px (`--ij-island-radius`)
- Gutters between islands: ~10px (`--ij-island-gutter`), frame visible between
- Activity bar (stripe): frame-resident, flush to the window edge, not an island
- Bottom dock: deferred until a desktop (Tauri) shell designs a Terminal surface; removed from the web console
- Primary nav rows: 36–40px sitewide (stripe targets and island headers land in this band; list density inside trees may stay on the Twenty 24px rhythm)
- Compact density (`data-density="compact"`): shorter chrome and tighter gutters

## Color layering (refined)

Color still lives primarily in the ground, but intensity is quieter (`--ij-material-glow` ~0.32 dark). Islands take a hint of terracotta via `--ij-island-terra-tint` so warmth is layered rather than only in the gutters.

## Typography ratification (trinity)

| Role | Face | Weight | Scope |
|---|---|---|---|
| Human | Manrope | 600 on island headers; authorship weight per speaker register | Island titles, human authorship |
| Agent | IBM Plex Sans | 500 | Chrome labels, agent voice |
| Machinery | JetBrains Mono | 400–500 | Paths, meta, code |

Protective clause: two sans faces marking speakers means the grayscale test stays mandatory, reinforced by weight (human 600, agent 500). If legibility fails, increase weight separation before reconsidering faces. Vollkorn remains Galley's display/publication register only.

## Overlay scrollbars

Thin overlay scrollbars, IntelliJ-style: they do not steal layout width from the island content. Register-derived track and thumb colors only.

## Dark-first

Dark is the shipping register for this pass. Light needs its own material pass (terracotta pools and edge falloff retuned against the light ladder). Do not claim light parity until that pass lands.

## Sidebar rethink (banked)

A fuller sidebar rethink is banked with its reference (Claude sidebar screenshot). The one law that does not wait: primary nav rows at 36–40px sitewide, because they are click targets.

## Visual proof

Canonical HTML sketch: `islands-material-v2.html` (Downloads copy; also mirrored under plans when checked in). Every note in the owner review is rendered there. Implementation must match that proof's shader laws and spacing, not a CSS approximation described as "canvas feel."

## Do Not Downgrade

- Do not replace the WebGL Material Layer with CSS gradients or a Canvas2D dot field and call it done.
- Do not re-island the toolbar or status bar.
- Do not put terracotta on island fills.
- Do not restore the toolbar wordmark.
- Do not widen scrollbars into layout gutters.
