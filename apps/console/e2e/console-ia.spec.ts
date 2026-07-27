// SOURCING: @playwright/test. Console IA oracles cover the role-aware stripe,
// default Chat surface, Composer geometry and motion budget, Files projection,
// deterministic Context graph, and Workspace seed.

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

async function freshLoad(page: Page) {
  await resetLocalStorageBeforeNavigation(page, {
    keys: [LAYOUT_CACHE_KEY, LEGACY_SURFACE_KEY],
  });
  await page.goto('/workspace');
  await page.waitForSelector('[data-shell]');
  await page.waitForFunction(
    () => document.documentElement.getAttribute('data-layout-ready') === '1',
    { timeout: 60_000 },
  );
}

async function openChatPage(page: Page) {
  await page.goto('/chat');
  await expect(page.locator('[data-chat-page]')).toBeVisible({ timeout: 60_000 });
  await expect(page.locator('[data-chat-composer]')).toBeVisible({ timeout: 60_000 });
}

function transportStateStream({
  assistantText,
  toolCalls = [],
}: {
  assistantText: string;
  toolCalls?: Array<{
    callId: string;
    name: string;
    rawInput: unknown;
    status: 'pending' | 'completed';
    rawOutput?: unknown;
  }>;
}) {
  const state = {
    sessionId: 'session-e2e',
    mode: 'composed',
    bindingId: 'agent:theorem',
    turnStatus: 'complete',
    messages: [
      {
        id: 'user-e2e',
        role: 'user',
        text: 'Show the plan',
        contributions: [],
        toolCalls: [],
      },
      {
        id: 'assistant-e2e',
        role: 'assistant',
        text: assistantText,
        contributions: [],
        toolCalls,
      },
    ],
    pendingPermission: null,
    blockedReason: null,
    bootBrief: null,
  };
  return [
    `data: ${JSON.stringify({
      type: 'update-state',
      path: [],
      operations: [{ type: 'set', path: [], value: state }],
    })}`,
    '',
    'data: [DONE]',
    '',
  ].join('\n');
}

async function openSurface(page: Page, id: string) {
  const pathBySurface: Record<string, string> = {
    'console-chat': '/chat',
    'console-workspace': '/workspace',
    'console-index': '/filing',
    'console-canvas': '/canvas',
    'console-automation': '/automation',
    'console-docs': '/documents',
    'console-cards': '/cards',
    'console-files': '/files',
    'console-records': '/records',
    'console-threads': '/threads',
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
  test.beforeEach(async ({ page, request }) => {
    await resetStubLayout(request);
    await freshLoad(page);
  });

  test('separates launch views from generated blocks, objects, and pins', async ({ page }) => {
    test.setTimeout(120_000);
    await expect(page.locator('[data-shell]')).toHaveAttribute('data-active-surface', 'console-workspace');
    const places = page.getByRole('radiogroup', { name: 'Views' }).getByRole('radio');
    await expect(places).toHaveCount(5);
    expect(await places.evaluateAll((nodes) => nodes.map((node) => node.getAttribute('aria-label')))).toEqual([
      'Chat view',
      'Researcher view',
      'Index view',
      'Editor view',
      'Models view',
    ]);
    await expect(page.locator('[data-surface-nav="console-workspace"]')).toHaveAttribute(
      'aria-checked',
      'true',
    );
    await expect(page.locator('[data-companion-nav]')).toHaveCount(0);
    await expect(page.locator('[data-rail-connection]')).toHaveCount(0);
    await expect(page.locator('[data-connection-owner="status-bar"]')).toHaveCount(1);

    const blocks = page.locator('[data-rail-tier="blocks"] button');
    await expect(blocks).toHaveCount(10);
    expect(await blocks.evaluateAll((nodes) => nodes.map((node) => node.textContent?.trim()))).toEqual([
      'Records',
      'Documents',
      'Files',
      'Index',
      'Automation',
      'Plan',
      'Kanban',
      'Canvas',
      'Search',
      'Your data',
    ]);

    for (const surfaceId of [
      'console-workspace',
      'console-index',
      'console-survey',
      'console-models',
    ] as const) {
      await openSurface(page, surfaceId);
    }
    await pressSurfaceShortcut(page, '2');
    await expect(page.locator('[data-shell]')).toHaveAttribute('data-active-surface', 'console-survey', {
      timeout: 15_000,
    });
    await pressSurfaceShortcut(page, '4');
    await expect(page.locator('[data-shell]')).toHaveAttribute('data-active-surface', 'console-workspace', {
      timeout: 15_000,
    });
  });

  test('keeps Chat measured with one wide, auto-growing Composer', async ({ page }) => {
    await openChatPage(page);
    const composer = page.locator('[data-chat-composer]');
    const input = composer.locator('[data-composer-input]');
    await expect(page.locator('[data-chat-sidebar]')).toBeVisible();
    await expect(page.locator('[data-chat-transcript]')).toBeVisible();
    await expect(page.locator('[data-chat-rail]')).toBeVisible();
    await expect(page.locator('[data-thread-composer-input]')).toHaveCount(0);
    await expect(composer.getByRole('button', { name: 'Attach file' })).toBeVisible();
    await expect(composer.getByLabel('Model')).toHaveValue('theorem');
    await expect(composer.getByRole('button', { name: 'Send' })).toBeVisible();
    await expect(input).toHaveCSS('font-size', '15px');
    const initial = await input.boundingBox();
    const bounds = await composer.boundingBox();
    expect(initial?.height ?? 0).toBeGreaterThanOrEqual(48);
    expect(bounds?.width ?? 0).toBeGreaterThan(400);
    expect(bounds?.height ?? 1000).toBeLessThan(320);
    await input.fill(Array.from({ length: 24 }, (_, index) => `Line ${index + 1}`).join('\n'));
    const grown = await input.boundingBox();
    expect(grown?.height ?? 0).toBeGreaterThan(initial?.height ?? 0);
    expect(grown?.height ?? 1000).toBeLessThanOrEqual(200);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(page.locator('[data-chat-composer]')).toBeVisible({ timeout: 60_000 });
    await expect(page).toHaveURL(/\/chat\/[^/]+$/);
  });

  test('renders AssistantTransport plans in-thread', async ({ page }) => {
    await openChatPage(page);
    await page.route('**/api/chat/transport', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'text/event-stream',
        body: transportStateStream({
          assistantText: 'Working from the plan.',
          toolCalls: [
            {
              callId: 'one',
              name: 'objects.query',
              rawInput: { type: 'record' },
              status: 'completed',
              rawOutput: { count: 2 },
            },
            {
              callId: 'two',
              name: 'chat.compose',
              rawInput: { format: 'answer' },
              status: 'pending',
            },
          ],
        }),
      });
    });
    const input = page.locator('[data-chat-composer] [data-composer-input]');
    await input.fill('Show the plan');
    await input.press('Enter');
    const plan = page.locator('[data-chat-transcript] [data-agent-plan]');
    await expect(plan).toBeVisible();
    await plan.getByRole('button', { name: /Expand/ }).click();
    await expect(plan).toContainText('objects.query');
    await expect(page.locator('[data-speaker="human"]').first()).toHaveCSS('font-family', /Manrope/i);
    await expect(page.locator('[data-speaker="agent"]').first()).toHaveCSS('font-family', /IBM Plex Sans/i);
  });

  test('sends Chat commands through AssistantTransport', async ({ page }) => {
    await openChatPage(page);
    const bodies: unknown[] = [];
    await page.route('**/api/chat/transport', async (route) => {
      bodies.push(route.request().postDataJSON());
      await route.fulfill({
        status: 200,
        contentType: 'text/event-stream',
        body: transportStateStream({ assistantText: 'Grounded answer.' }),
      });
    });

    const input = page.locator('[data-chat-composer] [data-composer-input]');
    await input.fill('Use Theorem context.');
    await input.press('Enter');
    await expect(page.getByText('Grounded answer.')).toBeVisible();
    expect(bodies[0]).toMatchObject({
      mode: 'composed',
      bindingId: 'agent:theorem',
      threadId: expect.any(String),
      commands: [{
        type: 'add-message',
        message: {
          role: 'user',
          parts: [{ type: 'text', text: 'Use Theorem context.' }],
        },
        parentId: null,
        sourceId: null,
      }],
    });
  });

  test('keeps the model and Send control reachable on a phone', async ({ page }) => {
    await openChatPage(page);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.reload({ waitUntil: 'domcontentloaded' });
    const composer = page.locator('[data-chat-composer]');
    await expect(composer).toBeVisible({ timeout: 60_000 });
    await expect(composer.locator('select.composer-mode-select')).toBeVisible();
    const send = composer.getByRole('button', { name: 'Send' });
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
    await openSurface(page, 'console-files');
    await expect(page.locator('[data-file-root-status="root-memory"]')).toHaveText('5000', { timeout: 15000 });
    await expect(page.locator('[data-file-root-status="root-project"]')).toHaveText('Connect');
    await expect(page.locator('[data-file-root-status="root-memory"]')).toHaveText('5000');
    await expect(page.locator('[data-file-root-status="root-uploads"]')).toHaveText('Ingest');
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
  });

  test('keeps one compact companion open per side', async ({ page }) => {
    await page.setViewportSize({ width: 1000, height: 800 });
    await expect(page.locator('[data-shell]')).toHaveAttribute('data-compact', 'true');
    await page.keyboard.press('Alt+Shift+2');
    await expect(page.locator('[data-tool-window="context"]')).toBeVisible();
    await page.keyboard.press('Alt+Shift+3');
    await expect(page.locator('[data-tool-window="context"]')).toHaveCount(0);
    await expect(page.locator('[data-tool-window="thread"]')).toBeVisible();
  });

  test('renders a deterministic, reasoned Context graph with two memory nodes', async ({ page }) => {
    await openSurface(page, 'console-files');
    await expect(page.locator('[data-file-root-status="root-memory"]')).toHaveText('5000', { timeout: 15000 });
    await openSurface(page, 'console-cards');
    await page.keyboard.press('Alt+Shift+2');
    await page.locator('[data-card-cell="person-ada"]').getByText('Ada Lovelace').click();
    await page.getByLabel('Close inspector').click();
    const context = page.locator('[data-context-view]');
    await expect(context).toHaveAttribute('data-context-key', 'person-ada');
    await expect(context.locator('circle[fill="var(--ij-gold)"]')).toHaveCount(2);
    expect(await context.locator('circle').count()).toBeLessThanOrEqual(11);
    await expect(context.getByText(/Connected by works at|Memory mentions/).first()).toBeVisible();
  });
});
