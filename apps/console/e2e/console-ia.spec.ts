// SOURCING: @playwright/test. Console IA oracles cover the role-aware stripe,
// default Chat surface, Composer geometry and motion budget, Files projection,
// deterministic Context graph, and Workspace seed.

import { expect, test, type Page, type Route } from '@playwright/test';

const SURFACE_KEY = 'commonplace.console.surface.v1';

async function freshLoad(page: Page) {
  await page.goto('/');
  await page.evaluate((key) => localStorage.removeItem(key), SURFACE_KEY);
  await page.reload();
  await page.waitForSelector('[data-shell]');
  await page.waitForTimeout(600);
}

async function openSurface(page: Page, id: string) {
  await page.locator(`[data-surface-nav="${id}"]`).click();
  await expect(page.locator('[data-shell]')).toHaveAttribute('data-active-surface', id);
}

test.describe('Console information architecture', () => {
  test.beforeEach(async ({ page }) => freshLoad(page));

  test('separates five surface radios from three companion toggles', async ({ page }) => {
    await expect(page.locator('[data-shell]')).toHaveAttribute('data-active-surface', 'console-chat');
    const surfaces = page.getByRole('radiogroup', { name: 'Surfaces' }).getByRole('radio');
    await expect(surfaces).toHaveCount(5);
    expect(await surfaces.evaluateAll((nodes) => nodes.map((node) => node.getAttribute('aria-label')))).toEqual([
      'Chat surface', 'Workspace surface', 'Index surface', 'Documents surface', 'Cards surface',
    ]);
    await expect(surfaces.first()).toHaveAttribute('aria-checked', 'true');
    const companions = page.locator('[data-companion-nav]');
    await expect(companions).toHaveCount(3);
    await expect(companions.nth(0)).toHaveAttribute('data-companion-nav', 'files');
    await expect(companions.nth(1)).toHaveAttribute('data-companion-nav', 'context');
    await expect(companions.nth(2)).toHaveAttribute('data-companion-nav', 'thread');

    await page.keyboard.press('Alt+Shift+1');
    await expect(page.locator('[data-companion-nav="files"]')).toHaveAttribute('aria-pressed', 'true');
    for (const [shortcut, surfaceId] of [
      ['2', 'console-workspace'],
      ['3', 'console-index'],
      ['4', 'console-docs'],
      ['5', 'console-cards'],
      ['1', 'console-chat'],
    ] as const) {
      await page.keyboard.press(`Alt+${shortcut}`);
      await expect(page.locator('[data-shell]')).toHaveAttribute('data-active-surface', surfaceId);
    }
    await expect(page.locator('[data-companion-nav="files"]')).toHaveAttribute('aria-pressed', 'true');
    await page.keyboard.press('Alt+Shift+2');
    await expect(page.locator('[data-companion-nav="context"]')).toHaveAttribute('aria-pressed', 'true');
    await page.keyboard.press('Alt+Shift+3');
    await expect(page.locator('[data-companion-nav="thread"]')).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('nav[aria-label="Surfaces and companions"]')).toHaveScreenshot('stripe-groups.png');
  });

  test('keeps Chat measured with one wide, auto-growing Composer', async ({ page }) => {
    await expect(page.locator('[data-chat-starters] button')).toHaveCount(3);
    await expect(page.locator('[data-search-field]')).toBeVisible();
    await expect(page.locator('[data-presence-mark-placement="composer"]')).toHaveCount(1);
    await expect(page.locator('nav')).toHaveCount(1);
    const composer = page.locator('[data-composer]');
    const input = page.locator('[data-composer-input]');
    const initial = await input.boundingBox();
    const bounds = await composer.boundingBox();
    expect(initial?.height ?? 0).toBeGreaterThanOrEqual(48);
    expect(bounds?.width ?? 0).toBeGreaterThan(600);
    expect(bounds?.height ?? 1000).toBeLessThan(220);
    expect(bounds?.y ?? 0).toBeGreaterThan(450);
    await input.fill('');
    await input.pressSequentially('@Ada');
    const mention = page.getByText('Ada Lovelace', { exact: true });
    await expect(mention).toBeVisible();
    await mention.click();
    await expect(input).toHaveValue(/Ada Lovelace/);
    await input.fill(Array.from({ length: 24 }, (_, index) => `Line ${index + 1}`).join('\n'));
    const grown = await input.boundingBox();
    expect(grown?.height ?? 0).toBeGreaterThan(initial?.height ?? 0);
    expect(grown?.height ?? 1000).toBeLessThanOrEqual(164);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.reload();
    await page.waitForSelector('[data-composer-sheen]');
    await page.waitForTimeout(300);
    const firstFrames = await page.locator('[data-composer-sheen]').getAttribute('data-sheen-frames');
    await page.waitForTimeout(300);
    await expect(page.locator('[data-composer-sheen]')).toHaveAttribute('data-sheen-frames', firstFrames ?? '1');
    const idleCostAttribute = await page.locator('[data-composer-sheen]').getAttribute('data-idle-paint-cost');
    expect(idleCostAttribute).not.toBeNull();
    const idleCost = Number(idleCostAttribute);
    expect(Number.isFinite(idleCost)).toBe(true);
    expect(idleCost).toBeLessThan(16);
    await expect(page).toHaveScreenshot('chat-empty.png', { fullPage: true });
  });

  test('keeps Search visible while streaming and renders in-thread plans', async ({ page }) => {
    let pendingRoute: Route | null = null;
    await page.route('**/api/chat/stream', async (route) => {
      pendingRoute = route;
    });
    await page.locator('[data-chat-starters] button').first().click();
    await expect(page.locator('[data-chat-starters]')).toHaveCount(0);
    await expect(page.locator('[data-composer-sheen]')).toHaveAttribute('data-sheen-state', 'streaming');
    await expect(page.locator('[data-search-field]')).toBeVisible();
    await expect(page).toHaveScreenshot('chat-streaming.png', { fullPage: true });
    if (pendingRoute) await pendingRoute.abort('failed');
    await page.unroute('**/api/chat/stream');

    await page.route('**/api/chat/stream', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'text/event-stream',
        body: [
          'event: plan',
          'data: {"steps":[{"id":"one","label":"Inspect records","tool":"objects.query","status":"complete"},{"id":"two","label":"Draft answer","tool":"chat.compose","status":"running"}]}',
          '',
          'event: text',
          'data: {"text":"Working from the plan."}',
          '',
        ].join('\n'),
      });
    });
    await page.locator('[data-composer-input]').fill('Show the plan');
    await page.locator('[data-composer-input]').press('Enter');
    await expect(page.locator('[data-agent-plan]')).toBeVisible();
    await expect(page.locator('[data-agent-plan]')).toContainText('objects.query');
    await expect(page.locator('[data-speaker="human"]').first()).toHaveCSS('font-family', /Vollkorn/i);
    await expect(page.locator('[data-speaker="agent"]').first()).toHaveCSS('font-family', /IBM Plex Sans/i);
    await expect(page).toHaveScreenshot('chat-plan.png', { fullPage: true });
  });

  test('seeds Workspace with document, code, and compact Thread but no table rail', async ({ page }) => {
    await openSurface(page, 'console-workspace');
    await expect(page.getByRole('tab', { name: 'Console brief' })).toBeVisible();
    await expect(page.getByRole('tab', { name: 'surface-tree.ts' })).toBeVisible();
    await expect(page.locator('[data-composer-density="compact"]')).toBeVisible();
    await expect(page.locator('tbody')).toHaveCount(0);
  });

  test('virtualizes 5000 pinned memory projections and opens a read-only Galley tab', async ({ page }) => {
    await page.locator('[data-companion-nav="files"]').click();
    await expect(page.locator('[data-files-view]')).toContainText('5000 memory items', { timeout: 15000 });
    await expect(page.getByRole('treeitem', { name: /no project context/i })).toBeVisible();
    await expect(page.getByRole('treeitem', { name: 'topic-0' })).toBeVisible();
    expect(await page.getByRole('treeitem').count()).toBeLessThan(100);
    await page.getByRole('treeitem', { name: 'Project', exact: true }).focus();
    await page.keyboard.press('ArrowDown');
    await expect(page.getByRole('treeitem', { name: 'Harness Memory' })).toBeFocused();
    await page.keyboard.press('Home');
    await expect(page.getByRole('treeitem', { name: 'Project', exact: true })).toBeFocused();
    await page.getByRole('treeitem', { name: 'topic-0' }).click();
    await page.getByRole('treeitem', { name: 'Ada Lovelace memory 1' }).click();
    await expect(page.getByRole('tab', { name: 'Ada Lovelace memory 1' })).toBeVisible();
    await expect(page.getByRole('note')).toContainText('MemoryPatch is not available');
    await expect(page).toHaveScreenshot('files-projection.png', { fullPage: true });
  });

  test('keeps one compact companion open per side', async ({ page }) => {
    await page.setViewportSize({ width: 1000, height: 800 });
    await expect(page.locator('[data-shell]')).toHaveAttribute('data-compact', 'true');
    await page.locator('[data-companion-nav="context"]').click();
    await expect(page.locator('[data-companion-nav="context"]')).toHaveAttribute('aria-pressed', 'true');
    await page.locator('[data-companion-nav="thread"]').click();
    await expect(page.locator('[data-companion-nav="context"]')).toHaveAttribute('aria-pressed', 'false');
    await expect(page.locator('[data-companion-nav="thread"]')).toHaveAttribute('aria-pressed', 'true');
  });

  test('renders a deterministic, reasoned Context graph with two memory nodes', async ({ page }) => {
    await page.locator('[data-companion-nav="files"]').click();
    await expect(page.locator('[data-files-view]')).toContainText('5000 memory items', { timeout: 15000 });
    await openSurface(page, 'console-cards');
    await page.locator('[data-companion-nav="context"]').click();
    await page.locator('[data-card-cell="person-ada"]').getByText('Ada Lovelace').click();
    await page.getByLabel('Close inspector').click();
    const context = page.locator('[data-context-view]');
    await expect(context).toHaveAttribute('data-context-key', 'person-ada');
    await expect(context.locator('circle[fill="var(--ij-gold)"]')).toHaveCount(2);
    expect(await context.locator('circle').count()).toBeLessThanOrEqual(11);
    await expect(context.getByText(/Connected by works at|Memory mentions/).first()).toBeVisible();
    await expect(context).toHaveScreenshot('context-graph.png');
  });
});
