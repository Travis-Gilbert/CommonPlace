import { test, expect, type Page } from '@playwright/test';

/*
 * Console paint oracles (HP4). These drive the real /index console surface (no
 * mock routes) and assert computed styles, turning silent paint-layer failures
 * into merge-blocking red tests:
 *   - HP1 font resolution: chrome titles render the UI sans face, not the serif.
 *   - HP2 plane separation: sidebar ground and content sheet differ in lightness.
 *   - HP4 divider subordination: a divider label is smaller and no heavier than a row.
 *   - HP5 empty-state restraint: empty messages render at most body size.
 * Playwright is not resolvable from the offline pnpm store locally; this suite
 * runs in CI. Local proof is the in-app Browser pane computed-style probe.
 */

// The console index route (route groups do not appear in the URL).
const INDEX = '/index';

async function gotoIndex(page: Page) {
  await page.goto(INDEX, { waitUntil: 'domcontentloaded' });
  // Wait for the Stream lens to paint at least one section heading.
  await page.getByRole('heading', { name: 'What landed' }).waitFor({ state: 'visible' });
}

test.describe('HP1 font resolution', () => {
  test('section heading and row title render the UI sans face, not the prose serif', async ({ page }) => {
    await gotoIndex(page);

    const headingFamily = await page.evaluate(() => {
      const h = [...document.querySelectorAll('h2')].find((e) => /What landed/.test(e.textContent || ''));
      return h ? getComputedStyle(h).fontFamily : null;
    });
    const rowTitleFamily = await page.evaluate(() => {
      const el = [...document.querySelectorAll('.font-cr-ui')].find((e) => /Ordinance 24-113/.test(e.textContent || ''));
      return el ? getComputedStyle(el).fontFamily : null;
    });

    expect(headingFamily, 'section heading fontFamily').toBeTruthy();
    expect(headingFamily!).toMatch(/IBM Plex Sans/);
    expect(headingFamily!).not.toMatch(/Vollkorn/i); // the prose serif FACE; note the correct sans stack ends in "sans-serif"

    expect(rowTitleFamily, 'row title fontFamily').toBeTruthy();
    expect(rowTitleFamily!).toMatch(/IBM Plex Sans/);
    expect(rowTitleFamily!).not.toMatch(/Vollkorn/i); // the prose serif FACE; note the correct sans stack ends in "sans-serif"
  });
});

// The register guarantees at least this OKLCH-L step between the planes. Stock
// was 0.022 (fails); HP2 widens to 0.052.
const PLANE_MIN_DELTA = 0.04;

test.describe('HP2 plane separation', () => {
  test('sidebar ground and content sheet differ by at least the register delta', async ({ page }) => {
    await gotoIndex(page);
    // The conversion runs in the page; the whole callback is serialized by
    // Playwright, so the helper is defined inline (no eval, no injected source).
    const { groundL, surfaceL } = await page.evaluate(() => {
      // Computed background to OKLCH L in [0,1]. Chromium may report rgb() or lab().
      const oklchL = (css: string | null): number | null => {
        if (!css) return null;
        const lab = css.match(/lab\(\s*([\d.]+)/);
        if (lab) return parseFloat(lab[1]) / 100; // lab L is already ~perceptual, 0..100
        const nums = css.match(/\d+(?:\.\d+)?/g);
        if (!nums) return null;
        const [r8, g8, b8] = nums.map(Number);
        const lin = (v: number) => { v /= 255; return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
        const r = lin(r8), g = lin(g8), b = lin(b8);
        const l_ = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
        const m_ = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
        const s_ = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
        return 0.2104542553 * l_ + 0.7936177850 * m_ - 0.0040720468 * s_;
      };
      const railHost = document.querySelector('.porcelain');
      const sheet = [...document.querySelectorAll('[class]')]
        .find((e) => /bg-cr-surface/.test((e as HTMLElement).className.toString?.() || ''));
      const bg = (el: Element | null) => (el ? getComputedStyle(el).backgroundColor : null);
      return { groundL: oklchL(bg(railHost)), surfaceL: oklchL(bg(sheet)) };
    });
    expect(groundL, 'ground L').toBeTruthy();
    expect(surfaceL, 'surface L').toBeTruthy();
    expect(Math.abs(surfaceL! - groundL!)).toBeGreaterThanOrEqual(PLANE_MIN_DELTA);
  });
});

test.describe('HP4 divider subordination', () => {
  test('a section divider label is smaller than a row title and no heavier', async ({ page }) => {
    await gotoIndex(page);
    const r = await page.evaluate(() => {
      const divider = [...document.querySelectorAll('.font-cr-mono')]
        .find((e) => (e.textContent || '').trim().toLowerCase() === 'landed');
      const rowTitle = [...document.querySelectorAll('.font-cr-ui')]
        .find((e) => /Ordinance 24-113/.test(e.textContent || ''));
      const cs = (el: Element | null | undefined) => (el ? getComputedStyle(el) : null);
      const d = cs(divider), t = cs(rowTitle);
      return d && t ? { dPx: parseFloat(d.fontSize), tPx: parseFloat(t.fontSize), dW: parseInt(d.fontWeight, 10), tW: parseInt(t.fontWeight, 10) } : null;
    });
    expect(r, 'divider and row title present').toBeTruthy();
    expect(r!.dPx).toBeLessThan(r!.tPx);
    expect(r!.dW).toBeLessThanOrEqual(r!.tW);
  });
});

test.describe('HP5 empty-state restraint', () => {
  test('the inspector empty state renders at most body size', async ({ page }) => {
    await gotoIndex(page);
    // With nothing selected, the inspector shows its empty message.
    const info = await page.evaluate(() => {
      // Target the element that actually renders the text (a <p>), not an
      // ancestor: an ancestor inherits the console base (15px) and would mask a
      // regression that bumped the message itself to body size.
      const el = [...document.querySelectorAll('p')]
        .find((e) => (e.textContent || '').startsWith('Select something to see how it was filed'));
      if (!el) return null;
      return { px: parseFloat(getComputedStyle(el).fontSize) };
    });
    expect(info, 'inspector empty state present').toBeTruthy();
    // Body size at the console 15px base is 15px; empty states must not exceed it.
    expect(info!.px).toBeLessThanOrEqual(15);
  });
});
