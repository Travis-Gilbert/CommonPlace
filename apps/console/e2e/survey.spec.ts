// SOURCING: @playwright/test. The Indexer proof follows the user-visible path:
// a standing topic opens a populated descriptor-backed 3D Indexer, source
// forms remain heterogeneous, annotation stays separate, and reduced motion
// preserves the same information in the flat clustered layout.

import { expect, test, type Page } from '@playwright/test';
import axe from 'axe-core';

async function resetAndOpenTopics(page: Page) {
  await page.goto('/');
  await page.evaluate(() => window.localStorage.removeItem('commonplace.console.surface.v1'));
  await page.reload();
  await page.waitForSelector('[data-shell]');
  await page.locator('[data-layout-switcher]').click();
  await page.locator('[data-layout-option="console-topics"]').click();
  await expect(page.locator('[data-shell]')).toHaveAttribute('data-active-surface', 'console-topics');
}

async function openSurvey(page: Page) {
  await resetAndOpenTopics(page);
  await page.getByRole('button', { name: /Evidence centered research surfaces/ }).click();
  await expect(page.locator('[data-shell]')).toHaveAttribute('data-active-surface', 'console-survey');
  await expect(page.locator('[data-survey]')).toBeVisible();
}

async function expectSpatialIndexerOverview(page: Page) {
  await expect(page.locator('[data-capture-id][data-spatial="true"]')).toHaveCount(15, {
    timeout: 20_000,
  });
  const sceneBounds = await page.locator('[data-survey-layout="3d"]').boundingBox();
  const cardBounds = await page.locator('[data-capture-id][data-spatial="true"]').evaluateAll((cards) => (
    cards.map((card) => {
      const bounds = card.getBoundingClientRect();
      return {
        left: bounds.left,
        top: bounds.top,
        right: bounds.right,
        bottom: bounds.bottom,
        width: bounds.width,
        height: bounds.height,
      };
    })
  ));
  const worldDepths = await page.locator('.stellar-gallery-card-frame').evaluateAll((frames) => (
    frames.map((frame) => Number(frame.getAttribute('data-world-z')))
  ));
  expect(sceneBounds).not.toBeNull();
  expect(cardBounds).toHaveLength(15);
  expect(Math.max(...cardBounds.map((bounds) => bounds.width))).toBeGreaterThan(100);
  expect(worldDepths).toHaveLength(15);
  expect(Math.max(...worldDepths) - Math.min(...worldDepths)).toBeGreaterThan(24);
  expect(new Set(worldDepths.map((depth) => depth.toFixed(2))).size).toBeGreaterThan(10);
  if (sceneBounds) {
    for (const bounds of cardBounds) {
      expect(bounds.width).toBeGreaterThan(0);
      expect(bounds.height).toBeGreaterThan(0);
      expect(bounds.left).toBeGreaterThanOrEqual(sceneBounds.x);
      expect(bounds.top).toBeGreaterThanOrEqual(sceneBounds.y);
      expect(bounds.right).toBeLessThanOrEqual(sceneBounds.x + sceneBounds.width);
      expect(bounds.bottom).toBeLessThanOrEqual(sceneBounds.y + sceneBounds.height);
    }
  }
}

test.describe('Indexer research surface', () => {
  test('a standing topic opens a source-faithful 3D Indexer with evidence and camera zoom', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await openSurvey(page);

    await expect(page.getByRole('heading', { name: 'Evidence centered research surfaces' })).toBeVisible();
    const survey = page.locator('[data-survey]');
    await expect(survey).toHaveAttribute('data-scene-mode', '3d');
    await expect(page.getByRole('application', { name: /Three dimensional Indexer/ })).toBeVisible();
    await expect(page.locator('[data-survey-summary]')).toHaveCount(0);
    // Ambient ground is MaterialLayer; the gallery shell stays transparent.
    await expect(page.locator('.stellar-gallery')).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
    await expect(page.locator('.stellar-gallery-ground, .stellar-gallery-pegboard').first()).toHaveCSS('opacity', '0');
    await expect(page.locator('[data-capture-id]')).toHaveCount(15, { timeout: 20_000 });
    await expectSpatialIndexerOverview(page);
    await expect(page.locator('[data-source-kind="document"]')).toHaveCount(4);
    await expect(page.locator('[data-source-kind="code"]')).toHaveCount(7);
    await expect(page.locator('[data-source-kind="receipt"]')).toHaveCount(2);
    await expect(page.locator('[data-source-kind="visualization"]')).toHaveCount(1);
    await expect(page.locator('[data-source-kind="article"]')).toHaveCount(1);
    const heldPreviews = page.locator(
      '[data-capture-id][data-spatial="true"] img[data-source-preview-kind]',
    );
    await expect(heldPreviews).toHaveCount(15);
    await expect(page.locator('img[data-source-preview-kind="screenshot"]')).toHaveCount(12);
    await expect(page.locator('img[data-source-preview-kind="open_graph"]')).toHaveCount(3);
    await expect(page.getByText('reconstructed', { exact: true })).toHaveCount(0);
    const githubPreview = page.locator(
      '[data-capture-id="capture-survey-brief"] img[data-source-preview-kind="open_graph"]',
    );
    await expect(githubPreview).toBeVisible();
    await expect(githubPreview).toHaveAttribute(
      'alt',
      'GitHub preview for the CommonPlace Survey design commit',
    );
    await expect(githubPreview).toHaveAttribute('src', '/survey/github-commonplace-survey-commit-og.png');
    await expect(githubPreview).toHaveAttribute('data-source-preview-kind', 'open_graph');
    await expect(githubPreview).toHaveCSS('object-fit', 'contain');
    await expect(page.locator(
      '[data-capture-id="capture-margin-recall"] img[data-source-preview-kind="screenshot"]',
    )).toHaveCSS('object-fit', 'contain');
    await expect(page.getByText('Browse 15 sources')).toBeVisible();
    await expect(page.getByText(/Review \d+ connections/)).toBeVisible();

    await expect.poll(async () => Number(await survey.getAttribute('data-scene-calls'))).toBeGreaterThan(0);
    const calls = Number(await survey.getAttribute('data-scene-calls'));
    const triangles = Number(await survey.getAttribute('data-scene-triangles'));
    const textures = Number(await survey.getAttribute('data-scene-textures'));
    expect(calls).toBeLessThan(100);
    expect(triangles).toBeLessThan(200_000);
    expect(textures).toBeLessThan(64);

    await page.addScriptTag({ content: axe.source });
    const violations = await page.evaluate(async () => {
      const engine = (window as unknown as {
        axe: {
          run: (
            context: string,
            options: Record<string, unknown>,
          ) => Promise<{
            violations: {
              id: string;
              impact: string | null;
              nodes: { target: string[]; html: string; failureSummary: string }[];
            }[];
          }>;
        };
      }).axe;
      const results = await engine.run('[data-survey]', {
        runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'] },
        resultTypes: ['violations'],
      });
      return results.violations.map((violation) => ({
        id: violation.id,
        impact: violation.impact,
        nodes: violation.nodes.map((node) => ({
          target: node.target,
          html: node.html,
          failureSummary: node.failureSummary,
        })),
      }));
    });
    expect(violations).toEqual([]);

    await page.getByText(/Review \d+ connections/).click();
    await expect(page.getByText('Accessible information survives visual reduction')).toBeVisible();
    await page.getByText(/Review \d+ connections/).click();

    await page.getByRole('button', { name: 'far' }).click();
    await expect(survey).toHaveAttribute('data-camera-distance', '48');
    await expect(page.locator('[data-survey-layout="3d"]')).toBeVisible();

    const spatialSources = page.locator('[data-capture-id][data-spatial="true"]');
    await expect(spatialSources.first()).toHaveAttribute('data-focus', 'idle');
    await expect(page.locator('[data-capture-id][data-spatial="true"][data-focus="idle"]')).toHaveCount(15);
    const edgeMarkers = page.locator('[data-survey-edge-id]');
    await expect(edgeMarkers.first()).toBeAttached();
    await expect(page.locator('[data-edge-active="true"]')).toHaveCount(0);
    expect(Number(await edgeMarkers.first().getAttribute('data-edge-idle-opacity')))
      .toBeGreaterThanOrEqual(0.08);
    const connectedCaptureIds = new Set((await edgeMarkers.evaluateAll((markers) => (
      markers.flatMap((marker) => [
        marker.getAttribute('data-edge-from'),
        marker.getAttribute('data-edge-to'),
      ]).filter((id): id is string => Boolean(id))
    ))));
    let sourceBounds: { x: number; y: number; width: number; height: number } | null = null;
    for (let index = 0; index < await spatialSources.count(); index += 1) {
      const captureId = await spatialSources.nth(index).getAttribute('data-capture-id');
      if (!captureId || !connectedCaptureIds.has(captureId)) continue;
      const bounds = await spatialSources.nth(index).boundingBox();
      if (!bounds) continue;
      const centerX = bounds.x + bounds.width / 2;
      const centerY = bounds.y + bounds.height / 2;
      if (centerX > 80 && centerX < 1000 && centerY > 150 && centerY < 800) {
        sourceBounds = bounds;
        break;
      }
    }
    expect(sourceBounds).not.toBeNull();
    if (sourceBounds) {
      await page.mouse.move(
        sourceBounds.x + sourceBounds.width / 2,
        sourceBounds.y + sourceBounds.height / 2,
      );
      await expect(page.locator('[data-capture-id][data-spatial="true"][data-focus="focused"]')).toHaveCount(1);
      await expect(page.locator('[data-capture-id][data-spatial="true"][data-focus="dimmed"]').first()).toBeVisible();
      const activeEdge = page.locator('[data-edge-active="true"]').first();
      await expect(activeEdge).toBeAttached();
      const activeEdgeBounds = await activeEdge.boundingBox();
      expect(activeEdgeBounds).not.toBeNull();
      if (activeEdgeBounds) {
        await page.mouse.click(
          activeEdgeBounds.x + activeEdgeBounds.width / 2,
          activeEdgeBounds.y + activeEdgeBounds.height / 2,
        );
        const pinnedEdge = page.locator('[data-edge-pinned="true"]');
        await expect(pinnedEdge).toHaveCount(1);
        await expect(pinnedEdge).toHaveAttribute('data-edge-emphasis', 'pinned');
        await page.mouse.move(60, 800);
        await expect(pinnedEdge).toHaveCount(1);
      }
      await page.mouse.click(
        sourceBounds.x + sourceBounds.width / 2,
        sourceBounds.y + sourceBounds.height / 2,
      );
    }
    await expect(page.locator('[data-survey-layout="open"]')).toBeVisible();
    await page.getByRole('button', { name: 'Back to Indexer' }).click();

    await page.getByRole('button', { name: 'mid' }).click();
    await expect(survey).toHaveAttribute('data-camera-distance', '15');
    await page.getByText('Browse 15 sources').click();
    await page.getByRole('button', { name: 'Open captured source: Depth is optional, information is not' }).click();
    await expect(page.locator('[data-survey-layout="open"]')).toBeVisible();
    await expect(page.getByRole('img', { name: 'GitHub source page for the Console motion tokens' })).toBeVisible();
    await expect(page.getByText('screenshot · held', { exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Data Wave tags' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Matched evidence' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Orgs and entities' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'People and mentions' })).toBeVisible();
    await expect(page.getByRole('heading', { name: /Remembered connections/ })).toBeVisible();
    await expect(page.getByText('settled flat grid')).toBeVisible();
    await expect(page.getByText('@accessibility')).toBeVisible();
    await expect(page.getByRole('button', { name: '/do follow-up' })).toBeDisabled();
    await page.getByRole('button', { name: 'Back to Indexer' }).click();
    await expect(page.locator('[data-survey]')).toBeVisible();

    await page.getByText('Browse 15 sources').click();
    await page.getByRole('button', { name: 'Open captured source: The Survey makes the research image the product' }).click();
    await expect(page.locator('[data-survey-layout="open"]')).toBeVisible();
    await expect(page.getByRole('img', { name: 'GitHub preview for the CommonPlace Survey design commit' })).toBeVisible();
    await expect(page.getByText('open graph · held', { exact: true })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Original source' })).toHaveAttribute(
      'href',
      'https://github.com/Travis-Gilbert/CommonPlace/commit/b66beba0bf58b6c93d599748edba3f3c799765b1',
    );
  });

  test('the spatial overview keeps the complete topic corpus visible at 1280', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await openSurvey(page);

    await expect(page.locator('[data-survey]')).toHaveAttribute('data-scene-mode', '3d');
    await expectSpatialIndexerOverview(page);
  });

  test('reduced motion renders the same capture corpus as a settled flat grid', async ({ browser }) => {
    const context = await browser.newContext({ reducedMotion: 'reduce', colorScheme: 'dark' });
    const page = await context.newPage();
    await page.setViewportSize({ width: 1440, height: 900 });
    await openSurvey(page);

    await expect(page.locator('[data-survey-layout="flat"]')).toBeVisible();
    await expect(page.locator('[data-capture-id]')).toHaveCount(15);
    await expect(page.locator('[data-survey-connections]')).toContainText('Accessible information survives visual reduction');
    const transform = await page.locator('[data-capture-id]').first().evaluate(
      (element) => getComputedStyle(element).transform,
    );
    expect(transform).toBe('none');
    await context.close();
  });

  test('the command preview disables perspective and CSS lift without changing OS settings', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await openSurvey(page);
    await expect(page.locator('[data-survey-layout="3d"]')).toBeVisible();

    await page.keyboard.press('Control+l');
    const input = page.locator('[data-omnibar-island] input');
    await input.fill('>Toggle reduced motion preview');
    await page.getByText('Toggle reduced motion preview', { exact: true }).click();

    const survey = page.locator('[data-survey]');
    await expect(survey).toHaveAttribute('data-reduced-motion', 'true');
    await expect(page.locator('[data-survey-layout="flat"]')).toBeVisible();
    await expect(page.locator('[data-capture-id]')).toHaveCount(15);
    const firstCard = page.locator('[data-capture-id]').first();
    await firstCard.hover();
    await expect.poll(() => firstCard.evaluate((element) => getComputedStyle(element).transform))
      .toBe('none');
  });
});
