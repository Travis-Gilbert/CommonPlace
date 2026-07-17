// SOURCING: @playwright/test. The omnibar island oracles (R1/R5): input is
// reachable in one action from any surface, a maximized editor never
// occludes the island, mode switches preserve typed text, Escape restores
// the prior focus, and the layout switcher (R3) round-trips named surfaces
// with their own arrangements. Baselines capture the island collapsed and
// expanded.

import { expect, test } from '@playwright/test';

async function settled(page: import('@playwright/test').Page) {
  await page.waitForSelector('[data-shell]');
  await page.waitForTimeout(600);
}

test.describe('omnibar island', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => window.localStorage.removeItem('commonplace.console.surface.v1'));
    await page.reload();
    await settled(page);
  });

  test('reachable in one action: field click, Ctrl+L, double Shift', async ({ page }) => {
    // Pointer path: the collapsed toolbar field.
    await page.locator('[data-omnibar-field]').click();
    await expect(page.locator('[data-omnibar-island]')).toBeVisible();
    await expect(page.locator('[data-omnibar-mode="ask"]')).toHaveAttribute('aria-pressed', 'true');
    await page.keyboard.press('Escape');
    await expect(page.locator('[data-omnibar-island]')).toHaveCount(0);

    // Cursor muscle memory: Ctrl+L opens Ask (the desktop-shell key).
    await page.keyboard.press('Control+l');
    await expect(page.locator('[data-omnibar-island]')).toBeVisible();
    await expect(page.locator('[data-omnibar-mode="ask"]')).toHaveAttribute('aria-pressed', 'true');
    await page.keyboard.press('Escape');
    await expect(page.locator('[data-omnibar-island]')).toHaveCount(0);

    // Command-palette convention: Ctrl+K opens Ask too (the browser-reliable
    // key, since Ctrl/Cmd+L is reserved by browsers for the address bar).
    await page.keyboard.press('Control+k');
    await expect(page.locator('[data-omnibar-island]')).toBeVisible();
    await expect(page.locator('[data-omnibar-mode="ask"]')).toHaveAttribute('aria-pressed', 'true');
    await page.keyboard.press('Escape');

    // JetBrains muscle memory: double Shift opens Search.
    await page.keyboard.press('Shift');
    await page.keyboard.press('Shift');
    await expect(page.locator('[data-omnibar-island]')).toBeVisible();
    await expect(page.locator('[data-omnibar-mode="search"]')).toHaveAttribute('aria-pressed', 'true');
  });

  test('a maximized editor document does not occlude the island', async ({ page }) => {
    // Collapse both tool windows: the editor owns the whole well.
    await page.keyboard.press('Alt+1');
    await page.keyboard.press('Alt+9');
    await expect(page.locator('nav button[aria-pressed="true"]')).toHaveCount(0);
    await page.keyboard.press('Control+l');
    const island = page.locator('[data-omnibar-island]');
    await expect(island).toBeVisible();
    // The island input is interactable above the maximized editor.
    await page.keyboard.type('still live over the scene');
    await expect(island.locator('input')).toHaveValue('still live over the scene');
  });

  test('mode switches preserve typed text: > and @ mid-composition', async ({ page }) => {
    await page.keyboard.press('Control+l');
    const input = page.locator('[data-omnibar-island] input');
    await input.fill('toggle');
    // Prefixing ">" flips Ask to Command, keeping the text.
    await input.fill('>toggle');
    await expect(page.locator('[data-omnibar-mode="command"]')).toHaveAttribute('aria-pressed', 'true');
    await expect(input).toHaveValue('toggle');
    await expect(page.getByText('Toggle Records tool window')).toBeVisible();

    // Escape from Command collapses; reopen and test "@" into Objects.
    await page.keyboard.press('Escape');
    await page.keyboard.press('Control+l');
    await input.fill('recall trace @');
    await expect(page.locator('[data-omnibar-mode="objects"]')).toHaveAttribute('aria-pressed', 'true');
    await expect(input).toHaveValue('recall trace @');
    // Escape from Objects returns to Ask with the text intact.
    await page.keyboard.press('Escape');
    await expect(page.locator('[data-omnibar-mode="ask"]')).toHaveAttribute('aria-pressed', 'true');
    await expect(input).toHaveValue('recall trace @');
  });

  test('objects mode resolves records and inserts a typed reference chip', async ({ page }) => {
    await page.keyboard.press('Control+l');
    const input = page.locator('[data-omnibar-island] input');
    // Typed keystroke path: the "@" flips the mode the moment it lands.
    await input.pressSequentially('@Recall trace 1', { delay: 10 });
    await expect(page.locator('[data-omnibar-mode="objects"]')).toHaveAttribute('aria-pressed', 'true');
    const option = page.locator('[data-omnibar-island] [cmdk-item]').first();
    await expect(option).toBeVisible();
    await option.click();
    // Back in Ask with a chip and the pre-@ text preserved.
    await expect(page.locator('[data-omnibar-mode="ask"]')).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('[data-object-chip]')).toHaveCount(1);
  });

  test('Escape restores focus to the previously focused element', async ({ page }) => {
    const filter = page.getByLabel('Filter records by title');
    await filter.focus();
    await page.keyboard.press('Control+l');
    await expect(page.locator('[data-omnibar-island]')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.locator('[data-omnibar-island]')).toHaveCount(0);
    await expect(filter).toBeFocused();
  });

  test('search mode keeps its scopes; unwired scopes name their gap', async ({ page }) => {
    await page.keyboard.press('Shift');
    await page.keyboard.press('Shift');
    await page.locator('[data-omnibar-island] input').fill('Recall trace');
    await expect(page.getByRole('button', { name: 'Records', exact: true })).toBeVisible();
    await expect(page.locator('[data-omnibar-island] [cmdk-item]').first()).toBeVisible();
    // The Runs scope is honest about its missing wire in this environment.
    await page.getByRole('button', { name: 'Runs', exact: true }).click();
    await expect(page.getByText('CONSOLE_HARNESS_URL')).toBeVisible();
  });

  test('command mode toggles tool windows and switches layouts', async ({ page }) => {
    await page.keyboard.press('Control+l');
    const input = page.locator('[data-omnibar-island] input');
    await input.fill('>');
    await expect(page.locator('[data-omnibar-mode="command"]')).toHaveAttribute('aria-pressed', 'true');
    await page.getByText('Toggle Records tool window').click();
    await expect(page.locator('nav button[aria-label="Records tool window"]')).toHaveAttribute(
      'aria-pressed',
      'false',
    );
    // Switching layouts is a command (R3.3): Index becomes the active surface.
    await page.keyboard.press('Control+l');
    await input.fill('>Switch layout: Index');
    await page.getByText('Switch layout: Index').click();
    await expect(page.locator('[data-shell]')).toHaveAttribute('data-active-surface', 'console-index');
  });

  test('layout switcher round-trips surfaces with their own arrangements', async ({ page }) => {
    // Close the workspace's thread window so Workspace has a distinct shape.
    await page.keyboard.press('Alt+9');
    await expect(page.locator('nav button[aria-label="Thread tool window"]')).toHaveAttribute(
      'aria-pressed',
      'false',
    );
    // Switch to Index from the toolbar widget.
    await page.locator('[data-layout-switcher]').click();
    await page.locator('[data-layout-option="console-index"]').click();
    await expect(page.locator('[data-shell]')).toHaveAttribute('data-active-surface', 'console-index');
    // The Index screen: destination rail naming its gap, live triage stream.
    await expect(page.getByText('destinations (connectors')).toBeVisible();
    expect(await page.locator('tbody tr').count()).toBeGreaterThanOrEqual(12);
    // Documents: list left, Galley reading view center.
    await page.locator('[data-layout-switcher]').click();
    await page.locator('[data-layout-option="console-docs"]').click();
    await expect(page.locator('[data-shell]')).toHaveAttribute('data-active-surface', 'console-docs');
    await expect(page.locator('[data-doc-id]').first()).toBeVisible();
    await expect(page.locator('.galley').first()).toBeVisible();
    // Back to Workspace: the closed thread window survived the round trip
    // and a reload (per-surface arrangement snapshots, R3.3).
    await page.locator('[data-layout-switcher]').click();
    await page.locator('[data-layout-option="console-workspace"]').click();
    await expect(page.locator('nav button[aria-label="Thread tool window"]')).toHaveAttribute(
      'aria-pressed',
      'false',
    );
    await page.reload();
    await settled(page);
    await expect(page.locator('[data-shell]')).toHaveAttribute('data-active-surface', 'console-workspace');
    await expect(page.locator('nav button[aria-label="Thread tool window"]')).toHaveAttribute(
      'aria-pressed',
      'false',
    );
  });

  test('island baselines: collapsed field and expanded ask island', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.reload();
    await settled(page);
    await expect(page.locator('[data-omnibar-field]')).toHaveScreenshot('omnibar-collapsed.png');
    await page.keyboard.press('Control+l');
    const island = page.locator('[data-omnibar-island]');
    await expect(island).toBeVisible();
    await page.waitForTimeout(300);
    await expect(island).toHaveScreenshot('omnibar-expanded-ask.png');
  });

  test('reduced motion renders the expansion as a fade', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.reload();
    await settled(page);
    await page.keyboard.press('Control+l');
    const island = page.locator('[data-omnibar-island]');
    await expect(island).toBeVisible();
    // No scale under reduced motion: the transform settles at identity.
    const transform = await island.evaluate((el) => getComputedStyle(el).transform);
    expect(['none', 'matrix(1, 0, 0, 1, 0, 0)']).toContain(transform);
  });
});
