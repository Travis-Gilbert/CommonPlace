// SOURCING: @playwright/test. B10 acceptance #7: island ↔ stripe round-trip
// yields two applied move receipts and a stable layout after reload.

import { expect, test, type Page } from '@playwright/test';

async function settled(page: Page) {
  await page.waitForSelector('[data-shell]');
  await page.waitForFunction(
    () => document.documentElement.getAttribute('data-layout-ready') === '1',
    { timeout: 60_000 },
  );
}

async function freshLoad(page: Page) {
  await page.goto('/');
  await page.evaluate(() => {
    window.localStorage.removeItem('commonplace.console.layout-cache.v1');
    window.localStorage.removeItem('commonplace.console.surface.v1');
    document.documentElement.removeAttribute('data-island-move-receipts');
  });
  await page.reload();
  await settled(page);
}

async function openSurface(page: Page, surfaceId: string) {
  const pathBySurface: Record<string, string> = {
    'console-chat': '/chat',
    'console-workspace': '/workspace',
    'console-index': '/filing',
    'console-docs': '/documents',
    'console-cards': '/cards',
  };
  const path = pathBySurface[surfaceId];
  if (!path) throw new Error(`No route for surface ${surfaceId}`);
  // Prefer route navigation over stripe click: activateSurface + router.push
  // races the pathname→surface effect while still on the prior path.
  await page.goto(path);
  await settled(page);
  await expect(page.locator('[data-shell]')).toHaveAttribute('data-active-surface', surfaceId);
}

async function dragIslandToPromote(page: Page, viewInstanceId: string, kind: string) {
  const handle = page.locator(
    `[data-island-grid-cell="${viewInstanceId}"] [data-island-drag-handle]`,
  );
  const zone = page.locator(`[data-island-promote="${kind}"]`);
  await expect(handle).toBeVisible();
  await expect(zone).toBeVisible();
  const handleBox = await handle.boundingBox();
  const zoneBox = await zone.boundingBox();
  expect(handleBox).not.toBeNull();
  expect(zoneBox).not.toBeNull();
  await page.mouse.move(
    handleBox!.x + handleBox!.width / 2,
    handleBox!.y + handleBox!.height / 2,
  );
  await page.mouse.down();
  await page.mouse.move(zoneBox!.x + zoneBox!.width / 2, zoneBox!.y + zoneBox!.height / 2, {
    steps: 16,
  });
  await page.mouse.up();
}

test.describe('island stripe promotion', () => {
  test.beforeEach(async ({ page }) => {
    await freshLoad(page);
  });

  test('records island to stripe and back yields two move receipts', async ({ page }) => {
    await openSurface(page, 'console-cards');
    await expect(page.locator('[data-island-grid]')).toBeVisible();
    await expect(page.locator('[data-island-grid-cell="cards.vi-records"]')).toBeVisible();
    await expect(page.locator('[data-island-promote="stripe"]')).toBeVisible();

    await page.evaluate(() => {
      document.documentElement.setAttribute('data-island-move-receipts', '0');
    });

    await dragIslandToPromote(page, 'cards.vi-records', 'stripe');

    await expect(page.locator('[data-tool-window="stripe-tray"]')).toBeVisible({ timeout: 10_000 });
    await expect(
      page.locator('[data-tool-window="stripe-tray"] [data-view-instance="cards.vi-records"]'),
    ).toBeVisible();
    await expect(page.locator('[data-island-grid-cell="cards.vi-records"]')).toHaveCount(0);
    await expect.poll(async () =>
      page.evaluate(() => document.documentElement.getAttribute('data-island-move-receipts')),
    ).toBe('1');

    await page
      .locator('[data-tool-window="stripe-tray"] [data-island-return-to-grid]')
      .click();

    await expect(page.locator('[data-island-grid-cell="cards.vi-records"]')).toBeVisible({
      timeout: 10_000,
    });
    await expect.poll(async () =>
      page.evaluate(() => document.documentElement.getAttribute('data-island-move-receipts')),
    ).toBe('2');

    await page.reload();
    await settled(page);
    await expect(page.locator('[data-shell]')).toHaveAttribute('data-active-surface', 'console-cards');
    await expect(page.locator('[data-island-grid-cell="cards.vi-records"]')).toBeVisible();
    await expect(
      page.locator('[data-tool-window="stripe-tray"] [data-view-instance="cards.vi-records"]'),
    ).toHaveCount(0);
  });
});
