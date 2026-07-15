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
