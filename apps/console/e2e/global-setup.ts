// SOURCING: @playwright/test. Prewarms routed Console modules before acceptance.

import {
  chromium,
  type APIRequestContext,
  type FullConfig,
  type Page,
  type Request,
} from '@playwright/test';

const STUB_BASE = `http://localhost:${process.env.STUB_DATA_API_PORT ?? '50591'}`;

const ROUTES = [
  '/',
  '/workspace',
  '/chat',
  '/indexer',
  '/filing',
  '/canvas',
  '/automation',
  '/documents',
  '/cards',
  '/files',
  '/records',
  '/threads',
  '/models',
  '/appearance',
  '/login',
  '/onboarding',
  '/settings',
  '/admin',
  '/workspace/research/chat',
] as const;

const CONSOLE_SHELL_ROUTES = new Set<string>([
  '/workspace',
  '/indexer',
  '/filing',
  '/canvas',
  '/automation',
  '/documents',
  '/cards',
  '/files',
  '/records',
  '/threads',
  '/models',
  '/appearance',
]);

const MUTATION_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

async function waitForMutationQuietPeriod(
  page: Page,
  pending: ReadonlySet<Request>,
  lastMutationAt: () => number,
  quietPeriodMs = 750,
): Promise<void> {
  const deadline = Date.now() + 120_000;
  while (pending.size > 0 || Date.now() - lastMutationAt() < quietPeriodMs) {
    if (Date.now() >= deadline) {
      const pendingRequests = [...pending]
        .map((request) => `${request.method()} ${request.url()}`)
        .join(', ');
      throw new Error(
        `Playwright route warmup timed out waiting for mutations: ${pendingRequests || 'none'}.`,
      );
    }
    await page.waitForTimeout(100);
  }
}

async function warmRoute(page: Page, baseURL: string, route: string): Promise<void> {
  const pendingMutations = new Set<Request>();
  let lastMutationAt = Date.now();
  const trackMutation = (request: Request) => {
    if (!MUTATION_METHODS.has(request.method())) return;
    pendingMutations.add(request);
    lastMutationAt = Date.now();
  };
  const settleMutation = (request: Request) => {
    if (!pendingMutations.delete(request)) return;
    lastMutationAt = Date.now();
  };

  page.on('request', trackMutation);
  page.on('requestfinished', settleMutation);
  page.on('requestfailed', settleMutation);
  try {
    const response = await page.goto(new URL(route, baseURL).toString(), {
      waitUntil: 'load',
      timeout: 120_000,
    });
    if (!response?.ok()) {
      throw new Error(
        `Playwright route warmup failed for ${route}: ${response?.status() ?? 'no response'}.`,
      );
    }
    if (CONSOLE_SHELL_ROUTES.has(route)) {
      await page.locator('html[data-layout-ready="1"]').waitFor({
        state: 'attached',
        timeout: 120_000,
      });
    }
    await waitForMutationQuietPeriod(
      page,
      pendingMutations,
      () => lastMutationAt,
    );
  } finally {
    page.off('request', trackMutation);
    page.off('requestfinished', settleMutation);
    page.off('requestfailed', settleMutation);
  }
}

async function resetStubState(request: APIRequestContext): Promise<void> {
  for (const endpoint of ['reset-layout', 'reset-domain'] as const) {
    const response = await request.post(`${STUB_BASE}/objects/test/${endpoint}`, {
      headers: { 'x-api-key': 'dev-key' },
    });
    if (!response.ok()) {
      throw new Error(`Playwright route warmup could not ${endpoint}: ${response.status()}.`);
    }
  }
}

export default async function globalSetup(config: FullConfig): Promise<void> {
  const baseURL = config.projects[0]?.use.baseURL;
  if (typeof baseURL !== 'string') {
    throw new Error('Playwright route warmup requires a string baseURL.');
  }

  const browser = await chromium.launch();
  const context = await browser.newContext();
  try {
    const page = await context.newPage();
    for (const route of ROUTES) {
      await warmRoute(page, baseURL, route);
    }
    await warmRoute(page, baseURL, '/workspace');
    await page.close();
    await resetStubState(context.request);
  } finally {
    await context.close();
    await browser.close();
  }
}
