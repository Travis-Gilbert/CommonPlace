// SOURCING: @playwright/test. Console IA oracles cover the role-aware stripe,
// default Chat surface, Composer geometry and motion budget, Files projection,
// deterministic Context graph, and Workspace seed.

import { expect, test, type APIRequestContext, type Page, type Route } from '@playwright/test';

const LAYOUT_CACHE_KEY = 'commonplace.console.layout-cache.v1';
const LEGACY_SURFACE_KEY = 'commonplace.console.surface.v1';
const STUB_BASE = 'http://localhost:50591';

async function resetStubLayout(request: APIRequestContext) {
  const response = await request.post(`${STUB_BASE}/objects/test/reset-layout`, {
    headers: { 'x-api-key': 'dev-key' },
  });
  expect(response.ok()).toBeTruthy();
}

async function freshLoad(page: Page, request?: APIRequestContext) {
  if (request) await resetStubLayout(request);
  await page.goto('/');
  await page.evaluate(([layoutKey, legacyKey]) => {
    localStorage.removeItem(layoutKey);
    localStorage.removeItem(legacyKey);
  }, [LAYOUT_CACHE_KEY, LEGACY_SURFACE_KEY] as const);
  await page.reload();
  await page.waitForSelector('[data-shell]');
  await page.waitForFunction(
    () => document.documentElement.getAttribute('data-layout-ready') === '1',
    { timeout: 60_000 },
  );
}

async function openSurface(page: Page, id: string) {
  const pathBySurface: Record<string, string> = {
    'console-chat': '/chat',
    'console-workspace': '/workspace',
    'console-index': '/filing',
    'console-docs': '/documents',
    'console-cards': '/cards',
  };
  const path = pathBySurface[id];
  if (path) {
    await page.goto(path);
  } else {
    await page.locator(`[data-surface-nav="${id}"]`).click();
  }
  await expect(page.locator('[data-shell]')).toHaveAttribute('data-active-surface', id, {
    timeout: 15_000,
  });
  await page.waitForFunction(
    () => document.documentElement.getAttribute('data-layout-ready') === '1',
    { timeout: 60_000 },
  );
}

async function pressSurfaceShortcut(page: Page, digit: string) {
  // Dispatch on window: Chromium reserves Meta+digit for tab switching, and
  // focused inputs can swallow Control+digit before Playwright's press lands.
  await page.evaluate((key) => {
    window.dispatchEvent(new KeyboardEvent('keydown', {
      key,
      code: `Digit${key}`,
      ctrlKey: true,
      bubbles: true,
      cancelable: true,
    }));
  }, digit);
}

test.describe('Console information architecture', () => {
  test.beforeEach(async ({ page, request }) => freshLoad(page, request));

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

    for (const surfaceId of [
      'console-workspace',
      'console-index',
      'console-docs',
      'console-cards',
      'console-chat',
    ] as const) {
      await openSurface(page, surfaceId);
    }
    // Keyboard reachability (Control+digit; Meta+digit is reserved by Chromium tabs).
    await pressSurfaceShortcut(page, '2');
    await expect(page.locator('[data-shell]')).toHaveAttribute('data-active-surface', 'console-workspace', {
      timeout: 15_000,
    });
    await pressSurfaceShortcut(page, '1');
    await expect(page.locator('[data-shell]')).toHaveAttribute('data-active-surface', 'console-chat', {
      timeout: 15_000,
    });
    await page.keyboard.press('Alt+Shift+1');
    await expect(page.locator('[data-companion-nav="files"]')).toHaveAttribute('aria-pressed', 'true');
    await page.locator('[data-companion-nav="context"]').click();
    await expect(page.locator('[data-companion-nav="context"]')).toHaveAttribute('aria-pressed', 'true');
    await page.locator('[data-companion-nav="thread"]').click();
    await expect(page.locator('[data-companion-nav="thread"]')).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('nav[aria-label="Surfaces and companions"]')).toHaveScreenshot('stripe-groups.png');
  });

  test('keeps Chat measured with one wide, auto-growing Composer', async ({ page }) => {
    await expect(page.locator('[data-chat-starters] button')).toHaveCount(3);
    await expect(page.locator('[data-search-field]')).toHaveCount(0);
    await expect(page.locator('[data-presence-mark-placement="composer"]')).toHaveCount(1);
    await expect(page.locator('nav')).toHaveCount(1);
    const composer = page.locator('[data-composer]');
    const input = page.locator('[data-composer-input]');
    await expect(composer).toHaveAttribute('data-source-component', '21st-dev-glowing-ai-chat-assistant');
    await expect(page.locator('[data-composer-sheen]')).toHaveAttribute('data-material-texture', 'soft-wash');
    await expect(page.locator('[data-composer-tool-group]')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Attach file' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Open action sheet' })).toBeVisible();
    await expect(page.getByLabel('Chat destination')).toBeVisible();
    await expect(page.getByLabel('Chat destination')).toHaveValue('theorem');
    await expect(page.locator('[data-web-search-state]')).toHaveAttribute('data-web-search-state', 'available');
    await expect(page.getByRole('button', { name: 'Send message' })).toBeVisible();
    // X1: the counter is not ambient furniture, the footer row is gone, and
    // the new-line hint rides the send control's title instead.
    await expect(page.locator('[data-composer-character-count]')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Send message' })).toHaveAttribute(
      'title',
      'Send message (Shift + Enter for a new line)',
    );
    await expect(page.locator('[data-composer-source-footer]')).toHaveCount(0);
    await expect(input).toHaveCSS('font-size', '16px');
    const initial = await input.boundingBox();
    const bounds = await composer.boundingBox();
    const viewport = page.viewportSize();
    expect(initial?.height ?? 0).toBeGreaterThanOrEqual(48);
    expect(bounds?.width ?? 0).toBeGreaterThan(600);
    expect(bounds?.height ?? 1000).toBeLessThan(280);
    expect((bounds?.y ?? 0) + ((bounds?.height ?? 0) / 2)).toBeGreaterThan((viewport?.height ?? 0) * (2 / 3) - 2);
    await input.fill('');
    await input.fill('Material');
    await expect(page.locator('[data-composer-character-count]')).toHaveCount(0);
    // Inside the final tenth of the budget the number is news, so it appears.
    await input.fill('x'.repeat(1800));
    await expect(page.locator('[data-composer-character-count]')).toHaveText('1800/2000');
    await input.fill('');
    await input.pressSequentially('@Ada');
    const mentionPopover = page.locator('[aria-label="Object mentions"]');
    await expect(mentionPopover).toBeVisible();
    await expect(mentionPopover.getByText('Ada Lovelace', { exact: true })).toBeVisible();
    // Popover opens upward and can sit under the toolbar hit-target; select via
    // the trigger keyboard path instead of a pointer click through chrome.
    await input.press('Enter');
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

  test('keeps Search reachable by keyboard while streaming and renders in-thread plans', async ({ page }) => {
    let pendingRoute: Route | null = null;
    await page.route('**/api/chat/stream', async (route) => {
      pendingRoute = route;
    });
    await page.locator('[data-chat-starters] button').first().click();
    await expect(page.locator('[data-chat-starters]')).toHaveCount(0);
    await expect(page.locator('[data-composer-sheen]')).toHaveAttribute('data-sheen-state', 'streaming');
    await expect(page.locator('[data-presence-mark-placement="composer"] [data-mark-state]')).toHaveAttribute('data-mark-state', 'composing');
    await expect(page.locator('[data-search-field]')).toHaveCount(0);
    await page.keyboard.press('Shift');
    await page.keyboard.press('Shift');
    await expect(page.locator('[data-search-panel]')).toBeVisible();
    await page.keyboard.press('Escape');
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
    await expect(page.locator('[data-speaker="human"]').first()).toHaveCSS('font-family', /Manrope/i);
    await expect(page.locator('[data-speaker="agent"]').first()).toHaveCSS('font-family', /IBM Plex Sans/i);
    await expect(page).toHaveScreenshot('chat-plan.png', { fullPage: true });
  });

  test('sends Theorem chat and advertised web search through the hosted stream', async ({ page }) => {
    const bodies: unknown[] = [];
    await page.route('**/api/chat/stream', async (route) => {
      bodies.push(route.request().postDataJSON());
      await route.fulfill({
        status: 200,
        contentType: 'text/event-stream',
        body: 'event: text\ndata: {"text":"Grounded answer."}\n\n',
      });
    });

    const input = page.locator('[data-composer-input]');
    await input.fill('Use Theorem context.');
    await input.press('Enter');
    await expect(page.getByText('Grounded answer.')).toBeVisible();
    expect(bodies[0]).toMatchObject({ content: [{ type: 'text', text: 'Use Theorem context.' }] });
    expect(bodies[0]).not.toHaveProperty('capability');

    await page.getByLabel('Chat destination').selectOption('web');
    // X1 deleted the footer status row, so "Web search ready" no longer exists
    // as text: the mark is the status, which is its entire job. The capability
    // it advertised still needs a reachable handle, and it now rides the
    // control that actually selects the destination.
    await expect(page.locator('[data-web-search-state]')).toHaveAttribute(
      'data-web-search-state',
      'available',
    );
    await expect(page.getByLabel('Chat destination')).toHaveValue('web');
    await input.fill('Find the current release notes.');
    await input.press('Enter');
    await expect.poll(() => bodies.length).toBe(2);
    expect(bodies[1]).toMatchObject({
      content: [{ type: 'text', text: 'Find the current release notes.' }],
      capability: { kind: 'web' },
    });
  });

  test('keeps the destination and Send control reachable on a phone', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.reload();
    await page.waitForSelector('[data-composer-sheen]');
    await expect(page.getByLabel('Chat destination')).toBeVisible();
    const send = page.getByRole('button', { name: 'Send message' });
    await expect(send).toBeInViewport();
    const bounds = await send.boundingBox();
    expect((bounds?.x ?? 390) + (bounds?.width ?? 0)).toBeLessThanOrEqual(390);
  });

  test('seeds Workspace with the substrate, reference tabs, and compact Thread', async ({ page }) => {
    await openSurface(page, 'console-workspace');
    await expect(page.locator('[data-workspace-substrate]')).toBeVisible();
    await expect(page.getByRole('tab', { name: 'Console brief' })).toBeVisible();
    await expect(page.getByRole('tab', { name: 'surface-tree.ts' })).toBeVisible();
    await expect(page.locator('[data-composer-density="compact"]')).toBeVisible();
    await expect(page.locator('tbody')).toHaveCount(0);
  });

  test('virtualizes 5000 pinned memory projections and opens a read-only Galley tab', async ({ page }) => {
    await page.locator('[data-companion-nav="files"]').click();
    await expect(page.locator('[data-file-root-status="root-memory"]')).toHaveText('5000', { timeout: 15000 });
    await expect(page.locator('[data-file-root-status="root-project"]')).toHaveText('Not connected');
    await expect(page.locator('[data-file-root-status="root-memory"]')).toHaveText('5000');
    await expect(page.locator('[data-file-root-status="root-uploads"]')).toHaveText('Empty');
    await expect(page.getByRole('treeitem', { name: /no project context/i })).toHaveCount(0);
    await page.getByRole('treeitem', { name: /^Harness Memory/ }).click();
    await expect(page.getByRole('treeitem', { name: 'topic-0' })).toBeVisible();
    expect(await page.getByRole('treeitem').count()).toBeLessThan(100);
    await page.getByRole('treeitem', { name: /^Harness Memory/ }).focus();
    await page.keyboard.press('ArrowDown');
    await expect(page.getByRole('treeitem', { name: 'topic-0' })).toBeFocused();
    await page.keyboard.press('Home');
    await expect(page.getByRole('treeitem', { name: /^Project/ })).toBeFocused();
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
    // Deep-linking to Cards remounts the client; hydrate memories on this
    // surface so the ego graph can match Ada before Context opens.
    await openSurface(page, 'console-cards');
    await page.locator('[data-companion-nav="files"]').click();
    await expect(page.locator('[data-file-root-status="root-memory"]')).toHaveText('5000', { timeout: 15000 });
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
