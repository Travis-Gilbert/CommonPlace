// SOURCING: @playwright/test. Interaction oracle for composer `/` palette
// (SPEC-COMMONPLACE-COMMANDS-AND-SENTINELS-1.0 D2/AC1). MCP palette/invoke
// are routed; this is the UI interaction class, not production O-03.

import { expect, test, type Page } from '@playwright/test';
import { resetLocalStorageBeforeNavigation } from './storage-reset';

async function stubPaletteGraph(page: Page): Promise<void> {
  await page.route('**/api/harness/programmable-graph', async (route) => {
    const posted = route.request().postDataJSON() as {
      action?: string;
      args?: { slug?: string; params?: Record<string, unknown> };
    } | null;
    const action = posted?.action;
    if (action === 'palette') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          ok: true,
          result: {
            commands: [
              {
                slug: 'price-watch',
                title: 'Price watch',
                summary: 'Watch a product page price',
                requires_selection: false,
                params: [{ id: 'url' }],
              },
            ],
          },
        }),
      });
      return;
    }
    if (action === 'invoke_command') {
      const slug = posted?.args?.slug ?? 'price-watch';
      const url = posted?.args?.params?.url ?? '';
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          ok: true,
          result: {
            receipt_id: 'command-receipt:Travis-Gilbert:price-watch:1',
            command_slug: slug,
            command_title: 'Price watch',
            result_stream: [
              'running program Price watch',
              `param url=${url}`,
            ],
          },
        }),
      });
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ ok: true, result: {} }),
    });
  });
}

test.describe('composer slash palette', () => {
  test('typing / opens the palette, param form, and named receipt', async ({ page }) => {
    await resetLocalStorageBeforeNavigation(page, {
      keys: ['commonplace.console.layout-cache.v1', 'commonplace.console.surface.v1'],
    });
    await stubPaletteGraph(page);
    await page.goto('/chat');
    await expect(page.locator('[data-chat-page]')).toBeVisible({ timeout: 60_000 });
    await expect(page.locator('[data-chat-composer]')).toBeVisible({ timeout: 60_000 });
    await page.locator('[data-composer-input]').fill('/');
    await expect(page.locator('[data-slash-command-palette]')).toBeVisible({ timeout: 30_000 });
    await expect(page.locator('[data-palette-slug="price-watch"]')).toBeVisible();
    await page.screenshot({
      path: 'e2e/evidence/commands-slash-palette/palette.png',
      fullPage: true,
    });
    await page.locator('[data-palette-slug="price-watch"]').click();
    await expect(page.locator('[data-command-param-form]')).toBeVisible();
    await page.locator('[data-command-param="url"]').fill('https://example.test/item');
    await page.screenshot({
      path: 'e2e/evidence/commands-slash-palette/params.png',
      fullPage: true,
    });
    await page.locator('[data-command-run]').click();
    await expect(page.locator('[data-command-receipt]')).toContainText(
      'Price watch · command-receipt:Travis-Gilbert:price-watch:1',
      { timeout: 30_000 },
    );
    await expect(page.locator('[data-theorem-chat-messages]')).toContainText(
      'Price watch · command-receipt:Travis-Gilbert:price-watch:1',
    );
    await page.screenshot({
      path: 'e2e/evidence/commands-slash-palette/receipt.png',
      fullPage: true,
    });
  });
});
