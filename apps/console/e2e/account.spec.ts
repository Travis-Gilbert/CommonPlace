// SOURCING: @playwright/test. The canonical Account surface and the
// unconfigured-provider refusal are browser behavior, not static markup.

import { expect, test } from '@playwright/test';

test('opens Account inside the canonical Console and disables broken GitHub login', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => {
    localStorage.removeItem('commonplace.console.layout-cache.v1');
    localStorage.removeItem('commonplace.console.surface.v1');
  });
  await page.reload();
  await page.locator('[data-account-trigger]').click();

  await expect(page.locator('[data-shell]')).toHaveAttribute('data-active-surface', 'console-account');
  await expect(page.locator('[data-account-view]')).toBeVisible();
  const signIn = page.locator('[data-github-sign-in]');
  await expect(signIn).toBeDisabled();
  await expect(signIn).not.toHaveText('Checking GitHub login...', { timeout: 20_000 });
  await expect(signIn).toHaveText('GitHub login is not configured');
  await expect(page.getByRole('status')).toContainText('disabled');
});
