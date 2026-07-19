# HANDOFF-CONSOLE-DIMENSIONALITY

Repo `Travis-Gilbert/CommonPlace`, app `apps/console`. Register: execution handoff; named choices are requirements. This is a correction pass, not a rebuild: the register files are correct, the composer's functionality is correct, and the drift is confined to two mechanisms named below. Companions: int-ui-register.css and int-ui-register-light.css (both verified correct at HEAD), HANDOFF-CONSOLE-IA (named choices 5 and 6 govern the composer), HANDOFF-CONSOLE-COLORATION (T1 acceptance governs light), TWENTY-APP-VALUES (density), 13-AMENDMENT (speaker registers arrive separately; nothing here preempts them).

## The two drift mechanisms (so the fix prevents recurrence)

1. Adopt-and-tokenize. The register lint forbids raw values, so the 21st source component's decoration was laundered into a parallel token family (`--ij-composer-material`, `--ij-composer-material-overlay`, `--ij-composer-input-wash`, `--ij-composer-send-glow`, `--ij-composer-kbd-material`) and survived CI. The lint checks the form of a value (is it a variable) but not its provenance (does it belong to the system). The IA handoff's "surface material only" meant the sheen canvas; the port kept the source's container, overlay, counter, footer, and status as "the component skeleton" and dimmed the correct material to half opacity to coexist with the incorrect one.
2. Paint by omission. The lint forbids wrong colors but does not require right ones. A region that paints nothing inherits white and passes. Dark mode hid this because unpainted regions inherited dark; light mode is the X-ray that exposed every unpainted surface and missing seam at once. The flatness is not the light register's values (they are verbatim Int UI Light, inversion intact); it is under-application of the ladder plus missing junction seams, stripe grammar drift, and absent tool window headers.

## Named choices

1. The composer's only material is the sheen canvas at its own alphas. No overlay, no input wash, no send glow, no backdrop blur, no glass. The composer is an instrument panel: `--ij-raised` surface, `--ij-seam-raised` border, arc radius, the sheen behind the content. The parallel `--ij-composer-material*` token family is deleted, not restyled.
2. Components may not mint register tokens. Every `--ij-*` token lives in a register file with a provenance comment (JetBrains source path, Twenty values doc, speaker spec, or a ledger row). A checked-in token manifest makes additions a reviewed diff.
3. Depth is value, seam, and header, never shadow. Shadows are reserved for transient popovers (one token); resting panels get their depth from the ladder and their boundaries from seams. This is how both JetBrains themes read dimensional, including the light one.
4. Every named shell region declares its ladder slot explicitly. Nothing inherits its background.
5. The stripe is Int UI grammar: monochrome icons on the ink ladder at rest, weak-fill selected state, no saturated tiles, no colored glyphs at rest. Domain tint remains a content affordance per the icon policy, not stripe decoration.
6. The five signatures are gated in both themes, on rendered pixels.

## Deliverables

### X1. Composer subtraction
Build: delete `.composer-source-overlay`, `.composer-source-input-gradient`, `.composer-source-send-glow`, the kbd material, the character counter (reappearing only inside the final 10 percent of the limit, inline, mono), the footer row entirely (the Shift Enter hint moves to the send control's title and the first-run empty state; the "ready" status text is deleted because the mark is the status, which is its entire job), the backdrop blur, and the second shadow. Restore the sheen canvas to full self-opacity (its internal 3.2 percent alphas are the budget; the 0.5 multiplier existed only to lose the fight with the overlay). One mark placement: the controls row; the compact and footer duplicates collapse to it. The tool group drops its own material for a plain divider border. Delete the `--ij-composer-material*` family from the bridge and re-point `--ij-composer-shadow` usage at the single popover shadow token only if the composer is ever transient, which it is not, so it gets none.
Acceptance: no `composer-source-*` class remains in the tree; the only gradient anywhere in the composer subtree is inside the canvas element (asserted by computed-style scan); the sheen states render visibly in a side-by-side capture set (idle, streaming, commit) in both themes; exactly one Presence mark exists in the composer; the paste offer, staged chips, mentions, mode select, and stop control are untouched and their tests stay green.

### X2. Token provenance and the paint-required lint
Build: the token manifest (`apps/console/src/styles/token-manifest.json`, generated then checked in) listing every `--ij-*`, `--rec-*`, and `--gy-*` name with its register file; a CI assertion that the emitted token set equals the manifest, so a new token is a reviewed manifest diff with a provenance line; the paint audit: a named-region map (toolbar, stripe, each tool window, tool window headers, editor well, tab strip, status bar, composer) where each region's root asserts an explicit background token, enforced by a DOM scan in the visual test run that fails on any named region resolving to default white or transparent-over-body.
Acceptance: a probe component minting `--ij-anything` fails CI on the manifest diff; a probe region with no background fails the paint scan; the manifest lands with provenance lines for every existing token, which is itself the audit that catches any other laundered values.

### X3. The dimensionality pass
Build:
1. Junction seams everywhere two regions meet: toolbar bottom, stripe right, status bar top, every companion-to-editor boundary, and tool window header bottoms, using `--ij-seam` on chrome and `--ij-seam-raised` where raised surfaces meet. In light these resolve to gray-12 and gray-10 and must be visible against white.
2. Tool window headers: every companion and tool window gets the Int UI header strip (24px, 13px title in ink, chrome background, bottom seam, right-aligned action slot with the hide affordance). Files, Context, and Thread stop being floating labels.
3. The editor island: the editor well paints `--ij-editor` inset within chrome, the tab strip sits on chrome with the active tab underline and a subtle active background, so the brightest plane in light (white) and the sunken plane in dark both read as the work surface.
4. Stripe restoration per named choice 5: 40px stripe on chrome, 20px icons at `--ij-ink-info`, hover `--ij-hover-surface`, selected weak fill with the icon at ink, the two behavior groups separated by a seam segment. The rounded saturated tiles and colored-at-rest glyphs are removed.
5. Density: Files and list rows to the 24px rhythm, panel paddings on the 4px grid, per the Twenty structural group already in `rec-structural.css`.
Acceptance: a rendered-pixel assertion in both themes that every named junction has a seam whose luminance differs from both neighbors in the correct direction (the inversion test generalized); the header strip renders on all three companions; a person shown the light workspace capture and asked what application family it belongs to says JetBrains, which is the five-minute test re-run on light.

### X4. Signature gates on light
Build: the five-signature Playwright pass parameterized over `data-theme` (seams darker than adjacent surfaces, solid accent stripe button in its restored grammar, active tab underline, run widget green during a live run, type metrics), plus the X2 paint scan and the X1 composer material assertion, all running on dark and light in CI.
Acceptance: CI blocks merge on any signature failing in either theme; the baseline set regenerates for both themes at 1280 and 1440.

### X5. Empty-state architecture
Build: the Chat empty state gains its structure without waiting for wires: the starter-chip slots render (disabled, each naming the identity refusal as its reason, flipping live when identity lands per IA I2), inside the measured column, above the composer; panel headers from X3 give every empty companion a bounded frame so voids read as quiet rooms rather than missing paint.
Acceptance: the empty Chat capture shows structure at every level (header, column, chips, composer) with zero fixture content; chip disabled reasons name the real refusal string.

## Verify first

- The `--ij-composer-*` token definitions in `register-bridge.css` before deletion, to confirm nothing else consumes them (a grep gate in the same PR).
- The current stripe selected-state markup so the restoration keeps the radio and toggle semantics and their e2e from I1 intact.
- Whether any panel currently relies on inherited white deliberately (none should; the paint audit will surface any).

## Out of scope

Speaker-register application to chat content (the 13-AMENDMENT dispatch owns it and lands after this pass so messages arrive on corrected surfaces), the light Galley `console-light` fixture (SPEC-MDT M2 owns it), theming knobs (coloration T2 through T4), and any Ratatui work (the terminal theme exporter is a future row: the register's ladder and accent map onto a Ratatui style module the same way the Codex CLI maps terminal-inherit plus one accent; it derives from these tokens when the desktop round opens).

## The five-minute test

Open the console in light at noon. It reads as a JetBrains application that happens to be light: seams bound every panel, headers name every tool window, the editor is the bright island, the stripe is quiet monochrome with one selected surface. The composer is an instrument: a bordered raised panel whose surface carries a barely-there living sheen that breathes only while the agent works, with one small constellation of type composing where the status text used to be. Nothing glows, nothing is glass, nothing is pastel. Flip to dark and it is the same instrument at night.
