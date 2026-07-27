// SOURCING: @playwright/test. Hunk visual milestone: the typed review route
// resolves through the Greenfield surface registry and Int UI register.

import { expect, test, type APIRequestContext, type Page } from '@playwright/test';
import { resetLocalStorageBeforeNavigation } from './storage-reset';

const STUB_BASE = `http://localhost:${process.env.STUB_DATA_API_PORT ?? '50591'}`;

async function resetStubLayout(request: APIRequestContext) {
  const response = await request.post(`${STUB_BASE}/objects/test/reset-layout`, {
    headers: { 'x-api-key': 'dev-key' },
  });
  expect(response.ok()).toBeTruthy();
}

async function openReview(page: Page) {
  await resetLocalStorageBeforeNavigation(page, {
    keys: [
      'commonplace.console.layout-cache.v1',
      'commonplace.console.surface.v1',
    ],
  });
  await page.goto('/workspace');
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect(page.locator('html')).toHaveAttribute('data-layout-ready', '1', { timeout: 30_000 });
  // Review stays a secondary layout in the toolbar switcher and Command mode.
  await page.locator('[data-layout-switcher]').click();
  await page.locator('[data-layout-option="console-review"]').click();
  await expect(page.locator('[data-active-surface="console-review"]')).toBeVisible();
  await expect(page.getByTestId('hunk-review')).toBeVisible({ timeout: 30_000 });
}

test.describe('Greenfield Hunk review', () => {
  test.beforeEach(async ({ request }) => {
    await resetStubLayout(request);
  });

  test('routes five sources through one registered view and holds the baseline', async ({ page }) => {
    await openReview(page);
    await expect(page.getByRole('listitem')).toHaveCount(5);
    for (const label of ['Agent run review', 'Morning briefing', 'Belief revision', 'App install preview', 'Schema draft']) {
      await expect(page.getByText(label)).toBeVisible();
    }
    await expect(page.getByLabel('Semiring support dial')).toHaveCount(4);
  });

  test('keeps undischarged review verify-first and emits routed named actions', async ({ page }) => {
    await openReview(page);
    const recalc = page.locator('[data-source="Recalc"]');
    await expect(recalc.getByRole('button', { name: 'Verify' })).toBeVisible();
    await expect(recalc.getByRole('button', { name: /^Accept$/ })).toHaveCount(0);
    await recalc.getByRole('button', { name: 'Show human accept' }).click();
    await recalc.getByRole('button', { name: 'Accept as human' }).click();
    await expect(recalc.locator('[data-action-status="accepted"]')).toBeVisible({
      timeout: 30_000,
    });

    await page.getByRole('listitem').first().focus();
    await page.getByTestId('hunk-review').focus();
    await page.keyboard.press('j');
    await expect(page.getByRole('listitem').nth(1)).toHaveAttribute('data-active', 'true');
    await page.keyboard.press('r');
    await expect(
      page.getByRole('listitem').nth(1).locator('[data-action-status="accepted"]'),
    ).toBeVisible({ timeout: 30_000 });

    await page.keyboard.press('Control+k');
    await expect(page.getByText('Hunk: accept active')).toBeVisible();
    await expect(page.getByText('Hunk: verify active')).toBeVisible();
  });
});
