// SOURCING: @playwright/test. Interaction oracle for gallery Fork → Program canvas
// with lineage visible (SPEC-COMMONPLACE-COMMANDS-AND-SENTINELS-1.0 AC5).
// MCP gallery/fork/save are routed; this is the UI interaction class, not
// production O-03 live gallery evidence.

import { expect, test, type Page } from '@playwright/test';
import { resetLocalStorageBeforeNavigation } from './storage-reset';

const FORK_PROGRAM = {
  tenant_id: 'Travis-Gilbert',
  name: 'Fork of Price watch',
  intent: 'Watch price',
  authority: 'advisory',
  parent_program_id: 'cid:price',
  environment: { bindings: [] },
  trigger: { kind: 'graph_change', labels: [], properties: [] },
  budget: { max_invocations: 10, window_seconds: 3600, max_cost_microunits: 1 },
  approval: { mode: 'preapproved_within_grants', grant_ids: [] },
  nodes: [],
  edges: [],
  metadata: { forked_from: 'cid:price', draft: true },
};

async function stubProgrammableGraph(page: Page): Promise<void> {
  await page.route('**/api/harness/programmable-graph', async (route) => {
    const posted = route.request().postDataJSON() as {
      action?: string;
    } | null;
    const action = posted?.action;
    if (action === 'gallery') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          ok: true,
          result: {
            entries: [
              {
                kind: 'monitor_template',
                slug_or_name: 'Price watch',
                title: 'Price watch',
                summary: 'Watch a product page price',
                program_id: 'cid:price',
                validation: {
                  program_id: 'cid:price',
                  checks: [{ requirement: 'program_identity', passed: true }],
                },
              },
            ],
          },
        }),
      });
      return;
    }
    if (action === 'gallery_fork') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ok: true, result: { program: FORK_PROGRAM } }),
      });
      return;
    }
    if (action === 'save') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ok: true, result: { node_id: 'node:fork' } }),
      });
      return;
    }
    if (action === 'context') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ok: true, result: { tenant_id: 'Travis-Gilbert' } }),
      });
      return;
    }
    if (action === 'catalog' || action === 'list' || action === 'starters' || action === 'binding_presets') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          ok: true,
          result: {
            catalog: [],
            entries: [],
            programs: [{ id: 'node:fork', name: 'Fork of Price watch' }],
            presets: [],
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

test.describe('commands gallery fork opens Program canvas', () => {
  test('Fork on a substrate template lands on the canvas with lineage', async ({ page }) => {
    await resetLocalStorageBeforeNavigation(page, {
      keys: ['commonplace.console.layout-cache.v1', 'commonplace.console.surface.v1'],
    });
    await stubProgrammableGraph(page);
    await page.goto('/commands');
    await expect(page.locator('[data-shell]')).toBeVisible({ timeout: 60_000 });
    await page.waitForFunction(
      () => document.documentElement.getAttribute('data-layout-ready') === '1',
      { timeout: 60_000 },
    );
    await expect(page.locator('[data-commands-gallery]')).toBeVisible({ timeout: 60_000 });
    await expect(page.getByText('Price watch')).toBeVisible();
    await page.screenshot({
      path: 'e2e/evidence/commands-gallery-fork/gallery.png',
      fullPage: true,
    });
    await page.locator('[data-gallery-forkable="true"]').first().click();
    await expect(page).toHaveURL(/\/program/, { timeout: 120_000 });
    await expect(page.locator('[data-program-canvas]')).toBeVisible({ timeout: 120_000 });
    await expect(page.locator('[data-program-lineage]')).toContainText('cid:price', { timeout: 30_000 });
    await page.screenshot({
      path: 'e2e/evidence/commands-gallery-fork/canvas.png',
      fullPage: true,
    });
  });
});
