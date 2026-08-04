// SOURCING: @playwright/test. Live oracle for SPEC-THEOREM-PROTOTYPE-PIPELINE-1.0
// PT-006/PT-007: mount prototype.stage against a real falling-boxes .rrd served
// locally (gateway-shaped GET), wait for WebViewer Ready, capture evidence.

import { expect, test, type APIRequestContext, type Page } from '@playwright/test';
import { resetLocalStorageBeforeNavigation } from './storage-reset';

const STUB_BASE = `http://localhost:${process.env.STUB_DATA_API_PORT ?? '50591'}`;
const PROTO_LIVE_BASE = process.env.PROTO_LIVE_BASE ?? 'http://127.0.0.1:50080';
const RECORDING_ID =
  process.env.PROTO_LIVE_RID ??
  'proto-rec:sha256:21b486b033b0be8c4cf85f82a2085c7fd73435ea6ae09431cc0e1eca1fa5a07f';
const PATH_TO_EXPR = {
  '/proto/simulate/ground': 'expr:ground',
  '/proto/simulate/box_a': 'expr:box_a',
  '/proto/simulate/box_b': 'expr:box_b',
  '/proto/simulate/box_c': 'expr:box_c',
} as const;

async function settled(page: Page) {
  await page.waitForSelector('[data-shell]');
  await page.waitForFunction(
    () => document.documentElement.getAttribute('data-layout-ready') === '1',
    { timeout: 60_000 },
  );
}

async function freshLoad(page: Page) {
  await resetLocalStorageBeforeNavigation(page, {
    keys: [
      'commonplace.console.layout-cache.v1',
      'commonplace.console.surface.v1',
    ],
  });
  await page.goto('/workspace');
  await settled(page);
}

async function resetStub(request: APIRequestContext) {
  const layout = await request.post(`${STUB_BASE}/objects/test/reset-layout`, {
    headers: { 'x-api-key': 'dev-key' },
  });
  expect(layout.ok()).toBeTruthy();
  const domain = await request.post(`${STUB_BASE}/objects/test/reset-domain`, {
    headers: { 'x-api-key': 'dev-key' },
  });
  expect(domain.ok()).toBeTruthy();
}

interface LayoutFixture {
  readonly id: string;
  readonly type: 'surface' | 'region' | 'view-instance';
  readonly properties: Record<string, unknown>;
  readonly relations?: Record<string, readonly string[]>;
}

async function seedLayoutFixture(
  request: APIRequestContext,
  objects: readonly LayoutFixture[],
) {
  for (const object of objects) {
    const created = await request.post(`${STUB_BASE}/objects/action`, {
      headers: { 'x-api-key': 'dev-key' },
      data: {
        kind: 'create',
        type: object.type,
        props: { id: object.id, ...object.properties },
      },
    });
    expect(created.ok()).toBeTruthy();
  }
  for (const object of objects) {
    for (const [edge, children] of Object.entries(object.relations ?? {})) {
      for (const [index, childId] of children.entries()) {
        const moved = await request.post(`${STUB_BASE}/objects/action`, {
          headers: { 'x-api-key': 'dev-key' },
          data: {
            kind: 'move',
            id: childId,
            new_parent: object.id,
            order: index + 1,
            edge,
          },
        });
        expect(moved.ok()).toBeTruthy();
      }
    }
  }
}

async function openInjectedSurface(page: Page, surfaceId: string) {
  await page.locator('[data-layout-switcher]').click();
  await page.locator(`[data-layout-option="${surfaceId}"]`).click();
  await expect(page.locator('[data-shell]')).toHaveAttribute('data-active-surface', surfaceId, {
    timeout: 15_000,
  });
}

test.describe('prototype.stage live UI (PT-006 / PT-007)', () => {
  test.beforeEach(async ({ page, request }) => {
    const health = await request.get(`${PROTO_LIVE_BASE}/healthz`);
    test.skip(!health.ok(), `Start proto live server at ${PROTO_LIVE_BASE} first`);
    await resetStub(request);
    await freshLoad(page);
  });

  test('loads falling-boxes .rrd through absolute recording_url and reaches Ready', async ({
    page,
    request,
  }) => {
    const recordingUrl = `${PROTO_LIVE_BASE}/v1/prototype/recordings/${encodeURIComponent(RECORDING_ID)}.rrd`;
    await seedLayoutFixture(request, [
      {
        id: 'e2e-proto-surface',
        type: 'surface',
        properties: { name: 'PrototypeStage', kind: 'review', active: false },
        relations: { CONTAINS: ['e2e.proto-region'] },
      },
      {
        id: 'e2e.proto-region',
        type: 'region',
        properties: { kind: 'editor', size: 100, active_tab: 'e2e.vi-proto' },
        relations: { CONTAINS: ['e2e.vi-proto'] },
      },
      {
        id: 'e2e.vi-proto',
        type: 'view-instance',
        properties: {
          descriptor_id: 'prototype.stage',
          title: 'Falling boxes stage',
          config: {
            recording_url: recordingUrl,
            recording_id: RECORDING_ID,
            view_node_id: 'view-falling-boxes',
            path_to_expr: PATH_TO_EXPR,
          },
        },
      },
    ]);

    await page.reload({ waitUntil: 'domcontentloaded' });
    await settled(page);
    await openInjectedSurface(page, 'e2e-proto-surface');

    const stage = page.locator('[data-prototype-stage]');
    await expect(stage).toBeVisible({ timeout: 30_000 });
    await expect(stage).toHaveAttribute('data-prototype-status', 'Ready', {
      timeout: 90_000,
    });
    await expect(page.locator('[data-prototype-viewer]')).toBeVisible();
    await expect(page.locator('[data-prototype-error]')).toHaveCount(0);

    await page.screenshot({
      path: 'e2e/artifacts/prototype-stage-ready.png',
      fullPage: false,
    });
  });

  test('resolves recording_id via gateway_base shaped URL', async ({ page, request }) => {
    await seedLayoutFixture(request, [
      {
        id: 'e2e-proto-gw-surface',
        type: 'surface',
        properties: { name: 'PrototypeGateway', kind: 'review', active: false },
        relations: { CONTAINS: ['e2e.proto-gw-region'] },
      },
      {
        id: 'e2e.proto-gw-region',
        type: 'region',
        properties: { kind: 'editor', size: 100, active_tab: 'e2e.vi-proto-gw' },
        relations: { CONTAINS: ['e2e.vi-proto-gw'] },
      },
      {
        id: 'e2e.vi-proto-gw',
        type: 'view-instance',
        properties: {
          descriptor_id: 'prototype.stage',
          title: 'Gateway recording stage',
          config: {
            recording_id: RECORDING_ID,
            gateway_base: PROTO_LIVE_BASE,
            view_node_id: 'view-falling-boxes',
            path_to_expr: PATH_TO_EXPR,
          },
        },
      },
    ]);

    await page.reload({ waitUntil: 'domcontentloaded' });
    await settled(page);
    await openInjectedSurface(page, 'e2e-proto-gw-surface');

    const stage = page.locator('[data-prototype-stage]');
    await expect(stage).toBeVisible({ timeout: 30_000 });
    await expect(stage).toHaveAttribute('data-prototype-status', 'Ready', {
      timeout: 90_000,
    });
  });

  test('interior shell mounts prototype.stage without a recording (Unavailable)', async ({
    page,
    request,
  }) => {
    // Mirrors ProgramView openSelectedInterior when a View node is present but
    // no simulate receipt has produced a recording_id yet.
    await seedLayoutFixture(request, [
      {
        id: 'e2e-proto-shell-surface',
        type: 'surface',
        properties: { name: 'PrototypeShell', kind: 'review', active: false },
        relations: { CONTAINS: ['e2e.proto-shell-region'] },
      },
      {
        id: 'e2e.proto-shell-region',
        type: 'region',
        properties: { kind: 'editor', size: 100, active_tab: 'e2e.vi-proto-shell' },
        relations: { CONTAINS: ['e2e.vi-proto-shell'] },
      },
      {
        id: 'e2e.vi-proto-shell',
        type: 'view-instance',
        properties: {
          descriptor_id: 'prototype.stage',
          title: 'Interior stage shell',
          config: {
            recording_id: '',
            view_node_id: 'view-interior',
            path_to_expr: {},
          },
        },
      },
    ]);

    await page.reload({ waitUntil: 'domcontentloaded' });
    await settled(page);
    await openInjectedSurface(page, 'e2e-proto-shell-surface');

    const stage = page.locator('[data-prototype-stage]');
    await expect(stage).toBeVisible({ timeout: 30_000 });
    await expect(stage).toHaveAttribute('data-prototype-status', 'Unavailable', {
      timeout: 15_000,
    });
    await expect(page.locator('[data-prototype-error]')).toContainText('recording_url');
  });
});
