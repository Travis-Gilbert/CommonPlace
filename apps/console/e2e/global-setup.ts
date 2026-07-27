// SOURCING: @playwright/test. Prewarms routed Console modules before acceptance.

import { chromium, type FullConfig, type Page } from '@playwright/test';

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
  '/login',
  '/onboarding',
  '/settings',
  '/admin',
  '/workspace/research/chat',
] as const;

async function waitForLoadQuietPeriod(page: Page, quietPeriodMs = 750): Promise<void> {
  let lastLoadAt = Date.now();
  const recordLoad = () => {
    lastLoadAt = Date.now();
  };
  page.on('load', recordLoad);
  try {
    while (Date.now() - lastLoadAt < quietPeriodMs) {
      await page.waitForTimeout(100);
    }
  } finally {
    page.off('load', recordLoad);
  }
}

async function warmRoute(page: Page, baseURL: string, route: string): Promise<void> {
  const response = await page.goto(new URL(route, baseURL).toString(), {
    waitUntil: 'load',
    timeout: 120_000,
  });
  if (!response?.ok()) {
    throw new Error(
      `Playwright route warmup failed for ${route}: ${response?.status() ?? 'no response'}.`,
    );
  }
  await waitForLoadQuietPeriod(page);
}

async function resetStubState(page: Page): Promise<void> {
  for (const endpoint of ['reset-layout', 'reset-domain'] as const) {
    const response = await page.request.post(`${STUB_BASE}/objects/test/${endpoint}`, {
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
  try {
    const page = await browser.newPage();
    for (const route of ROUTES) {
      await warmRoute(page, baseURL, route);
    }
    await warmRoute(page, baseURL, '/workspace');
    await resetStubState(page);
  } finally {
    await browser.close();
  }
}
