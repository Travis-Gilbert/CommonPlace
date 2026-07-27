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

  test('Ctrl or Cmd F scopes PAGE find to an indexed content object', async ({ page }) => {
    let findBody: {
      scopes?: Array<{ kind?: string; nodeId?: string }>;
    } | null = null;
    await page.route('**/api/search/find', async (route) => {
      findBody = route.request().postDataJSON() as typeof findBody;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          query: 'console',
          results: [],
          lanes: [],
          scopesSearched: ['page'],
          lambda: 0.8,
          retrievalRef: 'find-e2e',
        }),
      });
    });

    await page.evaluate(() => {
      document.dispatchEvent(new KeyboardEvent('keydown', {
        key: 'f',
        ctrlKey: true,
        bubbles: true,
        cancelable: true,
      }));
    });
    await page.getByRole('dialog', { name: 'Find' }).getByRole('combobox').fill('console');
    await expect.poll(() => findBody).not.toBeNull();

    const pageScope = findBody?.scopes?.find((scope) => scope.kind === 'PAGE');
    expect(pageScope?.nodeId).toBeTruthy();
    expect(pageScope?.nodeId).not.toMatch(/^console-/);
  });

  test('a palette-created Search block mounts its queryless renderer', async ({ page }) => {
    await page.locator('[data-block-palette="search"]').click();

    await expect(page.locator('[data-search-stack-view]')).toBeVisible();
    await expect(page.getByRole('tab', { name: 'Search' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
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
    await expect(panel).toBeVisible();
    await expect(panel).toHaveScreenshot('search-panel-expanded.png');
  });
});
