# Console Paint: design

Source spec: `HANDOFF-CONSOLE-PAINT.md` (follows HANDOFF-CONSOLE-REGISTER). Scope: `apps/web`, the `(console)` route group. Tenant slug casing is load bearing: `Travis-Gilbert`.

This design corrects the handoff against the live tree. The handoff's symptoms are real and still live; two of its mechanisms were written against an earlier state and are now stale. Every claim below was verified against the running dev server on `/index` with real data (getComputedStyle on the actual DOM), against the generated token file, and against the markdown-theory package API.

## Verification method

- Read the live token bridge (`src/styles/global.css`), the generated register (`src/styles/console-register.css`), the console shell (`src/styles/console-shell.css`), the live `StreamLens.tsx`, and the console layout.
- Ran `pnpm install` (the worktree shipped with no `node_modules`), then introspected `@travis-gilbert/markdown-theory@0.1.2` (its `Axes`, `Palette`, `generateRegister`, `buildPalette`, `wcagContrast`, `emitCss` exports).
- Started the dev server, loaded `/index` at 1440x900, and dumped the matched CSS rules and computed styles for the section heading, row title, and section divider, plus the ground and surface plane backgrounds.

## Verified state at HEAD (what is live vs stale)

| Handoff claim | Verified state |
| --- | --- |
| `--font-cr-ui` was never bridged into `@theme`; `font-cr-ui` is a no-op | Stale. The bridge exists at `global.css` (`--font-cr-ui: var(--cr-font-ui)` inside `@theme`) and the `.font-cr-ui` utility is generated. |
| Titles render in the prose serif | Live. The `<h2>` section title computes `Vollkorn ... serif` even though it carries `font-cr-ui`. Row title `<span>`s correctly compute `IBM Plex Sans`. |
| Ground and surface are not stepped enough to see | Live. Ground `oklch L 94.5%` vs surface `96.7%`, a 2.2 L step; the sidebar is transparent over the ground host, the sheet is `bg-cr-surface`. |
| Adapt the existing DotGrid | Confirmed, with nuance: the window fixed `DotGrid` reads hex `--color-*`; the contained `PaneDotGrid` / `DotField` are the right bases; console tokens are oklch `--cr-*`; no `visibilitychange` suspend exists yet. |
| "one ambient at a time (twister vs ground)" | The "twister" is not implemented anywhere in the repo. The ground texture is simply the one ambient; no coordination is needed. |
| The register is a generated file with a WCAG solver oracle | Confirmed. `build-register.mjs` calls the `console()` fixture and re-asserts `passesAA`. Every solved contrast pair is "X on surface"; no pair checks the ground plane. |

### HP1 root cause (proven)

The `<h2>` carries `font-cr-ui`, and both of these rules match it:

1. `.font-cr-ui { font-family: var(--font-cr-ui) }` in Tailwind's `@layer utilities`, specificity (0,1,0).
2. `h1, h2, h3, h4, h5, h6 { font-family: var(--font-title) }` in `global.css`, unlayered, specificity (0,0,1).

In the CSS cascade, unlayered rules win over layered rules before specificity is considered. So the unlayered global heading rule outranks the layered utility on every semantic heading in the console, and the `<h2>` renders serif. Row title `<span>`s have no competing element rule, so they render sans. This is why editing components never fixed it: the components are correct; the utility they request is outranked in the cascade one level below them.

## Deliverables

### HP1. Resolve the UI font

- Intent (spec HP1): Index section headers and row titles render in the sans face; the prose serif appears only inside a rendered document body.
- Fix: add a console scoped, unlayered heading rule in `src/styles/console-shell.css` so headings inside `.porcelain` resolve to the UI face. Preferred form: `font-family: inherit` (or `var(--cr-font-ui)`) on `.porcelain :is(h1,h2,h3,h4,h5,h6)`, specificity (0,1,1) unlayered, which beats the global unlayered `h2` (0,0,1). With `inherit`, chrome headings follow `.porcelain` (UI face) and Galley document headings follow their prose container automatically.
- Guardrail: confirm Galley rendered document bodies keep `--cr-font-prose`. markdown-theory ships `galley.css`; verify its prose scope re-asserts the serif under the new console rule (adjust selector scoping if needed so the console rule does not leak into Galley bodies).
- Not doing: re-layering the global rule (site wide blast radius), or editing StreamLens (already correct).
- Files: `src/styles/console-shell.css` (add rule); verify against `src/styles/global.css` heading rule.
- Acceptance: `getComputedStyle` on a sampled row title and section heading reports the Plex sans family and not the serif family; the serif returns only inside a document body view.

### HP2. Make ground read apart from surface

- Intent (spec HP2): sidebar and content are distinguishable planes at a glance; the computed background lightness delta clears the HP4 threshold; the contrast report stays green.
- Fix: widen the ground to surface lightness step in the repo owned `scripts/build-register.mjs`. The `Axes` interface exposes no plane step, and the L values are derived inside the package `buildPalette`, so the widening is a small, legible transform on the resolved palette before `emitCss`, re-run through the exported `wcagContrast` gate. Target a clearly perceptible delta of about 4 to 5 OKLCH L (for example lower ground toward about 90 to 91 percent L while surface holds near 96.7 percent), then let the solver confirm AA.
- New oracle coverage: every current contrast pair is "X on surface"; widening by darkening ground leaves those untouched. The sidebar renders ink on ground, so add on ground pairs (ink, ink2, ink3, signal, link on ground) to the build time contrast assertion and fail the build if any misses AA.
- Structure is already correct: `console-shell.css` confirms sidebar equals ground (transparent `.p-rail` over `bg-cr-ground`) and the sheet equals surface with `rounded-l-cr-lg` at the seam. No structural change; only the token step and the regenerated `console-register.css`.
- Files: `scripts/build-register.mjs` (widen step, add on ground contrast checks), regenerate `src/styles/console-register.css` via `npm run build:register`.
- Acceptance: the computed background lightness delta between sidebar and sheet clears the HP4 threshold; the contrast report stays green on both planes.

### HP3. The canvas ground plane

- Intent (spec HP3): the console ground carries a quiet living texture; idle tab CPU under one percent; reduced motion renders one static frame; the foreground renders identically with the canvas present or absent.
- Fix: adapt a contained dot canvas (base pattern from `PaneDotGrid` / `DotField`, not the window fixed `DotGrid`) into a register owned ground plane behind the console foreground. Register colored: ink-3 at low opacity on ground, read from the oklch `--cr-*` tokens (add an oklch aware color read, since the existing `hexToRgb` reader cannot parse oklch). Seeded from a djb2 hash of the tenant slug (client readable via `NEXT_PUBLIC_COMMONPLACE_TENANT`, default `Travis-Gilbert`) so it is stable and personal. One rAF loop; suspend on off screen via IntersectionObserver and on hidden tab via `visibilitychange`; a single static frame under `prefers-reduced-motion`. Decoration only: it sits at the ground layer; the content sheet, sidebar chrome, and all foreground stay DOM and CSS.
- Motion policy reconciliation (user decision): delete the "No ambient motion in the monitoring shell" line in `DESIGN.md` and replace it with the quiet ambient ground policy (ambient limited to the ground layer; reduced motion collapses to one static frame). This supersedes the older principle, which was written before the canvas ground decision.
- Files: new console ground canvas component (client) mounted in the `(console)` layout at the ground layer; oklch color read helper; `DESIGN.md` motion section edit.
- Acceptance: the console ground carries a quiet living texture; CPU on an idle tab stays under one percent; reduced motion renders one static frame; the foreground renders identically with the canvas present or absent.

### HP4. The oracle gates (load bearing)

- Intent (spec HP4): turn the two silent failures into merge blocking red tests, and extend the CR1 literal lint and CR2 depth lint.
- Fix: add Playwright computed style specs under `apps/web/e2e/` that drive the real `/index` surface (no mock routes):
  - Font resolution: for a sampled chrome title and a section divider, `getComputedStyle(el).fontFamily` contains the UI sans family and does not contain the prose serif family.
  - Plane separation: the computed background lightness of the sidebar and the content sheet differ by at least the set delta (OKLCH L threshold the register guarantees).
  - Divider subordination: the computed font size of a section divider label is less than the computed font size of a row title, and its weight is not greater. (Currently green: divider 11.2px weight 400 vs row title 16px weight 400; the test locks it.)
  - Empty state restraint: an empty state message computed font size is at most body size.
- Extend `scripts/lint-console-register.mjs`: keep CR1 (literals) and CR2 (relief) coverage as new console surfaces migrate; add the surfaces this work touches to the migrated set.
- CI: wire the Playwright oracle run into `.github/workflows/commonplace-ci.yml` as a merge blocking step. Note: `@playwright/test` is not resolvable from the offline pnpm store locally, so the specs run in CI; local verification is via the Browser pane (the same computed style probe used to diagnose HP1).
- Files: `apps/web/e2e/console-paint.spec.ts` (new), `scripts/lint-console-register.mjs` (extend migrated set), `.github/workflows/commonplace-ci.yml` (add step).
- Acceptance: reverting HP1 fails the font family assertion; flattening the ground step fails the plane separation assertion; setting a section header back to a display serif fails divider subordination; the suite is green after HP1 through HP3.

### HP5. Empty states and density

- Intent (spec HP5): no empty state renders at body size or larger; the empty chat shows structure above the composer; the Index stream approaches the twelve row target at 1440 by 900.
- Fix:
  - Demote console empty states to quiet small ink-3 text: the inspector "Select something" and the chat empty field, plus any other empty state at body size or larger.
  - Empty chat structure: the chat surface is the bare `Omnibar`. Add a real affordance row above the composer, wired (No Fake UI): the Omnibar's actual modes (ask, web, web plus agents, fractal) as live controls that set the composer mode and focus it, plus real recent threads only if a Theorem session history source exists (verified at build time; otherwise render nothing there, honest empty). No hardcoded prompt arrays or decorative chips.
  - Density: raise the Index stream toward the CR5 density target (about twelve rows at 1440 by 900) by tightening the stream row rhythm within the register spacing tokens.
- Files: inspector empty state component; chat surface (`src/app/(console)/chat/page.tsx` and an affordance row component); StreamLens / stream row spacing.
- Acceptance: no empty state renders at body size or larger; the empty chat shows structure above the composer; the Index stream approaches the twelve row target at 1440 by 900.

## Cross cutting decisions

- Motion in the console: yes (user). Erase the DESIGN.md prohibition; ambient limited to the ground layer; reduced motion collapses to one static frame.
- HP5 affordances: wired to real data (user). No fake chips, no hardcoded prompts.
- HP2 target delta: about 4 to 5 OKLCH L, solver confirmed AA on both planes (announce and proceed; adjustable).
- HP1 fix mechanism: `inherit` based console heading rule so Galley bodies keep serif automatically (announce and proceed).
- No package fork: HP2 stays in repo owned `build-register.mjs`; the register remains the single source of color.
- Design gate: HP2 (palette), HP3 (canvas), HP5 (empty states) are visual surfaces; run `ui-design-pro:design-theory` and the impeccable craft pass before writing their visual code, per the project design gate.

## Checklist to spec backreference

Every item traces to a handoff HP section. No HP section has zero items.

- HP1: (a) add console scoped heading rule in console-shell.css; (b) confirm Galley bodies keep prose serif; (c) confirm Plex loads on the console route (verified: Google Fonts link in the console layout plus next/font).
- HP2: (d) widen ground to surface L step in build-register.mjs; (e) add on ground contrast pairs to the build gate; (f) regenerate console-register.css; (g) confirm seam rounding and plane assignment unchanged.
- HP3: (h) oklch aware color read helper; (i) contained ground canvas component (rAF, IntersectionObserver, visibilitychange, reduced motion single frame, slug seed); (j) mount at the ground layer in the console layout; (k) DESIGN.md motion section edit.
- HP4: (l) font resolution oracle; (m) plane separation oracle; (n) divider subordination oracle; (o) empty state restraint oracle; (p) extend lint-console-register.mjs migrated set; (q) wire oracle run into commonplace-ci.yml.
- HP5: (r) demote inspector empty state; (s) demote chat empty state; (t) wired affordance row above the composer; (u) verify and wire real recent threads or honest empty; (v) raise Index stream density toward twelve rows at 1440 by 900.

## Risks and open checks

- Galley prose scoping: the HP1 console heading rule must not turn Galley document headings sans. Verified path: markdown-theory `galley.css`; confirm its prose scope wins, adjust console rule scoping if needed.
- HP2 solver headroom: ink3 on surface is already 3.966:1 (under AA small 4.5:1, over AA large 3:1). Widening the ground step does not touch on surface pairs, but the new on ground pairs must be solved to AA; if a hue or chroma tweak is needed to hold AA on the darker ground, keep it inside the axes.
- HP5 recent threads source: confirm whether a Theorem session history endpoint exists for the console chat. If not, ship the wired mode affordances only and render nothing where recent threads would go (No Fake UI).
- Local Playwright: not runnable from the offline store; CI is the gate. Local proof is the Browser pane computed style probe.
