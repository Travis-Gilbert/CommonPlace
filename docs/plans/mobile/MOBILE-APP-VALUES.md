# MOBILE-APP-VALUES

Register: extraction record. Observed values from owner-device screenshots of the four mobile references named in DESIGN-MOBILE-LANGUAGE, captured 2026-07-19. Every value here is screenshot-derived and approximate (±1 to 2pt on metrics, perceptual-family on color); nothing in this file ships as a pinned token. The pinning pass happens at implementation behind the contrast gate. License lanes restated: Plane AGPL (patterns only), Claude, Linear, Capacities closed (observed behavior only).

## 1. Claude iOS (dark) — the material and the Composer

Ladder (warm, hue-constant, the Clay mechanism live):
- Page ground: near #262624 (warm dark, no pure black)
- Raised surface (composer container, floating chrome capsules): near #30302E, hairline border one step up
- Control fill (buttons, model pill, keyboard keys): near #3A3A36
- Primary text: warm off-white near #F0EEE6 (never pure white)
- Secondary text: warm gray near #9A988E
- Accent: terracotta coral near #D97757, used exactly twice on screen (send button fill, brand mark). One accent, sparingly, on a warm neutral field.

Composer anatomy (the reference for ours):
- Container: full-width minus ~16pt margins, radius ~24 to 26, generous min-height (~120pt with content), internal padding ~14 to 16
- Input text ~17pt sans; multi-line grows naturally
- Control row inside the container bottom: attach as a ~40pt circle left; model pill (full-radius capsule, control fill, ~15pt label with the tier in secondary); right cluster: mic as a ~40pt ghost circle, send as a ~40pt filled coral circle with a white glyph
- The whole thing reads as an instrument: tall, bordered, self-contained, controls inside the material rather than beside it

Chrome law observed: chrome floats over content as translucent capsules (back circle, title capsule, action circles at top), never as an opaque bar. Content owns the page.

Speaker observation, recorded not adopted: assistant prose renders in a serif (~19 to 20pt, ~1.5 line height) while UI text is sans. Faces carry speakers in the wild; our assignment (Vollkorn human, Plex Sans agent) stands per the registers amendment, with the convergence noted as validation.

Action row under a reply: ghost icons ~22pt at ~28pt spacing, all inside comfortable ~44pt targets.

## 2. Linear iOS Inbox (light) — the triage grammar

Surface: near-white warm gray ground (~#F7F7F6), zero borders, zero separators; hierarchy is whitespace and type only.

- Title: ~30pt bold near-black; top-right actions grouped in one floating white capsule (~44pt tall, full radius, soft shadow)
- Row grammar (the extraction that matters): leading circular source icon ~44pt; title ~16 to 17pt medium, single line, truncating; reason line ~14 to 15pt in gray (~#8A8A88): what happened and who, then a dot separator, then relative time ("Copilot requested review, you approved · 2w ago"). Read state carried by title color (unread darker), not by badges.
- Row block ~76pt including gap; calm at every fill level; an inbox with two items looks intentional, not empty.

## 3. Capacities iOS (light) — objects and type tints

Surface: warm paper white (~#FBFAF8). The warm-light sibling of Claude's warm dark; together they argue the Clay pair.

- Object header: kind tile ~44pt (radius ~12) in the type tint (peach ~#FCEAD9 ground, rust ~#C0763F glyph); title ~30pt bold; search in a ~40pt light circle; primary action as a dark charcoal split button (~#2B2B2B, radius ~12, ~44pt, white ~16pt label + chevron section)
- View tabs: active = light gray capsule (~#F1F0EE) with glyph + ~16pt medium label; inactive ghost
- Rows: leading ~36pt kind tile (same tint system), name ~17pt regular, trailing overflow; ~58pt rhythm, whitespace-separated
- The type-tint system is the finding: every kind carries a tint pair (soft ground + deeper glyph), consistently, everywhere the kind appears. This is our domain-tint icon policy observed shipping at scale; the mobile kind tiles adopt the pattern with our domain tokens.

## 4. Plane iOS (light) — home composition and structure

- Header: workspace tile (~34pt rounded square) + name ~20pt semibold + chevron; utility icons right
- Card: full-width bordered (radius ~14, border ~#E4E4E7), ~56pt rows
- Section headers: ~14pt medium gray with collapse caret; "View all" as quiet right-aligned text
- Two-line activity rows: leading icon, ~17pt title, ~14pt gray subtitle with dot separators, ~64pt
- Stickies: two-column grid, ~16 gap, ~150pt pastel cards (radius ~14) — the composition slot our capture queue takes
- Icon-tab chips (project views): ~48pt bordered rounded squares, active expands to a labeled capsule with light gray fill
- Filter row: bordered ~32pt pills, radius ~10, active state carrying a small blue dot
- Empty state: one grayscale isometric illustration, one instruction line (~16pt gray), one bordered action (~44pt, radius ~10). Exactly one action.

## 5. The convergence values (Linear and Plane agree; adopted)

The floating pill tab bar with detached primary action, measured across both:
- Pill: height ~56, full radius, white on light with a soft diffuse shadow (approximately y8 blur24 at 8 percent black), 3 to 4 icon slots at ~22pt line-weight glyphs
- Active slot: light gray capsule (~#F1F1F0) behind the icon, roughly 44 by 36
- Detached action: ~56pt circle, same elevation, ~10 to 12pt gap from the pill
- Bottom inset: ~12pt above the home indicator

Ours per DESIGN-MOBILE-LANGUAGE: pill carries Home, Chat, Triage, Search; the detached circle is Capture. In Clay dark the pill renders on the raised step of the ladder with the same shadow discipline; the contrast gate governs.

## 6. Laws extracted (cross-reference, for the execution handoff)

1. Chrome floats; content owns the page. Title bars, action groups, and navigation are floating capsules over the content ground, never opaque edge-to-edge bars.
2. One accent on a warm neutral field, used scarcely (Claude spends it twice per screen). Our accent, gold, teal, and oxblood budget per the registers amendment already obeys this.
3. Hierarchy without borders on content surfaces: whitespace, type weight, and tint tiles carry structure; borders belong to cards and controls (Plane), never to list rows (Linear, Capacities).
4. Reason lines everywhere something arrives: source, what happened, who acted, when — in one gray line (Linear). The filing engine's vocabulary slots directly in.
5. Kind tints are systematic, not decorative (Capacities): a kind's tint pair follows it to every tile, everywhere.
6. Empty states get one illustration, one sentence, one action (Plane). Ours add the honest reason when the emptiness is a refusal.
7. Big-title screens (~30pt bold) with generous rows (~56 to 76pt) set the mobile scale ramp; the console's density inverts here exactly as the brief requires.

## 7. Confidence and the pinning pass

Colors are perceptual-family estimates from compressed screenshots; metrics are ±1 to 2pt from a 393pt-wide viewport. Before the execution handoff's visual gates pin anything: re-derive the Clay ladder through the oklch engine (the mechanism, not sampled hex), set the pill and FAB metrics on the 4pt grid nearest these observations, and run every pair through the contrast machinery. Approximations never ship as pinned tokens; the mechanism ships, tuned to these observations.
