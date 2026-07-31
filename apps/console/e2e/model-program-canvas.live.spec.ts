// SOURCING: @playwright/test. Env-gated deployed acceptance for the canonical
// CommonPlace Model Canvas and Program Canvas surfaces.

import { expect, test } from '@playwright/test';

const RUN_LIVE = process.env.THEOREM_RUN_CANVAS_LIVE === '1';

test.describe('deployed Model and Program Canvas acceptance', () => {
  test.skip(
    !RUN_LIVE,
    'Set THEOREM_RUN_CANVAS_LIVE=1 and THEOREM_CANVAS_LIVE_STORAGE_STATE to run.',
  );

  test('Model Canvas mounts without third-party network calls', async ({ page }) => {
    await page.goto('/workspace');
    await expect(page.locator('[data-shell]')).toBeVisible();

    const consoleOrigin = new URL(page.url()).origin;
    const thirdPartyRequests: string[] = [];
    let observingModelCanvas = false;
    page.on('request', (request) => {
      if (!observingModelCanvas) return;
      const url = new URL(request.url());
      if (
        (url.protocol === 'http:' || url.protocol === 'https:')
        && url.origin !== consoleOrigin
      ) {
        thirdPartyRequests.push(url.href);
      }
    });

    observingModelCanvas = true;
    await page.locator('[data-surface-nav="console-models"]').click();
    await expect(page.locator('[data-model-studio]')).toBeVisible();
    await page.waitForLoadState('networkidle');
    expect(thirdPartyRequests).toEqual([]);
  });

  test('Program Canvas mounts from the canonical Blocks palette', async ({ page }) => {
    await page.goto('/workspace');
    await expect(page.locator('[data-shell]')).toBeVisible();
    await page.locator('[data-block-palette="program"]').click();
    await expect(page.locator('[data-program-canvas]')).toBeVisible();
    await expect(page.locator('[data-binding-station-tray]')).toBeVisible();
    await expect(
      page.locator('[data-binding-station-tray] [data-sealed="true"]').first(),
    ).toBeVisible();
  });

  test('Program Canvas persists a sealed binding station through the real drop route', async ({
    page,
  }) => {
    await page.goto('/workspace');
    await expect(page.locator('[data-shell]')).toBeVisible();
    await page.locator('[data-block-palette="program"]').click();
    await expect(page.locator('[data-program-canvas]')).toBeVisible();

    await page.getByRole('button', { name: 'Add node' }).click();
    const insertDialog = page.getByRole('dialog', { name: 'Insert program node' });
    await expect(insertDialog).toBeVisible();
    await insertDialog.locator('[cmdk-item]').first().click();
    const programNode = page.locator('.react-flow__node').first();
    await expect(programNode).toBeVisible();
    await programNode.click();

    const dropResponse = page.waitForResponse((response) => {
      if (!response.url().endsWith('/api/harness/programmable-graph')) return false;
      const body = response.request().postDataJSON() as {
        action?: string;
        tool?: string;
      } | null;
      return body?.tool === 'programmable_graph_apply'
        && body.action === 'drop_binding_preset';
    });
    await page
      .locator('[data-binding-station-tray] [data-sealed="true"]')
      .first()
      .click();
    await expect((await dropResponse).ok()).toBe(true);
    await expect(programNode.getByText(/station$/)).toBeVisible();
  });
});
