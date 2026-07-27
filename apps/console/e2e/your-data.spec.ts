// SOURCING: @playwright/test. Console 1.0 acceptance proves the normal consent
// path, descriptor mounting, direct reopen, unmount on uninstall, and each
// read-only web surface against the shared WASM fixture.

import { expect, test, type Page } from '@playwright/test';

const LAYOUT_CACHE_KEY = 'commonplace.console.layout-cache.v1';
const SURFACE_KEY = 'commonplace.console.surface.v1';
const STUB_DATA_API_ORIGIN =
  `http://localhost:${process.env.STUB_DATA_API_PORT ?? '50591'}`;

async function resetProfile(page: Page): Promise<void> {
  for (const endpoint of [
    `${STUB_DATA_API_ORIGIN}/objects/test/reset-layout`,
    `${STUB_DATA_API_ORIGIN}/objects/test/reset-console-plugin`,
  ]) {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'x-api-key': 'dev-key' },
    });
    if (!response.ok) throw new Error(`Fixture reset failed: ${endpoint}`);
  }
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.emulateMedia({ colorScheme: 'dark', reducedMotion: 'reduce' });
  await page.goto('/v/index');
  await page.evaluate(([layout, surface]) => {
    localStorage.removeItem(layout);
    localStorage.removeItem(surface);
  }, [LAYOUT_CACHE_KEY, SURFACE_KEY]);
  await page.reload();
  await expect(page.locator('[data-shell]')).toBeVisible();
}

async function openLayout(page: Page, surfaceId: string): Promise<void> {
  await page.locator('[data-layout-switcher]').click();
  await page.locator(`[data-layout-option="${surfaceId}"]`).click();
}

async function installFromAppearance(page: Page): Promise<void> {
  await openLayout(page, 'console-appearance');
  const entry = page.locator('[data-appearance-view] [data-your-data-entry]');
  await expect(entry).toBeVisible();
  await entry.locator('[data-your-data-open]').click();
  const consent = page.locator('[data-your-data-consent]');
  await expect(consent).toBeVisible();
  await expect(consent).toContainText('Read through the authenticated CommonPlace door.');
  await expect(consent).toContainText('Write your data or use arbitrary network endpoints.');
  await consent.locator('[data-your-data-consent-allow]').click();
  await expect(page.locator('[data-console-data-view]')).toBeVisible({ timeout: 30_000 });
}

test.describe('Your data plugin', () => {
  test.beforeEach(async ({ page }) => resetProfile(page));

  test('installs, renders all surfaces, reopens, unmounts, and appears in Index settings', async ({ page }) => {
    await installFromAppearance(page);

    await expect(page.locator('[data-console-surface="overview"]')).toContainText('4', {
      timeout: 30_000,
    });
    await expect(page).toHaveScreenshot('your-data-overview-1440-dark.png', {
      animations: 'disabled',
    });

    await page.getByRole('tab', { name: 'Entities' }).click();
    const entities = page.locator('[data-console-surface="entities"]');
    await expect(entities).toContainText('Ada Lovelace');
    await expect(entities).toContainText('Merge receipts');
    await expect(entities).toContainText('Doppelganger candidates');

    await page.getByRole('tab', { name: 'Receipts' }).click();
    const receipts = page.locator('[data-console-surface="receipts"]');
    await expect(receipts).toContainText('Page 1 of 2. 4 receipts.');
    await receipts.getByRole('button', { name: 'Next' }).click();
    await expect(receipts).toContainText('Page 2 of 2. 4 receipts.');

    await page.getByRole('tab', { name: 'Watch' }).click();
    const watch = page.locator('[data-console-surface="watch"]');
    await expect(watch.getByRole('list', { name: 'Standing query shapes' })).toBeVisible();
    await expect(watch).toContainText('golden:person:ada');

    await page.setViewportSize({ width: 1024, height: 768 });
    await page.getByRole('tab', { name: 'Graph' }).click();
    const graph = page.locator('[data-console-surface="graph"]');
    await expect(graph.locator('[data-console-cosmos-graph]')).toBeVisible({
      timeout: 30_000,
    });
    await graph.getByRole('button', { name: /Ada Lovelace/ }).click();
    await expect(graph).toContainText('golden:person:ada');
    await expect(graph).toContainText('10496215397300334112');
    await expect(page).toHaveScreenshot('your-data-graph-compact-dark.png', {
      animations: 'disabled',
    });
    await page.setViewportSize({ width: 1440, height: 1000 });

    const installedResponse = await page.request.get('/api/console-plugin/state');
    expect(installedResponse.ok()).toBe(true);
    expect(await installedResponse.json()).toMatchObject({
      state: 'installed',
      grants: ['corpus:read'],
      contributions: ['pane:commonplace.console'],
    });

    await openLayout(page, 'console-appearance');
    const installedEntry = page.locator('[data-appearance-view] [data-your-data-entry]');
    await expect(installedEntry).toHaveAttribute('data-your-data-state', 'installed');
    await installedEntry.locator('[data-your-data-open]').click();
    await expect(page.locator('[data-your-data-consent]')).toHaveCount(0);
    await expect(page.locator('[data-console-data-view]')).toBeVisible({ timeout: 30_000 });

    await openLayout(page, 'console-appearance');
    await page.locator('[data-appearance-view] [data-your-data-uninstall]').click();
    await expect(page.locator('[data-console-data-view]')).toHaveCount(0);
    await expect(page.locator('[data-appearance-view] [data-your-data-entry]')).toHaveAttribute(
      'data-your-data-state',
      'available',
    );
    await expect(
      page.locator('[data-appearance-view] [data-your-data-open]'),
    ).toBeEnabled();

    await page.locator('[data-layout-switcher]').click();
    await expect(page.locator('[data-layout-option="console-your-data"]')).toHaveCount(0);
    await page.keyboard.press('Escape');

    await page.locator('[data-surface-nav="console-index"]').click();
    await expect(page.locator('[data-shell]')).toHaveAttribute('data-active-surface', 'console-index');
    await page.getByRole('tab', { name: 'Rules' }).click();
    const entry = page.locator('[data-filing-rules] [data-your-data-entry]');
    await expect(entry).toBeVisible();
    await entry.locator('[data-your-data-open]').click();
    await expect(page.locator('[data-your-data-consent]')).toBeVisible();
    await page.locator('[data-your-data-deny]').click();
    await expect(entry).toHaveAttribute('data-your-data-state', 'denied');
  });
});
