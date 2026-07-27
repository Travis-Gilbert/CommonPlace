// SOURCING: @playwright/test. Appearance oracles cover the descriptor-backed
// settings surface, system-mode changes, persistence, commands, contrast
// clamp disclosure, and the required 1280/1440 light baselines.

import { expect, test } from '@playwright/test';
import { resolveToken } from './paint-audit';
import { resetLocalStorageBeforeNavigation } from './storage-reset';

const APPEARANCE_KEY = 'commonplace.console.appearance.v1';
const LAYOUT_CACHE_KEY = 'commonplace.console.layout-cache.v1';
const SURFACE_KEY = 'commonplace.console.surface.v1';
const STUB_BASE = `http://localhost:${process.env.STUB_DATA_API_PORT ?? '50591'}`;

async function settled(page: import('@playwright/test').Page) {
  await page.waitForSelector('[data-shell]');
  await page.waitForFunction(
    () => document.documentElement.getAttribute('data-layout-ready') === '1',
    { timeout: 60_000 },
  );
}

async function resetStub(request: import('@playwright/test').APIRequestContext) {
  for (const endpoint of ['reset-layout', 'reset-domain']) {
    const response = await request.post(`${STUB_BASE}/objects/test/${endpoint}`, {
      headers: { 'x-api-key': 'dev-key' },
    });
    expect(response.ok()).toBeTruthy();
  }
}

async function waitForThreadChrome(page: import('@playwright/test').Page) {
  await expect.poll(async () => {
    const empty = await page.locator('[data-chat-empty-state]').boundingBox();
    const composer = await page.locator('[data-composer-zone]').boundingBox();
    if (!empty || !composer) return false;
    const gap = Math.round(composer.y - (empty.y + empty.height));
    return gap >= 0 && gap < 80;
  }, { timeout: 30_000 }).toBe(true);
}

async function openAppearance(page: import('@playwright/test').Page) {
  await page.locator('[data-layout-switcher]').click();
  const option = page.locator('[data-layout-option="console-appearance"]');
  await expect(option).toBeVisible({ timeout: 15_000 });
  await option.click();
  await expect(page.locator('[data-shell]')).toHaveAttribute('data-active-surface', 'console-appearance', {
    timeout: 15000,
  });
  await expect(page.locator('[data-appearance-view]')).toBeVisible({ timeout: 15000 });
}

async function selectPreset(page: import('@playwright/test').Page, id: string) {
  await page.locator(`[data-appearance-preset="${id}"]`).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme-preset', id);
}

async function removeFrameworkDevChrome(page: import('@playwright/test').Page) {
  await page.locator('nextjs-portal').evaluateAll((portals) => {
    for (const portal of portals) portal.remove();
  });
}

test.describe('appearance surface', () => {
  test.beforeEach(async ({ page, request }) => {
    await resetStub(request);
    await resetLocalStorageBeforeNavigation(page, {
      keys: [APPEARANCE_KEY, LAYOUT_CACHE_KEY, SURFACE_KEY],
    });
    await page.goto('/workspace');
    await settled(page);
  });

  test('opens from its dedicated page route', async ({ page }) => {
    await page.goto('/appearance');
    await settled(page);
    await expect(page.locator('[data-shell]')).toHaveAttribute(
      'data-active-surface',
      'console-appearance',
    );
    await expect(page.locator('[data-appearance-view]')).toBeVisible();
  });

  test('persists a preset and exposes the same action through Search', async ({ page }) => {
    await openAppearance(page);
    await selectPreset(page, 'intellij-light');
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
    await page.reload({ waitUntil: 'domcontentloaded' });
    await settled(page);
    await expect(page.locator('html')).toHaveAttribute('data-theme-preset', 'intellij-light');
    // The route reasserts Workspace after reload; reopen Appearance to continue.
    await openAppearance(page);

    await page.keyboard.press('Control+k');
    const input = page.locator('[data-search-panel] input');
    await input.fill('Set theme: GitHub Dark');
    await page.getByText('Set theme: GitHub Dark', { exact: true }).click();
    await expect(page.locator('html')).toHaveAttribute('data-theme-preset', 'github-dark');
  });

  test('Auto follows live operating-system color changes', async ({ page }) => {
    await openAppearance(page);
    await page.getByRole('button', { name: 'Auto', exact: true }).click();
    await page.emulateMedia({ colorScheme: 'light' });
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
    await page.emulateMedia({ colorScheme: 'dark' });
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  });

  test('light mode preserves the five IntelliJ chrome signatures', async ({ page }) => {
    await openAppearance(page);
    await selectPreset(page, 'intellij-light');
    await page.locator('[data-layout-switcher]').click();
    await page.locator('[data-layout-option="console-workspace"]').click();

    // One-block ground paints the companion seam as a transparent island gutter
    // (HANDOFF-CONSOLE-BLOCK-SYSTEM choice 8). Only assert the legacy divider
    // fill when a painted handle is still present.
    const divider = page.locator('[data-panel-resize-handle-id]').first();
    if (await divider.count()) {
      const background = await divider.evaluate((node) => getComputedStyle(node).backgroundColor);
      if (background !== 'rgba(0, 0, 0, 0)' && background !== 'transparent') {
        await expect(divider).toHaveCSS('background-color', 'rgb(235, 236, 240)');
      }
    }
    // The consolidated shell marks the selected rail row as a sunken editor
    // well with a seam inset and full-strength ink. Assert the register token,
    // not a preset-specific literal.
    const sunken = await resolveToken(page, '--ij-editor');
    await expect(page.locator('nav button[aria-pressed="true"], nav button[aria-checked="true"]').first()).toHaveCSS(
      'background-color',
      sunken,
    );
    const underline = page.locator('[role="tab"][aria-selected="true"] .h-ij-underline');
    await expect(underline).toHaveCSS('height', '4px');
    await expect(underline).toHaveCSS('background-color', 'rgb(53, 116, 240)');
    const running = await page.evaluate(() => {
      const probe = document.createElement('div');
      probe.style.backgroundColor = 'var(--ij-running)';
      document.body.append(probe);
      const value = getComputedStyle(probe).backgroundColor;
      probe.remove();
      return value;
    });
    expect(running).toBe('rgb(31, 117, 54)');
    await expect(page.locator('[data-run-widget]')).toHaveCount(0);
    await expect(page.locator('[data-account-trigger]')).toHaveCSS('height', '28px');
    await expect(page.locator('html')).toHaveCSS('font-size', '13px');
    await page.keyboard.press('Alt+Shift+1');
    await expect(page.locator('[data-tool-window="files"]')).toBeVisible();
  });

  test('derived controls paint live and disclose a contrast clamp quietly', async ({ page }) => {
    await openAppearance(page);
    await selectPreset(page, 'navy');
    await page.getByRole('slider', { name: 'Tint hue' }).fill('275');
    await expect(page.locator('html')).toHaveAttribute('data-theme-derived', 'true');
    const stored = await page.evaluate((key) => localStorage.getItem(key), APPEARANCE_KEY);
    expect(stored).toContain('"tintHue":275');
    await expect(page.locator('[data-icon-domain="memory"]').first()).toHaveCSS('color', 'rgb(95, 173, 101)');

    await page.evaluate((key) => {
      const raw = localStorage.getItem(key);
      if (!raw) return;
      const value = JSON.parse(raw) as { preference: { knobs: { tintChroma: number } } };
      value.preference.knobs.tintChroma = 1;
      localStorage.setItem(key, JSON.stringify(value));
    }, APPEARANCE_KEY);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await settled(page);
    // The route reasserts Workspace after reload; reopen Appearance to read clamps.
    await openAppearance(page);
    await expect(page.getByText('Background chroma was limited')).toBeVisible();
    await expect(page.getByRole('slider', { name: 'Tint chroma' })).toHaveValue('0.04');
  });

  for (const viewport of [
    { width: 1280, height: 800, name: 'workspace-1280-light.png' },
    { width: 1440, height: 900, name: 'workspace-1440-light.png' },
  ]) {
    test(`holds the ${viewport.width} light baseline`, async ({ page }) => {
      await page.emulateMedia({ reducedMotion: 'reduce', colorScheme: 'light' });
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await openAppearance(page);
      await selectPreset(page, 'intellij-light');
      await page.locator('[data-layout-switcher]').click();
      await page.locator('[data-layout-option="console-workspace"]').click();
      await settled(page);
      await waitForThreadChrome(page);
      await removeFrameworkDevChrome(page);
      await expect(page).toHaveScreenshot(viewport.name, { fullPage: true });
    });
  }
});
