// SOURCING: @playwright/test. Search field oracles prove the durable naming
// split: discovery owns Command, Search, and Objects; Composer owns generation.

import { expect, test, type Page } from '@playwright/test';

async function freshLoad(page: Page) {
  await page.goto('/');
  await page.evaluate(() => localStorage.removeItem('commonplace.console.surface.v1'));
  await page.reload();
  await page.waitForSelector('[data-shell]');
  await page.waitForTimeout(600);
}

test.describe('Search field', () => {
  test.beforeEach(async ({ page }) => freshLoad(page));

  test('owns exactly Command, Search, and Objects', async ({ page }) => {
    const field = page.locator('[data-search-field]');
    await expect(field).toHaveText('Search, or press Shift Shift');
    await field.click();
    const panel = page.locator('[data-search-panel]');
    await expect(panel).toBeVisible();
    await expect(panel.locator('[data-search-mode]')).toHaveCount(3);
    await expect(panel.getByRole('button', { name: /Ask/ })).toHaveCount(0);
    await expect(panel.locator('[data-search-mode="search"]')).toHaveAttribute('aria-pressed', 'true');
    await page.keyboard.press('Escape');
    await expect(panel).toHaveCount(0);
  });

  test('double Shift opens Search and Ctrl or Cmd K opens Command', async ({ page }) => {
    await page.keyboard.press('Shift');
    await page.keyboard.press('Shift');
    await expect(page.locator('[data-search-mode="search"]')).toHaveAttribute('aria-pressed', 'true');
    await page.keyboard.press('Escape');
    await page.keyboard.press('Control+k');
    await expect(page.locator('[data-search-mode="command"]')).toHaveAttribute('aria-pressed', 'true');
  });

  test('resolves commands and live objects', async ({ page }) => {
    await page.keyboard.press('Control+k');
    const input = page.locator('[data-search-panel] input');
    await input.fill('Set theme: GitHub Dark');
    await page.getByText('Set theme: GitHub Dark', { exact: true }).click();
    await expect(page.locator('html')).toHaveAttribute('data-theme-preset', 'github-dark');

    await page.locator('[data-search-field]').click();
    await page.locator('[data-search-mode="objects"]').click();
    await page.locator('[data-search-panel] input').fill('@Ada');
    await expect(page.locator('[data-search-panel] [cmdk-item]').filter({ hasText: 'Ada Lovelace' })).toBeVisible();
  });

  test('Ctrl or Cmd L focuses Composer without opening Search', async ({ page }) => {
    await page.keyboard.press('Control+l');
    await expect(page.locator('[data-search-panel]')).toHaveCount(0);
    await expect(page.locator('[data-composer-input]')).toBeFocused();
  });

  test('holds field and panel baselines under reduced motion', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.reload();
    await page.waitForSelector('[data-shell]');
    await expect(page.locator('[data-search-field]')).toHaveScreenshot('search-field-collapsed.png');
    await page.locator('[data-search-field]').click();
    await expect(page.locator('[data-search-panel]')).toHaveScreenshot('search-panel-expanded.png');
  });
});
