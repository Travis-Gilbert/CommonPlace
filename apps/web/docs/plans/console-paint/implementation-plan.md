# Console Paint Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the console chrome render in the sans UI face, make the sidebar read as a distinct plane from the content sheet, add a quiet canvas ground, wire the empty states, and lock all of it behind merge-blocking computed-style oracles.

**Architecture:** The components are already correct; every defect is one layer below them (token to utility cascade, generated palette step, missing ground canvas, unwired empty states). Fixes live in the console-scoped stylesheet, the repo-owned register generator, a new contained ground canvas, and the console surfaces, each gated by a Playwright computed-style assertion. Design source: `apps/web/docs/plans/console-paint/design.md`. Spec source: `HANDOFF-CONSOLE-PAINT.md`.

**Tech Stack:** Next.js 16 App Router, React 19, Tailwind CSS v4 (`@theme` utilities), `@travis-gilbert/markdown-theory@0.1.2` (register solver), Playwright (CI only), Node ESM build scripts, Canvas 2D + rAF.

## Global Constraints

Copied from the spec and the project rules. Every task implicitly includes these.

- No em dashes or en dashes anywhere, in any file type. Use colons, commas, periods, semicolons, or parentheses.
- No Fake UI, no mock data in reachable surfaces. Empty states are honest. Every interactive element does something real the moment it ships. No hardcoded suggestion or example-prompt arrays.
- The console register is the single source of every color, size, radius, shadow. No raw hex, rgb, px font-size, or px border-radius in migrated CSS or in register-constrained components (enforced by `scripts/lint-console-register.mjs`).
- WCAG AA on both planes: text clears its contrast target against both surface and ground.
- Reduced motion removes ambient movement and renders a single static frame.
- Tenant slug casing is load bearing: `Travis-Gilbert`. Client-readable slug source: `process.env.NEXT_PUBLIC_COMMONPLACE_TENANT` (default `Travis-Gilbert`).
- Design gate (mandatory before visual code on HP2 palette, HP3 canvas, HP5 affordance row): run `ui-design-pro:design-theory` and the `impeccable` craft pass, and scan `Theseus/Design Components/` for a matching pattern, before writing the visual code. Implementation of those surfaces is blocked until the synthesized visual proposal is approved.
- Playwright is not resolvable from the offline pnpm store locally; the e2e specs run in CI. Local proof is the in-app Browser pane computed-style probe.

**Live baseline (measured on `/index` at 1440x900, real data):** section `<h2>` computes `Vollkorn ... serif` (bug); row title `<span>` computes `IBM Plex Sans` (correct); ground `oklch L 94.5%` vs surface `96.7%` (2.2 L, too small); divider 11.2px weight 400 vs row title 16px weight 400 (subordination already holds); ink3 on surface 3.966:1 (target 3, AA large).

---

### Task 1: HP1 UI font resolution + font oracle

Spec: HP1. Root cause: `.font-cr-ui` is in Tailwind `@layer utilities`; the global `h1..h6 { font-family: var(--font-title) }` in `global.css` is unlayered, and unlayered beats layered regardless of specificity, so every semantic heading in the console is stolen back to serif.

**Files:**
- Create: `apps/web/e2e/console-paint.spec.ts`
- Modify: `apps/web/src/styles/console-shell.css` (add heading rule after the `.porcelain` base block near line 27)
- Reference (do not edit): `apps/web/src/styles/global.css:819` (the unlayered heading rule), `apps/web/src/components/v2/index/lenses/StreamLens.tsx:133,161`

**Interfaces:**
- Produces: `apps/web/e2e/console-paint.spec.ts` exporting a Playwright test file with a shared `readComputed` helper used by later tasks. The console index route is `/index`.

- [ ] **Step 1: Write the failing font oracle**

Create `apps/web/e2e/console-paint.spec.ts`:

```ts
import { test, expect, type Page } from '@playwright/test';

// The console index route (route groups do not appear in the URL).
const INDEX = '/index';

async function gotoIndex(page: Page) {
  await page.goto(INDEX, { waitUntil: 'domcontentloaded' });
  // Wait for the Stream lens to paint at least one section heading.
  await page.getByRole('heading', { name: 'What landed' }).waitFor({ state: 'visible' });
}

function fontFamilyOf(page: Page, selectorText: string) {
  return page.evaluate((needle) => {
    const el = [...document.querySelectorAll('h2, span, [class*="font-cr-ui"]')]
      .find((e) => e.textContent && e.textContent.includes(needle));
    return el ? getComputedStyle(el).fontFamily : null;
  }, selectorText);
}

test.describe('HP1 font resolution', () => {
  test('section heading and row title render the UI sans face, not the prose serif', async ({ page }) => {
    await gotoIndex(page);
    const headingFamily = await page.evaluate(() => {
      const h = [...document.querySelectorAll('h2')].find((e) => /What landed/.test(e.textContent || ''));
      return h ? getComputedStyle(h).fontFamily : null;
    });
    const rowTitleFamily = await fontFamilyOf(page, 'Ordinance 24-113');

    expect(headingFamily, 'section heading fontFamily').toBeTruthy();
    expect(headingFamily!).toMatch(/IBM Plex Sans/);
    expect(headingFamily!).not.toMatch(/Vollkorn/i); // serif FACE; the correct sans stack ends in "sans-serif"

    expect(rowTitleFamily, 'row title fontFamily').toBeTruthy();
    expect(rowTitleFamily!).toMatch(/IBM Plex Sans/);
    expect(rowTitleFamily!).not.toMatch(/Vollkorn/i); // serif FACE; the correct sans stack ends in "sans-serif"
  });
});
```

- [ ] **Step 2: Prove it is red (local, Browser pane)**

Playwright cannot run from the offline store. Prove red locally against the running dev server: with the server up, load `/index` in the Browser pane at 1440x900 and read the heading font.
Expected (before the fix): `getComputedStyle(h2).fontFamily` is `Vollkorn, "Vollkorn Fallback", Georgia, serif` (the oracle would FAIL).

- [ ] **Step 3: Add the console heading rule**

In `apps/web/src/styles/console-shell.css`, immediately after the `.porcelain { ... }` base block (the rule that sets `font-family: var(--cr-font-ui)`, near line 27), add:

```css
/* Console chrome headings resolve to the UI face. The site-wide unlayered
   h1..h6 { font-family: var(--font-title) } rule (global.css) outranks Tailwind's
   layered .font-cr-ui utility on every semantic heading; this console-scoped,
   higher-specificity, unlayered rule reclaims them. `inherit` means chrome
   headings follow .porcelain (UI face) while a Galley document body, which sets
   its own font-family, keeps its prose face automatically. */
.porcelain :is(h1, h2, h3, h4, h5, h6) {
  font-family: inherit;
}
```

- [ ] **Step 4: Prove it is green (local, Browser pane)**

Reload `/index` in the Browser pane. Read the heading font again.
Expected: `getComputedStyle(h2).fontFamily` now begins `IBM Plex Sans`; the row title stays `IBM Plex Sans`; the divider stays `JetBrains Mono`.

- [ ] **Step 5: Confirm Galley document bodies keep the prose serif**

Galley renders document bodies via `@travis-gilbert/markdown-theory` `galley.css`. Open a console surface that renders a Galley document body (Files reader, `apps/web/src/app/(console)/files/page.tsx`), and confirm a prose heading inside the document body still computes `Vollkorn ... serif`. If the `.porcelain :is(h1..h6)` rule leaks into the Galley body, scope it to exclude the Galley container (for example wrap the console chrome in a class and target `.p-... :is(h1..h6)`, or add a more specific `.galley :is(h1..h6) { font-family: var(--cr-font-prose) }` reassertion). Re-run Step 4.

- [ ] **Step 6: Commit**

```bash
git add apps/web/e2e/console-paint.spec.ts apps/web/src/styles/console-shell.css
git commit -m "fix(web): console chrome headings resolve to the UI sans face (HP1)"
```

---

### Task 2: HP2 plane separation + on-ground contrast gate + plane oracle

Spec: HP2. The ground to surface step is 2.2 OKLCH L, below perceptual threshold on the near-white values. The palette is solver-generated; `PaletteBands` carries `ground/surface/top` as Oklch anchors and `wcagContrast(a, b)` grades Oklch pairs. Widen the step in the repo-owned generator and add on-ground contrast assertions (every current solved pair is on surface only).

**Files:**
- Modify: `apps/web/scripts/build-register.mjs`
- Regenerate (do not hand edit): `apps/web/src/styles/console-register.css`
- Modify: `apps/web/e2e/console-paint.spec.ts` (add the plane test)
- Reference: `apps/web/src/styles/console-shell.css` (sidebar equals ground, sheet equals surface, already correct)

**Interfaces:**
- Consumes: from `@travis-gilbert/markdown-theory/tokens`: `console`, `emitCss`, `CONSOLE_AXES`, `resolveAxes`, `defaultBands`, `buildPalette`, `generateRegister`, `DEFAULT_TARGETS`, `wcagContrast`, `oklchCss`. `wcagContrast(a: Oklch, b: Oklch): number`. `Oklch` is `{ l: number; c: number; h: number }` with `l` in `[0,1]`.
- Produces: a regenerated `console-register.css` with a wider `--cr-ground` step and a green on-ground contrast gate in the build.

**Shipped approach (verified 2026-07-14, supersedes the band route below):** `defaultBands(axes)` returns the ink and accent lightness *search* bands (`{ ink: {lo,hi}, accent: {lo,hi} }`), not the plane anchors; the ground/surface/top steps are fixed inside `buildPalette` and are not caller-overridable. Since the ground plane does not feed ink solving (ink is solved against surface), the clean move is to post-process the ground on the stock register: parse `stock.palette.ground` OKLCH, subtract `GROUND_DROP = 0.03` L, spread into a new palette, and emit. On-ground AA is then asserted with `wcagContrast(role, ground)` at targets ink 4.5, ink2 4.5, ink3 3, signal 3, link 3 (ink and ink2 carry the small nav text; ink3/signal/link are faint apparatus or the large wordmark accent, matching the register's own ink3 target of 3). Measured result: ground 91.5%, delta 0.052 OKLCH L, all pairs AA on both planes. See the shipped `apps/web/scripts/build-register.mjs` for the exact code.

- [ ] **Step 1: Confirm the plane widening mechanism**

Confirm the above against the package d.ts and the running generator. The stock on-surface pairs are unchanged by darkening the ground; only the new on-ground pairs are added.

- [ ] **Step 2: Write the failing plane oracle**

Add to `apps/web/e2e/console-paint.spec.ts`:

```ts
// Convert a computed CSS color (rgb/rgba) to OKLCH L in [0,1].
const OKLCH_L_FN = `(css) => {
  const m = css.match(/\\d+(?:\\.\\d+)?/g);
  if (!m) return null;
  const [r8, g8, b8] = m.map(Number);
  const lin = (v) => { v /= 255; return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
  const r = lin(r8), g = lin(g8), b = lin(b8);
  const l_ = Math.cbrt(0.4122214708*r + 0.5363325363*g + 0.0514459929*b);
  const m_ = Math.cbrt(0.2119034982*r + 0.6806995451*g + 0.1073969566*b);
  const s_ = Math.cbrt(0.0883024619*r + 0.2817188376*g + 0.6299787005*b);
  return 0.2104542553*l_ + 0.7936177850*m_ - 0.0040720468*s_;
}`;

const PLANE_MIN_DELTA = 0.035; // OKLCH L; register guarantees at least this.

test.describe('HP2 plane separation', () => {
  test('sidebar ground and content sheet differ by at least the register delta', async ({ page }) => {
    await gotoIndex(page);
    const { groundL, surfaceL } = await page.evaluate((oklchLSrc) => {
      const oklchL = eval(oklchLSrc);
      const railHost = document.querySelector('.porcelain');
      const sheet = [...document.querySelectorAll('[class]')]
        .find((e) => /bg-cr-surface/.test(e.className.toString?.() || ''));
      const bg = (el) => (el ? getComputedStyle(el).backgroundColor : null);
      return { groundL: oklchL(bg(railHost)), surfaceL: oklchL(bg(sheet)) };
    }, OKLCH_L_FN);
    expect(groundL, 'ground L').toBeTruthy();
    expect(surfaceL, 'surface L').toBeTruthy();
    expect(Math.abs(surfaceL! - groundL!)).toBeGreaterThanOrEqual(PLANE_MIN_DELTA);
  });
});
```

- [ ] **Step 3: Prove it is red (local, Browser pane)**

Against the current build, the Browser pane probe shows ground lab L 93.63 vs surface 96.18 (about 0.022 OKLCH L), below `PLANE_MIN_DELTA` (the oracle would FAIL).

- [ ] **Step 4: Widen the ground step and add the on-ground gate in the generator**

Rewrite `apps/web/scripts/build-register.mjs` to widen the ground plane and assert AA on both planes:

```js
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  console as consoleRegister,
  emitCss,
  resolveAxes,
  CONSOLE_AXES,
  defaultBands,
  buildPalette,
  DEFAULT_TARGETS,
  wcagContrast,
} from "@travis-gilbert/markdown-theory/tokens";

const here = dirname(fileURLToPath(import.meta.url));
const outPath = join(here, "..", "src", "styles", "console-register.css");

// Widen the ground plane so the sidebar reads apart from the content sheet.
// The stock step (ground = surface minus ~0.022 L) is below perceptual threshold
// on the near-white parchment values. Drop ground by an additional ~0.045 L; keep
// surface and top so every "on surface" pairing the solver already cleared is
// untouched. The one thing this changes is the ground plane, which the sidebar
// paints, so we re-assert AA for every ink role on ground below.
const GROUND_DROP = 0.045;

const axes = resolveAxes(CONSOLE_AXES);
const bands = defaultBands(axes);
bands.ground = { ...bands.ground, l: bands.ground.l - GROUND_DROP };

// Re-solve the palette against the widened bands (ink roles stay solved against
// surface; the darker ground only affects the on-ground checks below).
const palette = buildPalette(axes, DEFAULT_TARGETS, bands);

// Base register from the fixture, with the widened palette swapped in.
const reg = consoleRegister();
reg.palette = palette;

// On-surface gate (unchanged pairs) plus a new on-ground gate. The sidebar renders
// ink, ink2, ink3, signal, and link on ground; nothing verified that before.
const inkRoles = [
  ["ink", palette.ink, DEFAULT_TARGETS.ink],
  ["ink2", palette.ink2, DEFAULT_TARGETS.ink2],
  ["ink3", palette.ink3, DEFAULT_TARGETS.ink3],
  ["signal", palette.signal, DEFAULT_TARGETS.signal],
  ["link", palette.link, DEFAULT_TARGETS.link],
];
const onGround = inkRoles.map(([name, color, target]) => {
  const ratio = wcagContrast(color, palette.ground);
  return { pair: `${name} on ground`, wcag: Number(ratio.toFixed(3)), target, passesAA: ratio >= target };
});
const onGroundFailures = onGround.filter((c) => !c.passesAA);
const onSurfaceFailures = reg.contrast.filter((c) => !c.passesAA);
if (onSurfaceFailures.length || onGroundFailures.length) {
  console.error("Console register fails WCAG AA:", [...onSurfaceFailures, ...onGroundFailures]);
  process.exit(1);
}

const contrastLine = [...reg.contrast, ...onGround].map((c) => `${c.pair} ${c.wcag}:1`).join(" · ");
const header =
  `/* GENERATED: do not edit by hand.\n` +
  `   Source: @travis-gilbert/markdown-theory \`console\` fixture (density: chrome), ground widened +${GROUND_DROP} L.\n` +
  `   Regenerate: npm run build:register.\n` +
  `   Contrast (WCAG AA solved, both planes): ${contrastLine} */\n`;

writeFileSync(outPath, header + emitCss(reg, ":root", { prefix: "cr" }));
console.log(`Wrote console register -> ${outPath}`);
```

Note: the header string literal above uses a unicode escape for the divider glyph so this script does not itself contain a raw em dash. If the confirmed API (Step 1) exposes a bands override on `generateRegister`, prefer `const reg = generateRegister(CONSOLE_AXES, { bands })` over swapping `reg.palette`.

- [ ] **Step 5: Regenerate and run the on-ground gate**

Run: `cd apps/web && npm run build:register`
Expected: exits 0, prints `Wrote console register`, and the regenerated `src/styles/console-register.css` header lists on-ground pairs all clearing AA. If any on-ground pair fails (most likely ink3, target 3), reduce `GROUND_DROP` until it clears, or raise `bands.ink3` search headroom; keep the change inside the generator.

- [ ] **Step 6: Prove the oracle is green (local, Browser pane)**

Restart the dev server (the generated CSS is imported at build), reload `/index`, and re-run the plane probe. Expected: `abs(surfaceL - groundL) >= 0.035`.

- [ ] **Step 7: Commit**

```bash
git add apps/web/scripts/build-register.mjs apps/web/src/styles/console-register.css apps/web/e2e/console-paint.spec.ts
git commit -m "feat(web): widen console ground plane and gate AA on both planes (HP2)"
```

---

### Task 3: HP5 empty states, wired affordance row, stream density + empty-state oracle

Spec: HP5. Demote empty states to quiet small ink-3, add real structure above the empty chat composer (wired, no fake chips), and raise Index stream density.

**Design gate first:** before writing the affordance-row visual code, run `ui-design-pro:design-theory` and `impeccable`, and scan `Theseus/Design Components/`. Get the synthesized proposal approved. The engineering contract below is fixed; the visual particulars come from the gate.

**Files:**
- Modify: `apps/web/src/components/v2/index/IndexDetail.tsx:168` (inspector empty state)
- Modify: `apps/web/src/app/(console)/files/page.tsx:277` (reader hint empty state)
- Modify: `apps/web/src/app/(console)/chat/page.tsx` (add affordance row above the Omnibar)
- Create: `apps/web/src/components/island/ChatStarters.tsx` (the wired affordance row)
- Modify: `apps/web/src/components/island/Omnibar.tsx` (accept an initial mode / expose a mode setter so the starters can set the real composer mode)
- Modify: `apps/web/src/components/v2/index/lenses/StreamLens.tsx` (row rhythm for density)
- Modify: `apps/web/e2e/console-paint.spec.ts` (empty-state oracle)

**Interfaces:**
- Consumes: `AiInputMode` from `apps/web/src/components/island/AiInputBar.tsx` (the real modes: `ask`, `web`, and the search/agent/fractal variants the Omnibar already implements). Confirm the exact union at task start.
- Produces: `ChatStarters` renders one button per real Omnibar mode; clicking a starter sets the Omnibar mode and focuses the composer. Recent threads render only if a real Theorem session-history source is confirmed; otherwise that region renders nothing (honest empty).

- [ ] **Step 1: Write the failing empty-state oracle**

Add to `apps/web/e2e/console-paint.spec.ts`:

```ts
test.describe('HP5 empty-state restraint', () => {
  test('the inspector empty state renders at most body size', async ({ page }) => {
    await gotoIndex(page);
    // With nothing selected, the inspector shows its empty message.
    const info = await page.evaluate(() => {
      const el = [...document.querySelectorAll('*')]
        .find((e) => (e.textContent || '').startsWith('Select something to see how it was filed'));
      if (!el) return null;
      const cs = getComputedStyle(el);
      const body = getComputedStyle(document.documentElement).getPropertyValue('--cr-text-body').trim();
      return { px: parseFloat(cs.fontSize), color: cs.color, bodyToken: body };
    });
    expect(info, 'inspector empty state present').toBeTruthy();
    // Body size at the console 15px base is 15px; empty states must not exceed it.
    expect(info!.px).toBeLessThanOrEqual(15);
  });
});
```

- [ ] **Step 2: Prove it is red (local, Browser pane)**

Read `IndexDetail.tsx:168` current classes. If the empty message renders above 15px (for example `text-cr-body` or larger, or a prose face), the oracle FAILS. Record the current computed font-size via the Browser pane.

- [ ] **Step 3: Demote the empty states to small ink-3**

In `apps/web/src/components/v2/index/IndexDetail.tsx` at the "Select something to see how it was filed" message, set the classes to `font-cr-ui text-cr-small text-cr-ink-3` (remove any larger size or prose face). Do the same for the `files/page.tsx:277` reader hint (`Select a file to open it in the reader.`): `text-cr-small text-cr-ink-3`. The StreamLens empty (`StreamLens.tsx:190`) is already `text-cr-small text-cr-ink-3`; leave it.

- [ ] **Step 4: Prove the empty-state oracle is green (local, Browser pane)**

Reload `/index` with nothing selected; confirm the inspector empty message computes font-size at most 15px and color resolves to `--cr-ink-3`.

- [ ] **Step 5: Wire the chat starters (real modes, no fake chips)**

Confirm the `AiInputMode` union in `AiInputBar.tsx`. Add an optional `initialMode` prop and an imperative focus path to `Omnibar` (or lift `mode`/`setMode` so a sibling can set them). Create `apps/web/src/components/island/ChatStarters.tsx`:

```tsx
'use client';

import type { AiInputMode } from './AiInputBar';

// Real starting affordances: each is one of the Omnibar's actual modes. Clicking
// a starter sets the live composer mode and focuses it. No fake chips, no
// hardcoded prompts. The label set mirrors the modes the Omnibar implements;
// confirm against AiInputMode before shipping.
const STARTERS: ReadonlyArray<{ mode: AiInputMode; label: string; hint: string }> = [
  { mode: 'ask', label: 'Ask the agent', hint: 'Compose over your graph' },
  { mode: 'web', label: 'Search the web', hint: 'RustyWeb, no agent' },
  // web + agents and fractal are added here once their AiInputMode values are confirmed.
];

export function ChatStarters({ onPick }: { onPick: (mode: AiInputMode) => void }) {
  return (
    <div className="flex flex-wrap gap-cr-2">
      {STARTERS.map((s) => (
        <button
          key={s.mode}
          type="button"
          onClick={() => onPick(s.mode)}
          className="flex flex-col items-start rounded-cr border border-cr-hairline px-cr-2 py-cr-1 text-left transition-colors duration-chrome ease-cr hover:bg-cr-top focus-visible:[outline:2px_solid_var(--cr-signal)] focus-visible:outline-offset-[-2px]"
        >
          <span className="font-cr-ui text-cr-small text-cr-ink">{s.label}</span>
          <span className="font-cr-ui text-cr-caption text-cr-ink-3">{s.hint}</span>
        </button>
      ))}
    </div>
  );
}
```

Render it above the Omnibar in `chat/page.tsx`, passing an `onPick` that sets the Omnibar mode and focuses the composer. Recent threads: confirm whether a Theorem session-history endpoint exists for the console chat (check `src/lib/theorem-*.ts` and the `/api/theorem/*` routes). If yes, render recent threads from it beside the starters; if no, render nothing there (do not fabricate threads).

- [ ] **Step 6: Raise Index stream density**

In `StreamLens.tsx`, tighten the row rhythm within register tokens so about twelve rows fit at 1440x900: reduce the row vertical padding on the `Row` button (for example `py-cr-2` to `py-cr-1`) and the band gap (`gap-cr-3` to `gap-cr-2`), keeping `min-h-row` and all values as `cr-` tokens (no raw px). Verify in the Browser pane at 1440x900 that the landed and open bands approach twelve visible rows without clipping.

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/components/v2/index/IndexDetail.tsx apps/web/src/app/\(console\)/files/page.tsx apps/web/src/app/\(console\)/chat/page.tsx apps/web/src/components/island/ChatStarters.tsx apps/web/src/components/island/Omnibar.tsx apps/web/src/components/v2/index/lenses/StreamLens.tsx apps/web/e2e/console-paint.spec.ts
git commit -m "feat(web): quiet console empty states, wired chat starters, denser Index stream (HP5)"
```

---

### Task 4: HP3 canvas ground plane

Spec: HP3. A register-owned canvas ground under the console foreground, adapting the contained `DotField` pattern rather than forking a parallel canvas. Register-colored (ink-3 low opacity on ground), seeded from the tenant slug, one rAF loop, suspended off-screen and on hidden tabs, single static frame under reduced motion, decorative only.

**Design gate first:** run `ui-design-pro:design-theory`, `impeccable`, and scan `Theseus/Design Components/` (the `Dotted animation surface` pattern is the closest baseline). Get the visual proposal approved. The engineering contract below is fixed.

**Files:**
- Create: `apps/web/src/components/v2/ConsoleGroundCanvas.tsx`
- Create: `apps/web/src/lib/v2/oklch-read.ts` (read a `--cr-*` oklch token to an rgb tuple)
- Modify: `apps/web/src/app/(console)/layout.tsx` (mount the canvas at the ground layer, behind `V2Shell`)
- Modify: `DESIGN.md` (motion section)

**Interfaces:**
- Consumes: `NEXT_PUBLIC_COMMONPLACE_TENANT` (client readable, default `Travis-Gilbert`); the `--cr-ink-3` and `--cr-ground` tokens.
- Produces: `<ConsoleGroundCanvas />`, a client component that paints an ambient dot texture in the ground layer, absolutely positioned, `aria-hidden`, `pointer-events: none`, `z-index: 0`, behind the sidebar and sheet.

- [ ] **Step 1: Add the oklch token reader**

Create `apps/web/src/lib/v2/oklch-read.ts`:

```ts
// Read a CSS custom property whose value is oklch(L% C H) and return an sRGB tuple.
// The existing useThemeColor hexToRgb reader cannot parse oklch; the console runs
// on oklch --cr-* tokens, so we need this. Falls back to a neutral ink-3 grey.
export function readOklchVar(varName: string, fallback: [number, number, number] = [143, 137, 128]): [number, number, number] {
  if (typeof window === 'undefined') return fallback;
  const raw = getComputedStyle(document.documentElement).getPropertyValue(varName).trim();
  const m = raw.match(/oklch\(\s*([\d.]+)%?\s+([\d.]+)\s+([\d.]+)/i);
  if (!m) return fallback;
  const L = parseFloat(m[1]) / 100, C = parseFloat(m[2]), H = (parseFloat(m[3]) * Math.PI) / 180;
  const a = C * Math.cos(H), b = C * Math.sin(H);
  const l_ = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m_ = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s_ = (L - 0.0894841775 * a - 1.2914855480 * b) ** 3;
  const lin2srgb = (v: number) => {
    const x = 4.0767416621 * l_ - 3.3077115913 * m_ + 0.2309699292 * s_;
    return x;
  };
  const R = 4.0767416621 * l_ - 3.3077115913 * m_ + 0.2309699292 * s_;
  const G = -1.2684380046 * l_ + 2.6097574011 * m_ - 0.3413193965 * s_;
  const B = -0.0041960863 * l_ - 0.7034186147 * m_ + 1.7076147010 * s_;
  const enc = (v: number) => {
    const c = v <= 0.0031308 ? 12.92 * v : 1.055 * Math.pow(v, 1 / 2.4) - 0.055;
    return Math.max(0, Math.min(255, Math.round(c * 255)));
  };
  return [enc(R), enc(G), enc(B)];
}
```

- [ ] **Step 2: Build the ground canvas (adapt DotField, add motion + suspension)**

Create `apps/web/src/components/v2/ConsoleGroundCanvas.tsx`, adapting `src/components/commonplace/shared/DotField.tsx` (djb2 + mulberry32 PRNG, dimension guards `w < 1`, `Math.min(w, 8192)`, `ResizeObserver` containment). Add on top of DotField's single draw:
- a `requestAnimationFrame` loop that animates the texture (for example a slow opacity or phase drift per dot), one loop only;
- `IntersectionObserver` to stop the loop when off screen and `document.addEventListener('visibilitychange', ...)` to stop it when the tab is hidden (DotField has neither; `DotGrid` has the IntersectionObserver pattern to copy);
- `usePrefersReducedMotion()` (`src/hooks/usePrefersReducedMotion.ts`): when reduced, draw exactly one static frame and never start the loop;
- color from `readOklchVar('--cr-ink-3')` over `readOklchVar('--cr-ground')`, at low opacity;
- seed from `djb2(process.env.NEXT_PUBLIC_COMMONPLACE_TENANT ?? 'Travis-Gilbert')`.
Render `aria-hidden`, `pointer-events: none`, absolute inset 0, `z-index: 0`.

- [ ] **Step 3: Mount at the ground layer**

In `apps/web/src/app/(console)/layout.tsx`, render `<ConsoleGroundCanvas />` as the first child inside the `<div className="porcelain ... bg-cr-ground">`, before `<V2Shell>`, so it sits behind the sidebar and sheet. The sheet is opaque `bg-cr-surface`, so the texture shows through the transparent sidebar (ground) region.

- [ ] **Step 4: Edit the motion policy in DESIGN.md**

In `DESIGN.md`, replace the "No ambient motion in the monitoring shell" line (in the Motion section) with: "Ambient motion is limited to the ground layer (a quiet canvas texture). The foreground chrome carries no ambient motion. `prefers-reduced-motion` renders a single static ground frame and removes spatial movement, shimmer, and graph interpolation." Keep the surrounding motion tokens unchanged.

- [ ] **Step 5: Verify decoration, reduced motion, and idle CPU (local, Browser pane)**

- Reduced motion: emulate `prefers-reduced-motion: reduce`; confirm the canvas paints one frame and no rAF continues (no repeated draws in the console).
- Decoration: confirm the foreground DOM (sidebar, sheet, StreamLens) is byte-identical in structure with the canvas present or absent (the canvas is `aria-hidden`, `pointer-events: none`, not a layout node).
- Idle CPU: with the tab visible but idle, confirm the loop parks when off screen or hidden (add a counter in dev and confirm it stops on `visibilitychange`). The HP3 acceptance is idle-tab CPU under one percent; the suspension paths are the mechanism.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/components/v2/ConsoleGroundCanvas.tsx apps/web/src/lib/v2/oklch-read.ts apps/web/src/app/\(console\)/layout.tsx DESIGN.md
git commit -m "feat(web): quiet canvas ground plane under the console (HP3)"
```

---

### Task 5: HP4 merge-blocking CI wiring + lint extension

Spec: HP4. Make the oracles merge-blocking and extend the CR1 literal lint and CR2 depth lint to the surfaces this work touches. The four oracles (font resolution, plane separation, divider subordination, empty-state restraint) were authored in Tasks 1 to 3; this task adds divider subordination if not yet present, wires the Playwright run into CI, and extends the lint.

**Files:**
- Modify: `apps/web/e2e/console-paint.spec.ts` (add divider subordination)
- Modify: `apps/web/scripts/lint-console-register.mjs` (add new console surfaces to the migrated set)
- Modify: `.github/workflows/commonplace-ci.yml` (add a merge-blocking `playwright test` step)

**Interfaces:**
- Consumes: `apps/web/playwright.config.ts` (testDir `./e2e`, chromium 1280x900, `webServer: npm run dev`).

- [ ] **Step 1: Add the divider subordination oracle**

Add to `apps/web/e2e/console-paint.spec.ts`:

```ts
test.describe('HP4 divider subordination', () => {
  test('a section divider label is smaller than a row title and no heavier', async ({ page }) => {
    await gotoIndex(page);
    const r = await page.evaluate(() => {
      const divider = [...document.querySelectorAll('.font-cr-mono')]
        .find((e) => (e.textContent || '').trim().toLowerCase() === 'landed');
      const rowTitle = [...document.querySelectorAll('.font-cr-ui')]
        .find((e) => /Ordinance 24-113/.test(e.textContent || ''));
      const cs = (el) => (el ? getComputedStyle(el) : null);
      const d = cs(divider), t = cs(rowTitle);
      return d && t ? { dPx: parseFloat(d.fontSize), tPx: parseFloat(t.fontSize), dW: parseInt(d.fontWeight), tW: parseInt(t.fontWeight) } : null;
    });
    expect(r, 'divider and row title present').toBeTruthy();
    expect(r!.dPx).toBeLessThan(r!.tPx);
    expect(r!.dW).toBeLessThanOrEqual(r!.tW);
  });
});
```

- [ ] **Step 2: Run the full oracle suite green (local proof via Browser pane, CI runs Playwright)**

Playwright is CI only. Locally, re-run each oracle's probe in the Browser pane against `/index` and confirm all four pass after Tasks 1 to 4. In CI (next steps) the same file runs under `playwright test`.

- [ ] **Step 3: Extend the console-register lint migrated set**

In `apps/web/scripts/lint-console-register.mjs`, add the new register-constrained component files to `MIGRATED_COMPONENTS` so CR1 and CR2 keep them literal-free: `components/v2/ConsoleGroundCanvas.tsx`, `components/island/ChatStarters.tsx`. Run: `cd apps/web && npm run lint:register`. Expected: `console-register lint clean`. Fix any flagged raw value by moving it to a `cr-` token or utility.

- [ ] **Step 4: Wire the oracle run into CI as merge-blocking**

In `.github/workflows/commonplace-ci.yml`, add a job or step that installs Playwright browsers and runs the e2e suite against the built app, for example:

```yaml
      - name: Install Playwright browsers
        run: npx playwright install --with-deps chromium
        working-directory: apps/web
      - name: Console paint oracles (HP4, merge-blocking)
        run: npm run test:e2e
        working-directory: apps/web
```

Place it so a failure fails the required check. Confirm the existing job already builds or serves the app (the Playwright `webServer` runs `npm run dev` and waits on the base URL, so a network-enabled CI install is sufficient). Keep `npm run lint:register` in the lint step so the CR1 and CR2 gates run on every PR.

- [ ] **Step 5: Prove the gate catches regressions**

Locally (Browser pane) or in a CI dry run, temporarily revert the Task 1 heading rule and confirm the font oracle would fail; flatten `GROUND_DROP` to 0 and confirm the plane oracle would fail; set a section heading to a display serif and confirm divider subordination fails. Restore. This satisfies the HP4 acceptance that reverting each fix turns a test red.

- [ ] **Step 6: Commit**

```bash
git add apps/web/e2e/console-paint.spec.ts apps/web/scripts/lint-console-register.mjs .github/workflows/commonplace-ci.yml
git commit -m "test(web): merge-blocking console-paint oracles and lint extension (HP4)"
```

---

## Self-review

**Spec coverage:** HP1 (Task 1), HP2 (Task 2), HP3 (Task 4), HP4 (oracles in Tasks 1 to 3, made merge-blocking in Task 5), HP5 (Task 3). Every HP maps to at least one task; the design doc checklist items (a) to (v) each land in a task step.

**Placeholder scan:** the two visual tasks (3 and 4) carry an explicit design-gate step, which is a required project action, not a placeholder. The one deferred confirmation (a real recent-threads endpoint for the console chat) is handled honestly: wire it if it exists, render nothing if it does not (No Fake UI). No TODO or TBD branches ship as runtime behavior.

**Type consistency:** `readOklchVar` (Task 4) returns `[number, number, number]`, consumed by `ConsoleGroundCanvas`. `AiInputMode` (Task 3) is consumed by `ChatStarters` and confirmed against `AiInputBar.tsx` at task start. `wcagContrast(a: Oklch, b: Oklch)` and `Oklch = { l, c, h }` (Task 2) match the package d.ts. The oracle file `e2e/console-paint.spec.ts` grows across Tasks 1, 2, 3, 5 with one shared `gotoIndex` helper defined in Task 1.

**Open confirmations folded into task step 1s (bounded, not placeholders):** the band override entry point (Task 2 Step 1), the `AiInputMode` union and any recent-threads endpoint (Task 3), the Galley prose scope (Task 1 Step 5).
