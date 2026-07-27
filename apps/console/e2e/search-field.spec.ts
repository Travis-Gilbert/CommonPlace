// SOURCING: @playwright/test. Search panel oracles prove the durable naming
// split: discovery owns Command, Search, and Objects; Composer owns generation.
// Search is keyboard-opened (no durable toolbar field).

import { expect, test, type Page } from '@playwright/test';
import { resetLocalStorageBeforeNavigation } from './storage-reset';

const STUB_BASE = `http://localhost:${process.env.STUB_DATA_API_PORT ?? '50591'}`;

async function resetStubLayout(request: import('@playwright/test').APIRequestContext) {
  const response = await request.post(`${STUB_BASE}/objects/test/reset-layout`, {
    headers: { 'x-api-key': 'dev-key' },
  });
  expect(response.ok()).toBeTruthy();
}

async function freshLoad(page: Page, request?: import('@playwright/test').APIRequestContext) {
  if (request) await resetStubLayout(request);
  await resetLocalStorageBeforeNavigation(page, {
    keys: [
      'commonplace.console.layout-cache.v1',
      'commonplace.console.surface.v1',
    ],
  });
  await page.goto('/workspace');
  await page.waitForSelector('[data-shell]');
  await page.waitForFunction(
    () => document.documentElement.getAttribute('data-layout-ready') === '1',
    { timeout: 60_000 },
  );
}

test.describe('Search panel', () => {
  test.beforeEach(async ({ page, request }) => freshLoad(page, request));

  test('owns exactly Command, Search, and Objects', async ({ page }) => {
    await expect(page.locator('[data-search-field]')).toHaveCount(0);
    await page.keyboard.press('Shift');
    await page.keyboard.press('Shift');
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

    await page.keyboard.press('Shift');
    await page.keyboard.press('Shift');
    await page.locator('[data-search-mode="objects"]').click();
    await page.locator('[data-search-panel] input').fill('@Ada');
    await expect(page.locator('[data-search-panel] [cmdk-item]').filter({ hasText: 'Ada Lovelace' })).toBeVisible();
  });

  test('Ctrl or Cmd L focuses Composer without opening Search', async ({ page }) => {
    await page.keyboard.press('Control+l');
    await expect(page.locator('[data-search-panel]')).toHaveCount(0);
    await expect(page.locator('[data-composer-input]')).toBeFocused();
  });

  test('holds the panel baseline under reduced motion', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForSelector('[data-shell]');
    await page.waitForFunction(
      () => document.documentElement.getAttribute('data-layout-ready') === '1',
      { timeout: 60_000 },
    );
    await page.keyboard.press('Shift');
    await page.keyboard.press('Shift');
    const panel = page.locator('[data-search-panel]');
    await expect(panel).toBeVisible({ timeout: 15_000 });
    await expect(panel).toHaveScreenshot('search-panel-expanded.png', { timeout: 15_000 });
  });
});
