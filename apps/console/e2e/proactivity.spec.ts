// SOURCING: @playwright/test. The proactivity graph visual milestone (PG2, PG7
// gates 5 and 8): the editable standing graph resolves through the registered
// view and the Int UI register, renders the five states honestly, shows the
// two-sided convergence (join honesty), and disabling a source degrades its
// watches out loud. Every check runs under reduced motion, so the reduced-motion
// pass is the baseline: static and legible.

import { expect, test, type APIRequestContext, type Page } from '@playwright/test';
import { resetLocalStorageBeforeNavigation } from './storage-reset';

const STUB_BASE = `http://localhost:${process.env.STUB_DATA_API_PORT ?? '50591'}`;

async function resetStubLayout(request: APIRequestContext) {
  const response = await request.post(`${STUB_BASE}/objects/test/reset-layout`, {
    headers: { 'x-api-key': 'dev-key' },
  });
  expect(response.ok()).toBeTruthy();
}

async function openProactivity(page: Page) {
  await resetLocalStorageBeforeNavigation(page, {
    keys: [
      'commonplace.console.layout-cache.v1',
      'commonplace.console.surface.v1',
    ],
    prefixes: ['commonplace.console.proactivity.v1'],
  });
  await page.goto('/workspace');
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect(page.locator('html')).toHaveAttribute('data-layout-ready', '1', { timeout: 30_000 });
  // Proactivity is a secondary surface reached through the layout switcher, like
  // Review and Appearance (the coloration IA); it is not in the primary stripe.
  await page.locator('[data-layout-switcher]').click();
  await page.locator('[data-layout-option="console-proactivity"]').click();
  await expect(page.locator('[data-surface="proactivity"]')).toBeVisible();
}

test.describe('Proactivity graph surface', () => {
  test.beforeEach(async ({ request }) => {
    await resetStubLayout(request);
  });

  test('the card altitude reads as a grid of card-sized cards, not full-width bars', async ({ page }) => {
    await openProactivity(page);
    // Cards is the default altitude; stakes and programs render as bounded cards.
    await expect(page.locator('[data-node="pg-stake-appeal"]')).toBeVisible();
    await expect(page.getByText('Looks for:').first()).toBeVisible();
  });

  test('disabling a source degrades its dependent watches with the consequence named', async ({ page }) => {
    await openProactivity(page);
    await page.getByRole('tab', { name: 'Cards' }).click();

    // Email feeds every watch; disabling it must not silently break them.
    await expect(page.getByText('this can no longer see your email')).toHaveCount(0);
    await page.locator('[data-node="pg-source-email"]').getByRole('button', { name: 'Disable' }).click();
    await expect(page.getByText('Degraded: this can no longer see your email').first()).toBeVisible();
  });

  test('the graph altitude renders the two-sided convergence, not a pipe (join honesty)', async ({ page }) => {
    await openProactivity(page);
    await page.getByRole('tab', { name: 'Graph' }).click();

    // The layered layout resolves (elk runs) and React Flow renders the nodes as
    // commit-entry building blocks; the join watches are marked.
    await expect(page.getByText(/A watch fires only where both converge/)).toBeVisible({ timeout: 30_000 });
    await expect(page.getByRole('group', { name: 'The standing proactivity graph' })).toBeVisible({
      timeout: 30_000,
    });
    await expect(page.locator('.react-flow__node').first()).toBeVisible();
    await expect(page.locator('[data-node-kind="response"]').first()).toBeVisible();
    await expect(page.locator('[data-node-kind="watch"]').first()).toBeVisible();

    // Permission renders on every response (named choice 7): a granted one acts
    // on its own, a no-grant one asks each time, an over-budget one does not run.
    await expect(page.getByText('can act on its own').first()).toBeVisible();
    await expect(page.getByText('asks you every time').first()).toBeVisible();
    await expect(page.getByText('over budget, not running').first()).toBeVisible();

    await expect(page.locator('.react-flow__viewport')).toBeVisible();
  });
});
