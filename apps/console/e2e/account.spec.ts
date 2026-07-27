// SOURCING: @playwright/test. The canonical Account surface and the
// unconfigured-provider refusal are browser behavior, not static markup.

import { expect, test } from '@playwright/test';
import { resetLocalStorageBeforeNavigation } from './storage-reset';

test('opens Account inside the canonical Console and disables broken GitHub login', async ({ page }) => {
  await resetLocalStorageBeforeNavigation(page, {
    keys: [
      'commonplace.console.layout-cache.v1',
      'commonplace.console.surface.v1',
    ],
  });
  await page.goto('/workspace');
  await page.waitForFunction(
    () => document.documentElement.getAttribute('data-layout-ready') === '1',
    { timeout: 60_000 },
  );
  await page.locator('[data-account-trigger]').click();

  await expect(page.locator('[data-shell]')).toHaveAttribute('data-active-surface', 'console-account');
  await expect(page.locator('[data-account-view]')).toBeVisible();
  await expect(page.getByText('Checking your session...')).toHaveCount(0, { timeout: 20_000 });
  const signIn = page.locator('[data-github-sign-in]');
  await expect(signIn).toBeDisabled({ timeout: 20_000 });
  await expect(signIn).not.toHaveText('Checking GitHub login...', { timeout: 20_000 });
  await expect(signIn).toHaveText('GitHub login is not configured');
  await expect(page.getByRole('status')).toContainText('disabled');
});
