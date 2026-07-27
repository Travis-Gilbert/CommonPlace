// SOURCING: @playwright/test. CN3 visual proof against
// docs/plans/isometric-register/SPEC-ISOMETRIC-REGISTER.md: the data canvas
// renders three connected nodes with hard keylines, explicit offset planes,
// flat text, and neutral connection handles at rest.

import { expect, test, type Page } from '@playwright/test';
import { resolve } from 'node:path';
import { resetLocalStorageBeforeNavigation } from './storage-reset';

async function openCanvas(page: Page) {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await resetLocalStorageBeforeNavigation(page, {
    keys: [
      'commonplace.console.layout-cache.v1',
      'commonplace.console.surface.v1',
    ],
  });
  await page.goto('/canvas');
  await page.waitForFunction(
    () => document.documentElement.getAttribute('data-layout-ready') === '1',
    { timeout: 60_000 },
  );
  await expect(page.locator('[data-canvas-view]')).toBeVisible();
}

test.describe('Data canvas isometric register', () => {
  test('files a deterministic three connected node visual and interaction proof', async ({
    page,
  }, testInfo) => {
    test.setTimeout(300_000);
    await openCanvas(page);

    const canvas = page.locator('[data-canvas-view]');
    const nodes = canvas.locator('[data-canvas-card-node]');
    await expect(nodes).toHaveCount(3);
    await expect(canvas.locator('.react-flow__edge')).toHaveCount(2);
    for (const title of ['Observe the source', 'Connect the claim', 'Verify the result']) {
      await expect(canvas.getByRole('heading', { name: title })).toBeVisible();
    }

    const paint = await nodes.first().evaluate((node) => {
      const textPlane = node.querySelector<HTMLElement>('[data-canvas-card-text-plane]');
      const nodeStyle = getComputedStyle(node);
      const edgeStyle = getComputedStyle(node, '::before');
      const textStyle = textPlane ? getComputedStyle(textPlane) : null;
      return {
        borderStyle: nodeStyle.borderStyle,
        borderWidth: nodeStyle.borderWidth,
        edgeShadow: edgeStyle.boxShadow,
        edgeTransform: edgeStyle.transform,
        nodeShadow: nodeStyle.boxShadow,
        textTransform: textStyle?.transform,
      };
    });
    expect(paint.borderStyle).toBe('solid');
    expect(Number.parseFloat(paint.borderWidth)).toBeGreaterThan(1);
    expect(paint.nodeShadow).toBe('none');
    expect(paint.edgeShadow).toBe('none');
    expect(paint.edgeTransform).not.toBe('none');
    expect(paint.textTransform).toBe('none');

    const sourceHandle = nodes.first().locator('.canvas-card-handle.source');
    const targetHandle = nodes.nth(1).locator('.canvas-card-handle.target');
    await expect(sourceHandle).toBeVisible();
    await expect(targetHandle).toBeVisible();

    const accent = await sourceHandle.evaluate((handle) => {
      const probe = document.createElement('span');
      probe.style.color = 'var(--ij-accent)';
      handle.append(probe);
      const resolved = getComputedStyle(probe).color;
      probe.remove();
      return resolved;
    });
    const restBackground = await sourceHandle.evaluate(
      (handle) => getComputedStyle(handle).backgroundColor,
    );
    expect(restBackground).not.toBe(accent);

    const evidencePath = resolve(
      process.cwd(),
      'docs/plans/isometric-register/canvas-three-connected-nodes.png',
    );
    const screenshot = await canvas.screenshot({
      animations: 'disabled',
      caret: 'hide',
      path: evidencePath,
    });
    await testInfo.attach('SPEC-ISOMETRIC-REGISTER-three-connected-nodes.png', {
      body: screenshot,
      contentType: 'image/png',
    });

    await sourceHandle.hover();
    await expect.poll(
      () => sourceHandle.evaluate((handle) => getComputedStyle(handle).backgroundColor),
    ).toBe(accent);

    const sourceBox = await sourceHandle.boundingBox();
    const targetBox = await targetHandle.boundingBox();
    expect(sourceBox).not.toBeNull();
    expect(targetBox).not.toBeNull();
    if (!sourceBox || !targetBox) throw new Error('canvas handle geometry missing');

    await page.mouse.move(sourceBox.x + sourceBox.width / 2, sourceBox.y + sourceBox.height / 2);
    await page.mouse.down();
    await page.mouse.move(targetBox.x + targetBox.width / 2, targetBox.y + targetBox.height / 2, {
      steps: 8,
    });
    await expect(sourceHandle).toHaveClass(/connectingfrom/);
    await expect(targetHandle).toHaveClass(/connectingto/);
    await expect.poll(
      () => targetHandle.evaluate((handle) => getComputedStyle(handle).backgroundColor),
    ).toBe(accent);
    await page.mouse.up();
  });
});
