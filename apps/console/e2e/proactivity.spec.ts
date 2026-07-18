// SOURCING: @playwright/test. The proactivity graph visual milestone (PG2, PG7
// gates 5 and 8): the editable standing graph resolves through the registered
// view and the Int UI register, renders the five states honestly, shows the
// two-sided convergence (join honesty), and disabling a source degrades its
// watches out loud. Every check runs under reduced motion, so the reduced-motion
// pass is the baseline: static and legible.

import { expect, test, type Page } from '@playwright/test';

async function openProactivity(page: Page) {
  await page.goto('/');
  await page.evaluate(() => {
    window.localStorage.removeItem('commonplace.console.surface.v1');
    // The store now scopes its key by tenant, so clear every proactivity key.
    for (const key of Object.keys(window.localStorage)) {
      if (key.startsWith('commonplace.console.proactivity.v1')) window.localStorage.removeItem(key);
    }
  });
  await page.reload();
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  // Proactivity is a secondary surface reached through the layout switcher, like
  // Review and Appearance (the coloration IA); it is not in the primary stripe.
  await page.locator('[data-layout-switcher]').click();
  await page.locator('[data-layout-option="console-proactivity"]').click();
  await expect(page.locator('[data-surface="proactivity"]')).toBeVisible();
}

test.describe('Proactivity graph surface', () => {
  test('renders the standing structure as sentences with honest permission and frontier wording', async ({ page }) => {
    await openProactivity(page);

    // The default altitude is the sentence list (PG3), and it reads plainly.
    await expect(page.getByText('"Get the insurance appeal resolved before the deadline" matters to me.')).toBeVisible();

    // Frontier honesty (gate 7): a bounded label names the frontier, never "all".
    await expect(page.getByText(/with more beyond what has been explored \(2 pruned\)/)).toBeVisible();

    // Permission renders on every response (named choice 7): a response that
    // could send an email but has no grant says so; a granted one names its
    // date; an over-budget one says it is not running.
    await expect(page.getByText('will ask you every time').first()).toBeVisible();
    await expect(page.getByText(/can act on its own, granted 2026-06-30, revocable/)).toBeVisible();
    await expect(page.getByText('over budget, not running')).toBeVisible();

    // The human-authored watch carries its author tag.
    await expect(page.getByText('yours')).toBeVisible();

    await expect(page).toHaveScreenshot('proactivity-1440-dark.png', { fullPage: true });
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

    // The layered layout resolves (elk runs) and the join is named.
    await expect(page.getByText(/A watch fires only where both converge/)).toBeVisible();
    await expect(page.getByRole('group', { name: 'The standing proactivity graph' })).toBeVisible();
    await expect(page.getByRole('button', { name: /The adjuster replies on the appeal/ })).toBeVisible();

    await expect(page).toHaveScreenshot('proactivity-graph-1440-dark.png', { fullPage: true });
  });
});
