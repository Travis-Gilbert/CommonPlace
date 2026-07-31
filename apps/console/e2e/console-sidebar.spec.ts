// SOURCING: @playwright/test. HANDOFF-CONSOLE-SIDEBAR acceptance: labels on when
// expanded, collapse rail, Cmd/Ctrl surface switch, landmarks zone present,
// landmark to ground with cleared-cache restore from server layout.

import { expect, test, type APIRequestContext, type Page } from '@playwright/test';
import { resetLocalStorageBeforeNavigation } from './storage-reset';

const LAYOUT_CACHE_KEY = 'commonplace.console.layout-cache.v1';
const LEGACY_SURFACE_KEY = 'commonplace.console.surface.v1';
const STUB_BASE = `http://localhost:${process.env.STUB_DATA_API_PORT ?? '50591'}`;

async function resetStubLayout(request: APIRequestContext) {
  const response = await request.post(`${STUB_BASE}/objects/test/reset-layout`, {
    headers: { 'x-api-key': 'dev-key' },
  });
  expect(response.ok()).toBeTruthy();
}

async function waitForServerLayout(request: APIRequestContext) {
  await expect.poll(async () => {
    const response = await request.post(`${STUB_BASE}/objects/query`, {
      headers: { 'x-api-key': 'dev-key', 'content-type': 'application/json' },
      data: { types: ['surface', 'region', 'view-instance'], page: { limit: 500 } },
    });
    if (!response.ok()) return 0;
    const body = (await response.json()) as { objects?: Array<{ id: string }> };
    const ids = new Set((body.objects ?? []).map((object) => object.id));
    return ids.has('console-chat') && ids.has('console.region-landmarks') ? 1 : 0;
  }, { timeout: 60_000 }).toBe(1);
}

async function settled(page: Page) {
  await page.waitForSelector('[data-shell]');
  await page.waitForFunction(
    () =>
      document.documentElement.getAttribute('data-layout-ready') === '1'
      && document.documentElement.getAttribute('data-place-shortcuts-ready') === '1',
    { timeout: 60_000 },
  );
}

async function freshLoad(page: Page) {
  await resetLocalStorageBeforeNavigation(page, {
    keys: [LAYOUT_CACHE_KEY, LEGACY_SURFACE_KEY],
  });
  await page.goto('/workspace');
  await settled(page);
}

test.describe('Console sidebar', () => {
  test.beforeEach(async ({ page, request }) => {
    await resetStubLayout(request);
    await freshLoad(page);
  });

  test('expanded labels identify every view without hover', async ({ page }) => {
    const rail = page.locator('[data-surface-rail]');
    await expect(rail.getByRole('radio', { name: 'Chat view' })).toContainText('Chat');
    await expect(rail.getByRole('radio', { name: 'Researcher view' })).toContainText('Researcher');
    await expect(rail.getByRole('radio', { name: 'Index view' })).toContainText('Index');
    await expect(rail.getByRole('radio', { name: 'Editor view' })).toContainText('Editor');
    await expect(rail.getByRole('radio', { name: 'Models view' })).toContainText('Models');
    await expect(page.getByRole('region', { name: 'Pins' })).toHaveCount(1);
  });

  test('Cmd or Ctrl B collapses and expands the rail', async ({ page }) => {
    const nav = page.locator('nav[aria-label="Views, blocks, objects, and pins"]');
    await expect(nav).toHaveAttribute('data-sidebar-collapsed', 'false');
    await page.keyboard.press('Meta+b');
    await expect(nav).toHaveAttribute('data-sidebar-collapsed', 'true');
    await page.keyboard.press('Meta+b');
    await expect(nav).toHaveAttribute('data-sidebar-collapsed', 'false');
  });

  test('Cmd or Ctrl 1 through 5 reach all five views', async ({ page }) => {
    const targets = [
      ['1', 'console-chat', '/chat'],
      ['2', 'console-survey', '/indexer'],
      ['3', 'console-index', '/filing'],
      ['4', 'console-workspace', '/workspace'],
      ['5', 'console-models', '/Data-model'],
    ] as const;

    for (const [key, id, path] of targets) {
      await page.goto('/workspace');
      await settled(page);
      await page.evaluate((digit) => {
        window.dispatchEvent(new KeyboardEvent('keydown', {
          key: digit,
          code: `Digit${digit}`,
          ctrlKey: true,
          bubbles: true,
          cancelable: true,
        }));
      }, key);
      await expect(page).toHaveURL(new RegExp(`${path.replace('/', '\\/')}$`), {
        timeout: 60_000,
      });
      if (id === 'console-chat') {
        await expect(
          page.getByRole('heading', { name: 'Select a workspace' }),
        ).toBeVisible({ timeout: 15_000 });
        await expect(page.locator('[data-chat-composer]')).toHaveCount(0);
      } else {
        await expect(page.locator('[data-shell]')).toHaveAttribute('data-active-surface', id, {
          timeout: 15_000,
        });
        await settled(page);
      }
    }
  });

  test('Data model route mounts the canonical canvas with page proportions', async ({ page }) => {
    test.setTimeout(180_000);
    await page.goto('/Data-model');
    await settled(page);
    await expect(page.locator('[data-shell]')).toHaveAttribute(
      'data-active-surface',
      'console-models',
    );
    await expect(page.getByTestId('model-canvas-shell')).toBeVisible({
      timeout: 120_000,
    });
    await expect(page.locator('[data-model-inspector]')).toHaveCSS('width', '320px');
  });

  test('Program route mounts the canonical Program Canvas surface', async ({ page }) => {
    test.setTimeout(180_000);
    await page.goto('/program');
    await settled(page);
    await expect(page.locator('[data-shell]')).toHaveAttribute(
      'data-active-surface',
      'console-program',
    );
    await expect(page.locator('[data-program-canvas]')).toBeVisible({
      timeout: 120_000,
    });
  });

  test('landmark to ground survives cleared localStorage via server layout', async ({ page, request }) => {
    test.setTimeout(120_000);
    await resetStubLayout(request);
    await freshLoad(page);
    await waitForServerLayout(request);

    await page.goto('/cards');
    await settled(page);
    await expect(page.locator('[data-shell]')).toHaveAttribute('data-active-surface', 'console-cards');
    await expect(page.locator('[data-block-arrangement]')).toBeVisible();

    const landmark = page.locator('[data-sidebar-landmark]').first();
    await expect(landmark).toBeVisible({ timeout: 10_000 });
    const landmarkId = await landmark.getAttribute('data-sidebar-landmark');
    expect(landmarkId).toBeTruthy();
    const instanceId = landmarkId!.startsWith('console.landmark-')
      ? landmarkId!
      : `console.landmark-record-${landmarkId}`;

    await page.evaluate(() => {
      document.documentElement.setAttribute('data-block-move-receipts', '0');
    });

    const arrangement = page.locator('[data-block-arrangement]');
    const arrangementBox = await arrangement.boundingBox();
    expect(arrangementBox).not.toBeNull();
    await landmark.dispatchEvent('dragend', {
      clientX: arrangementBox!.x + arrangementBox!.width / 2,
      clientY: arrangementBox!.y + arrangementBox!.height / 2,
    });

    await expect(page.locator(`[data-block-canvas-cell="${instanceId}"]`)).toBeVisible({
      timeout: 10_000,
    });
    await expect.poll(async () =>
      page.evaluate(() => document.documentElement.getAttribute('data-block-move-receipts')),
    ).toBe('1');

    const nav = page.locator('nav[aria-label="Views, blocks, objects, and pins"]');
    await page.keyboard.press('Meta+b');
    await expect(nav).toHaveAttribute('data-sidebar-collapsed', 'true');
    await page.waitForTimeout(400);

    await page.evaluate(([layoutKey, legacyKey]) => {
      localStorage.removeItem(layoutKey);
      localStorage.removeItem(legacyKey);
    }, [LAYOUT_CACHE_KEY, LEGACY_SURFACE_KEY] as const);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await settled(page);
    await waitForServerLayout(request);

    await expect(page.locator(`[data-block-canvas-cell="${instanceId}"]`)).toBeVisible({
      timeout: 15_000,
    });
    await expect(nav).toHaveAttribute('data-sidebar-collapsed', 'true');
    await expect(page.getByRole('region', { name: 'Pins' })).toHaveCount(1);
  });
});
