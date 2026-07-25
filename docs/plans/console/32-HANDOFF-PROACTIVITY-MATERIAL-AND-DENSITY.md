# HANDOFF-PROACTIVITY-MATERIAL-AND-DENSITY

Repo `Travis-Gilbert/CommonPlace`, app `apps/console`, surface `console-proactivity`. Register: execution handoff; named choices are requirements. Follow-up correction to PR 85 (the commit-language relanguage): the git semantics landed, and the surface still reads bland, flimsy, and stiff. This document names why in five causes and corrects them. The backend and the commit-language model are untouched. Companions: 31-HANDOFF-PROACTIVITY-COMMIT-LANGUAGE (stands), 14-HANDOFF-CONSOLE-DIMENSIONALITY (its X3 rules apply here and were not applied), TWENTY-APP-VALUES (density), MOBILE-APP-VALUES law 5 (kind tints) and law 3 (hierarchy discipline), 13-AMENDMENT (speaker registers, corrected application).

## The five causes, named

1. Floating in white. The surface has no bounded structure: section labels float in tiny mono over an unbounded white page, cards sit on the same plane as the ground, and the frame, chrome, and content ladder is collapsed to one value. JetBrains, Twenty, and Plane all bound their content in panels with headers and seams; this is the dimensionality diagnosis recurring on a new surface because X3 was never applied here.
2. Density inversion violated. Desktop is dense; this screen has phone whitespace at desktop width. Cards carry 20px padding around 11px text; Twenty would put twice the information in the same area at higher legibility. The type ramp is broken: a 16px serif title drops straight to 11px mono with nothing between, which is exactly the "proportions feel off" sensation.
3. The repo-card grammar arrived as skeleton, not material. The reference card has anchors: a strong title, a language dot with color, stat glyphs, badges. The build has text-only stat lines, pale chips, and no tiles, so the texture that makes a repo card read as an object is missing.
4. Color misapplied as tinted words. The speaker registers were specified as structural (rails, title faces, tiles); they shipped as colored metadata text (teal "agent", oxblood "yours", gold and red phrases at 11px on white), which vibrates, reads cheap, and collides with link blue. Semantic color must sit in shapes, not in small type.
5. Administrative chrome repetition. Six identical Disable buttons and a five-box source farm each with its own button read as a settings form, not an instrument. Repetition of identical controls is what "stiff" means at the layout level.

The compile input regression is its own item: a screen-length single-line strip with a vague placeholder violates the measured-width discipline, impersonates the Composer (terminology decision 6), and lost its label.

## On canvas, honestly

Canvas cures texture, not structure. Density, proportion, hierarchy, and repetition are layout and typography diseases that canvas would faithfully reproduce at higher fidelity. So canvas enters where it pays and only there: the ground grain, the micro-visuals, and the graph rails. The rest of the cure is structure and density.

## Named choices

1. The surface is bounded per X3: the board area is a content plane on the chrome ground, each section (Sources, What matters, What it watches) is a panel with an Int UI header strip (24px, 13px title, bottom seam), and the page ladder renders (chrome, panel, card) with seams at junctions. No floating mono labels.
2. Twenty density governs: 13px body, 12px mono stat lines (never 11), the 4px grid, 8px cell padding rhythm inside cards, and a type ramp restored (title 15 in author face, description 13, machinery 12 mono).
3. Sources become one panel of five rows: source name, live state dot, and a switch. The box farm and its five Disable buttons are deleted.
4. Cards gain their anchors: a kind tile leading the title (the Capacities tint-pair pattern on our domain tokens: stake, watch, judgment tiles in their tints), stat glyphs in the stat row (a fired glyph with count, a clock with last-fired, the spend as a tiny inline meter), state badges in the repo-card badge slot (over budget as the amber badge with the muted variant; can act on its own as the gold badge; will ask every time as the neutral badge). Author renders as the tile edge and title face, not as a colored word. Per-card Disable moves into a card overflow menu; the primary face of a card carries at most one button.
5. Speaker registers apply structurally: the author lane color appears as the card's leading tile edge (a 3px inset rail on the tile) and the title face per the law; colored words are removed from stat lines, which render in ink and info grays with only the state badges carrying semantic color.
6. The compile input is restored as a bounded affordance: measured width (roughly 560 to 640), its label back ("Say what you want, in plain language"), seated in the What-it-watches panel header region as the panel's action, with the compile button beside it. It never spans the screen and never resembles the Composer.
7. Canvas enters at three points and nowhere else: a quiet paper-grain ground behind the board area (the reading-surface grain, register-derived, static under reduced motion, budgeted like the ground canvas), the spend meter and fired sparkline as small canvas draws inside the stat row, and the graph view's rails (already vector). Chrome and cards remain CSS.

## Deliverables

### Q1. Structure and ladder
Build: the panel structure per named choice 1 with header strips and seams; the board ground on the content plane; the grain canvas behind it per named choice 7.
Acceptance: the junction-seam assertion from X-gates passes on this surface; the floating labels are gone; the grain renders at negligible idle cost and disappears under reduced motion without layout shift.

### Q2. Density and ramp
Build: the Twenty-metric pass (grid, padding, row rhythms) and the restored type ramp per named choice 2 across cards, panels, and the graph node rows.
Acceptance: a 1440 capture shows at least the current information in roughly two thirds of the current vertical space with no text below 12px; the ramp renders three distinct sizes per card (title, body, machinery).

### Q3. Card anchors
Build: kind tiles with tint pairs, the author rail inset, stat glyphs, the inline spend meter and fired sparkline (canvas), the badge slot carrying all state phrases, the overflow menu absorbing Disable and secondary actions.
Acceptance: every state phrase currently rendered as colored small text renders as a badge or meter; exactly one button on a card face; the tile tint pairs resolve from domain tokens and pass contrast; a colorblind capture (grayscale) still distinguishes authorship by face and tile edge.

### Q4. Sources panel
Build: the five-row panel with state dots and switches replacing the box farm.
Acceptance: source enable and disable round-trips through the same mutations; the panel reads in one glance at 24px row rhythm.

### Q5. The compile affordance
Build: the bounded labeled input per named choice 6 with its compile action, wired to the existing PG5 path unchanged.
Acceptance: the input is measured-width, labeled, and visually distinct from the Composer; compiling from it produces candidates exactly as before.

### Q6. Gates
Build: regenerated baselines both themes; the colored-words scan (no semantic color on text below 13px outside badges); the existing PG and P gates stay green.
Acceptance: CI blocks on all; a side-by-side before and after lands in the PR body.

## Verify first

- The domain token set for stake, watch, judgment tiles (extend the domain tints if kinds are missing; contrast-gate the pairs).
- The grain canvas budget against the existing ground canvas measurements.
- Whether the sparkline data (fired history) is available at the store seam or renders count-only until the history query exists (count-only with the honest note if absent).

## Out of scope

The graph view beyond its rails (PR 85's relanguage stands), the wiring channels, the kernel, and any altitude changes.
