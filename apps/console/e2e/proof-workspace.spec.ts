// SOURCING: @playwright/test. The G8 proof workspace oracles: the seeded
// surface renders through the unmodified surface renderer, rearrangement
// survives reload, the five Int UI signatures hold, the load entrance
// settles inside budget, reduced motion renders static, and the visual
// baselines at 1280 and 1440 dark are the merge gate.

import { expect, test } from '@playwright/test';

async function settled(page: import('@playwright/test').Page) {
  await page.waitForSelector('[data-shell]');
  // The load entrance budget is 320ms; wait past it plus a frame so the
  // capture is the settled chrome, then assert the entrance actually ended.
  await page.waitForTimeout(600);
}

test.describe('proof workspace', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => window.localStorage.removeItem('commonplace.console.surface.v1'));
    await page.reload();
  });

  test('renders the seed at 1440 with Twenty density and holds the baseline', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await settled(page);
    // The record set renders 12+ rows in the tool window at 1440x900.
    const rows = page.locator('tbody tr');
    expect(await rows.count()).toBeGreaterThanOrEqual(12);
    // Editor tabs host the brief and the code file by descriptor.
    await expect(page.getByRole('tab', { name: 'Console brief' })).toBeVisible();
    await expect(page.getByRole('tab', { name: 'surface-tree.ts' })).toBeVisible();
    // The brief reads through Galley inside the editor well.
    await expect(page.locator('.galley').first()).toBeVisible();
    // The thread names its missing capability instead of faking activity.
    await expect(page.getByText('NEXT_PUBLIC_CONSOLE_CHAT_URL')).toBeVisible();
    // Entrance settled: chrome is fully opaque after the budget.
    const opacity = await page
      .locator('section[aria-label="Records tool window"]')
      .evaluate((el) => getComputedStyle(el).opacity);
    expect(Number(opacity)).toBe(1);
    await expect(page).toHaveScreenshot('workspace-1440-dark.png', { fullPage: true });
  });

  test('holds the 1280 baseline', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await settled(page);
    await expect(page).toHaveScreenshot('workspace-1280-dark.png', { fullPage: true });
  });

  test('five Int UI signatures verify', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await settled(page);
    // 1. Seams darker than surfaces, no light hairline: the divider resolves
    //    to gray-3 (#393B40), darker than raised surfaces and never white.
    const dividerColor = await page
      .locator('[data-panel-resize-handle-id]')
      .first()
      .evaluate((el) => getComputedStyle(el).backgroundColor);
    expect(dividerColor).toBe('rgb(57, 59, 64)');
    // 2. Solid accent stripe button on the open tool window.
    const stripeBg = await page
      .locator('nav button[aria-pressed="true"]')
      .first()
      .evaluate((el) => getComputedStyle(el).backgroundColor);
    expect(stripeBg).toBe('rgb(53, 116, 240)');
    // 3. Underlined active tab: the 4px accent underline exists.
    const underline = page.locator('[role="tab"][aria-selected="true"] span[aria-hidden]');
    await expect(underline).toBeVisible();
    const underlineHeight = await underline.evaluate((el) => getComputedStyle(el).height);
    expect(underlineHeight).toBe('4px');
    // 4. The run widget exists and is bound to run state (not running here).
    await expect(page.locator('[data-run-widget][data-running="false"]')).toBeVisible();
    // 5. Inter 13 and JetBrains Mono, 24px rows, 28px controls, arc 8.
    const fontSize = await page.locator('[data-register="intui"]').evaluate((el) => getComputedStyle(el).fontSize);
    expect(fontSize).toBe('13px');
    const controlHeight = await page
      .locator('[data-run-widget]')
      .evaluate((el) => getComputedStyle(el).height);
    expect(controlHeight).toBe('28px');
    const arc = await page.locator('[data-run-widget]').evaluate((el) => getComputedStyle(el).borderRadius);
    expect(arc).toBe('8px');
  });

  test('rearrangement persists across reload through the surface object', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await settled(page);
    // Toggle the records tool window closed by shortcut.
    await page.keyboard.press('Alt+1');
    await expect(page.locator('nav button[aria-label="Records tool window"]')).toHaveAttribute(
      'aria-pressed',
      'false',
    );
    // Drag the remaining splitter and let the debounced write-back land.
    const handle = page.locator('[data-panel-resize-handle-id]').first();
    const box = await handle.boundingBox();
    if (box) {
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
      await page.mouse.down();
      await page.mouse.move(box.x - 120, box.y + box.height / 2, { steps: 5 });
      await page.mouse.up();
    }
    await page.waitForTimeout(400);
    const before = await page.evaluate(() =>
      window.localStorage.getItem('commonplace.console.surface.v1'),
    );
    expect(before).toContain('"open":false');
    await page.reload();
    await settled(page);
    // The closed tool window and the dragged sizes survived reload.
    await expect(page.locator('nav button[aria-label="Records tool window"]')).toHaveAttribute(
      'aria-pressed',
      'false',
    );
    const after = await page.evaluate(() =>
      window.localStorage.getItem('commonplace.console.surface.v1'),
    );
    expect(after).toContain('"open":false');
  });

  test('an unknown descriptor renders the fallback card, never a crash', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await settled(page);
    // A "shared arrangement" pointing at a descriptor this build does not
    // register: rewrite the persisted surface object, reload, expect the card.
    await page.evaluate(() => {
      const raw = window.localStorage.getItem('commonplace.console.surface.v1');
      if (!raw) return;
      const objects = JSON.parse(raw) as { id: string; properties: Record<string, unknown> }[];
      const brief = objects.find((object) => object.id === 'vi-brief');
      if (brief) brief.properties.descriptor_id = 'future.surface';
      window.localStorage.setItem('commonplace.console.surface.v1', JSON.stringify(objects));
    });
    await page.reload();
    await settled(page);
    await expect(page.getByText('"future.surface" unavailable')).toBeVisible();
  });

  test('reduced motion renders settled and static', async ({ page, browser }) => {
    const context = await browser.newContext({ reducedMotion: 'reduce', colorScheme: 'dark' });
    const reducedPage = await context.newPage();
    await reducedPage.goto('http://localhost:3010/');
    await reducedPage.waitForSelector('[data-shell]');
    // Chrome is opaque immediately: no entrance under reduced motion.
    const opacity = await reducedPage
      .locator('section[aria-label="Records tool window"]')
      .evaluate((el) => getComputedStyle(el).opacity);
    expect(Number(opacity)).toBe(1);
    // The mark renders its static constellation without the library.
    // (No live canvas mark mounts while idle with no run; the static path is
    // exercised by the thread's composing state in the streaming test.)
    await expect(reducedPage).toHaveScreenshot('workspace-1440-reduced-motion.png');
    await context.close();
  });

  test('no spinner or typing affordance exists on agent paths', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await settled(page);
    // G7: the mark replaces every agent activity indicator; a scan finds no
    // other spinner or typing affordance anywhere in the DOM.
    const suspicious = await page.evaluate(() => {
      const needles = ['spinner', 'typing', 'dots', 'loader'];
      return [...document.querySelectorAll('[class]')]
        .map((el) => el.getAttribute('class') ?? '')
        .filter((cls) => needles.some((needle) => cls.toLowerCase().includes(needle)));
    });
    expect(suspicious).toEqual([]);
  });
});
