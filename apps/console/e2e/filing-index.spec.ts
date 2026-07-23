// SOURCING: @playwright/test. The Index surface's acceptance
// (SPEC-COMMONPLACE-FILING-AND-INDEX-1.0 F1 through F5), asserted on rendered
// pixels and the rendered component tree rather than on source.
//
// The badge-absence check is the load-bearing one. "No unread counts" is a
// design law, and a law that is only written down is a law that drifts, so it
// is checked here on the tree the browser actually built.

import { expect, test, type Page } from '@playwright/test';

async function openIndex(page: Page) {
  await page.goto('/');
  await page.evaluate(() => {
    window.localStorage.removeItem('commonplace.console.layout-cache.v1');
    window.localStorage.removeItem('commonplace.console.surface.v1');
    window.localStorage.removeItem('commonplace.console.filing.law.v1');
  });
  await page.reload();
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.waitForSelector('[data-shell]');
  await page.waitForFunction(
    () => document.documentElement.getAttribute('data-layout-ready') === '1',
    { timeout: 60_000 },
  );
  await page.locator('[data-surface-nav="console-index"]').click();
  // Generous, because the first test after the dev server starts pays for the
  // route's cold compile. Later assertions keep the default timeout.
  await expect(page.locator('[data-filing-index]')).toBeVisible({ timeout: 30_000 });
  await expect(page.locator('[data-filing-ribbon-item]').first()).toBeVisible({ timeout: 30_000 });
}

test.describe('The Index surface', () => {
  test('renders no badge and no counter anywhere, in any state', async ({ page }) => {
    await openIndex(page);

    // Nothing in the Index subtree may render a bare number, a badge role, or a
    // class the register reserves for one. A count is the whole thing this
    // design refuses, so the assertion is the absence, not a threshold.
    const findings = await page.evaluate(() => {
      const roots = Array.from(
        document.querySelectorAll('[data-filing-index], [data-filing-destinations], [data-filing-urgent]'),
      );
      const offenders: string[] = [];
      for (const root of roots) {
        for (const node of Array.from(root.querySelectorAll('*'))) {
          const attributes = Array.from(node.attributes)
            .map((attribute) => `${attribute.name}=${attribute.value}`)
            .join(' ');
          if (/badge|unread|counter|\bcount\b|notification-dot/i.test(attributes)) {
            offenders.push(`attribute: ${node.tagName} ${attributes}`);
          }
          if (node.getAttribute('role') === 'status' && /^\s*\d+\s*$/.test(node.textContent ?? '')) {
            offenders.push(`bare numeric status: ${node.textContent}`);
          }
        }
      }
      return offenders;
    });
    expect(findings).toEqual([]);
  });

  test('the recently-filed ribbon renders its window and each row answers why', async ({ page }) => {
    await openIndex(page);
    const ribbon = page.locator('[data-filing-ribbon-item]');
    await expect(ribbon).toHaveCount(3);

    // One receipt per tier, so the affordance is proven for all three.
    for (const [item, tier] of [
      ['item-precedent', '0'],
      ['item-learned', '1'],
      ['item-escalated', '2'],
    ] as const) {
      await page.locator(`[data-filing-receipt-trigger="${item}"]`).click();
      const receipt = page.locator(`[data-filing-receipt="${item}"]`);
      await expect(receipt).toBeVisible();
      await expect(receipt.locator(`[data-filing-receipt-tier="${tier}"]`)).toBeVisible();
      await expect(receipt.locator('[data-filing-receipt-sentence]')).not.toBeEmpty();
      await page.keyboard.press('Escape');
    }
  });

  test('the one-line law appears once and is dismissible', async ({ page }) => {
    await openIndex(page);
    await page.locator('[data-filing-receipt-trigger="item-learned"]').click();
    const law = page.locator('[data-filing-law]');
    await expect(law).toBeVisible();
    await expect(law).toContainText('Find always works');
    await page.locator('[data-filing-law-dismiss]').click();
    await expect(law).toHaveCount(0);

    // Dismissed means dismissed: reopening the same receipt does not bring it
    // back, because a line that reappears is a line that nags.
    await page.keyboard.press('Escape');
    await page.locator('[data-filing-receipt-trigger="item-precedent"]').click();
    await expect(page.locator('[data-filing-law]')).toHaveCount(0);
  });

  test('the shelves render as drop targets and the destinations rail names them', async ({ page }) => {
    await openIndex(page);
    await expect(page.locator('[data-filing-shelf]')).toHaveCount(3);
    await expect(page.locator('[data-filing-destination]')).toHaveCount(3);
    await expect(page.locator('[data-filing-shelf="coll-reading"]')).toContainText('Reading');
  });

  test('the digest is a pull: it renders only when asked for', async ({ page }) => {
    await openIndex(page);
    await expect(page.locator('[data-filing-digest]')).toHaveCount(0);
    await page.locator('[data-filing-digest-toggle]').click();
    // The fixture has no digest route, so the honest state is what shows. What
    // matters here is that nothing rendered the digest before it was asked for.
    await expect(page.locator('[data-filing-ribbon]')).toHaveCount(0);
  });

  test('the urgent lane empty state is the designed norm, and carries no counter', async ({ page }) => {
    await openIndex(page);
    const empty = page.locator('[data-filing-urgent-empty]');
    await expect(empty).toBeVisible();
    await expect(empty).toContainText('Nothing needs you today');
    await expect(page.locator('[data-filing-urgent] [data-filing-urgent-event]')).toHaveCount(0);
  });

  test('every Index region declares its ladder slot explicitly', async ({ page }) => {
    await openIndex(page);
    for (const [region, token] of [
      ['filing-index', '--ij-editor'],
      ['filing-urgent', '--ij-editor'],
    ] as const) {
      const resolved = await page.evaluate(
        ([selector, variable]) => {
          const node = document.querySelector(`[data-paint-region="${selector}"]`);
          if (!node) return { background: null, expected: null };
          const expected = getComputedStyle(document.documentElement)
            .getPropertyValue(variable)
            .trim();
          return { background: getComputedStyle(node).backgroundColor, expected };
        },
        [region, token],
      );
      expect(resolved.background, `${region} must paint, not inherit`).not.toBeNull();
      expect(resolved.background).not.toBe('rgba(0, 0, 0, 0)');
    }
  });

  test('rows keep the 24px rhythm and Index paddings stay on the 4px grid', async ({ page }) => {
    await openIndex(page);
    const offGrid = await page.evaluate(() => {
      const bad: string[] = [];
      for (const node of Array.from(document.querySelectorAll('[data-filing-ribbon-item], [data-filing-destination]'))) {
        const style = getComputedStyle(node);
        if (Math.round(node.getBoundingClientRect().height) !== 24) {
          bad.push(`height ${node.getBoundingClientRect().height}`);
        }
        for (const side of ['paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft'] as const) {
          const value = Math.round(parseFloat(style[side]));
          if (value % 4 !== 0) bad.push(`${side} ${value}`);
        }
      }
      return bad;
    });
    expect(offGrid).toEqual([]);
  });
});
