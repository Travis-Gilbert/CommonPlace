// SOURCING: @playwright/test. Appearance oracles cover the descriptor-backed
// settings surface, system-mode changes, persistence, commands, contrast
// clamp disclosure, and the required 1280/1440 light baselines.

import { expect, test } from '@playwright/test';

const APPEARANCE_KEY = 'commonplace.console.appearance.v1';
const LAYOUT_CACHE_KEY = 'commonplace.console.layout-cache.v1';
const SURFACE_KEY = 'commonplace.console.surface.v1';

async function settled(page: import('@playwright/test').Page) {
  await page.waitForSelector('[data-shell]');
  await page.waitForFunction(
    () => document.documentElement.getAttribute('data-layout-ready') === '1',
    { timeout: 60_000 },
  );
}

async function resetStubLayout(request: import('@playwright/test').APIRequestContext) {
  const response = await request.post('http://localhost:50591/objects/test/reset-layout', {
    headers: { 'x-api-key': 'dev-key' },
  });
  expect(response.ok()).toBeTruthy();
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

test.describe('appearance surface', () => {
  test.beforeEach(async ({ page, request }) => {
    await resetStubLayout(request);
    await page.goto('/');
    await page.evaluate(([appearance, layout, surface]) => {
      localStorage.removeItem(appearance);
      localStorage.removeItem(layout);
      localStorage.removeItem(surface);
    }, [APPEARANCE_KEY, LAYOUT_CACHE_KEY, SURFACE_KEY]);
    await page.reload();
    await settled(page);
  });

  test('persists a preset and exposes the same action through Search', async ({ page }) => {
    await openAppearance(page);
    await selectPreset(page, 'intellij-light');
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
    await page.reload();
    await settled(page);
    await expect(page.locator('html')).toHaveAttribute('data-theme-preset', 'intellij-light');
    // /chat is the surface radio after reload (B3); reopen Appearance to continue.
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
    // HANDOFF-CONSOLE-DIMENSIONALITY named choice 5 restored the Int UI stripe
    // grammar: a selected stripe button takes a WEAK FILL (--ij-selection,
    // Blue11 in light) with the glyph at full ink, not the saturated accent
    // tile with an inverted glyph this line used to pin. The signature being
    // guarded is "the selected stripe surface is unmistakable", and the weak
    // fill is how Int UI says that; signatures.spec.ts now gates it on both
    // themes against the token rather than a hardcoded accent.
    await expect(page.locator('nav button[aria-pressed="true"], nav button[aria-checked="true"]').first()).toHaveCSS(
      'background-color',
      'rgb(212, 226, 255)',
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
    await expect(page.locator('[data-run-widget]')).toHaveCSS('height', '28px');
    await expect(page.locator('[data-run-widget] svg')).toHaveCSS('color', 'rgb(108, 112, 126)');
    await expect(page.locator('html')).toHaveCSS('font-size', '13px');
    await page.keyboard.press('Alt+Shift+1');
    // Paper companion chips sit on chrome, not the selection wash.
    const chrome = await page.evaluate(() => {
      const probe = document.createElement('div');
      probe.style.backgroundColor = 'var(--ij-chrome)';
      document.body.append(probe);
      const value = getComputedStyle(probe).backgroundColor;
      probe.remove();
      return value;
    });
    await expect(page.locator('[data-companion-nav="files"]')).toHaveCSS('background-color', chrome);
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
    await page.reload();
    await settled(page);
    // /chat is the surface radio after reload (B3); reopen Appearance to read clamps.
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
      await expect(page).toHaveScreenshot(viewport.name, { fullPage: true });
    });
  }
});
