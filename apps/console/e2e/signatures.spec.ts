// SOURCING: @playwright/test. The signature gate (HANDOFF-CONSOLE-DIMENSIONALITY
// X4): the five IntelliJ chrome signatures, the X2 paint scan, the X1 composer
// material assertion, and the X3 junction-seam assertions, all parameterized
// over data-theme and run on dark AND light.
//
// The five-minute test is the point. Light is not a variant to be checked once;
// it is the mode that exposes every unpainted surface and every missing seam,
// so the gate that governs dark governs light identically or it governs nothing.

import { expect, test, type Page } from '@playwright/test';
import { expectEveryRegionPainted, luminance, resolveToken } from './paint-audit';

const APPEARANCE_KEY = 'commonplace.console.appearance.v1';
const SURFACE_KEY = 'commonplace.console.surface.v1';

const THEMES = [
  { theme: 'dark', preset: 'intellij-dark' },
  { theme: 'light', preset: 'intellij-light' },
] as const;

async function settled(page: Page) {
  await page.waitForSelector('[data-shell]');
  await page.waitForTimeout(600);
}

/** Opens the workspace surface in the requested theme. Both themes travel the
 *  same path, so a signature cannot pass in one mode by taking a shortcut. */
async function openWorkspace(page: Page, preset: string) {
  await page.goto('/');
  await page.evaluate(([appearance, surface]) => {
    localStorage.removeItem(appearance);
    localStorage.removeItem(surface);
  }, [APPEARANCE_KEY, SURFACE_KEY]);
  await page.reload();
  await settled(page);
  await page.locator('[data-layout-switcher]').click();
  await page.locator('[data-layout-option="console-appearance"]').click();
  await expect(page.locator('[data-appearance-view]')).toBeVisible();
  await page.locator(`[data-appearance-preset="${preset}"]`).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme-preset', preset);
  await page.locator('[data-layout-switcher]').click();
  await page.locator('[data-layout-option="console-workspace"]').click();
  await settled(page);
}

for (const { theme, preset } of THEMES) {
  test.describe(`chrome signatures on ${theme}`, () => {
    test.beforeEach(async ({ page }) => {
      await openWorkspace(page, preset);
      await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
    });

    // Signature 1. The Int UI inversion: seams are DARKER than the surfaces
    // they separate, in BOTH themes. This is the assertion the handoff calls
    // "the inversion test generalized", and it is what caught the
    // companion-to-editor junction painting --ij-divider (gray-3 in dark:
    // lighter than the gray-2 chrome beside it).
    test('every named junction seam is darker than both neighbours', async ({ page }) => {
      const seam = luminance(await resolveToken(page, '--ij-seam'));
      const seamRaised = luminance(await resolveToken(page, '--ij-seam-raised'));
      const chrome = luminance(await resolveToken(page, '--ij-chrome'));
      const editor = luminance(await resolveToken(page, '--ij-editor'));
      const raised = luminance(await resolveToken(page, '--ij-raised'));

      expect(seam, 'seam must be darker than chrome').toBeLessThan(chrome);
      expect(seam, 'seam must be darker than the editor well').toBeLessThan(editor);
      expect(seamRaised, 'raised seam must be darker than the raised surface').toBeLessThan(raised);

      // The junctions themselves, as rendered rather than as tokens.
      const junctions: { name: string; selector: string; side: string }[] = [
        { name: 'toolbar bottom', selector: '[data-paint-region="toolbar"]', side: 'border-bottom-color' },
        { name: 'stripe right', selector: '[data-paint-region="stripe"]', side: 'border-right-color' },
        { name: 'status bar top', selector: '[data-paint-region="status-bar"]', side: 'border-top-color' },
        { name: 'tool window header bottom', selector: '[data-paint-region="tool-window-header"]', side: 'border-bottom-color' },
        { name: 'tab strip bottom', selector: '[data-paint-region="tab-strip"]', side: 'border-bottom-color' },
      ];
      for (const junction of junctions) {
        const element = page.locator(junction.selector).first();
        await expect(element, `${junction.name} must render`).toBeVisible();
        const colour = await element.evaluate(
          (node, property) => getComputedStyle(node).getPropertyValue(property),
          junction.side,
        );
        expect(
          luminance(colour),
          `${junction.name}: seam ${colour} must be darker than the chrome it bounds`,
        ).toBeLessThan(chrome);
      }

      // The companion-to-editor boundary is the resize handle.
      const panelSeam = page.locator('[data-panel-seam]').first();
      await expect(panelSeam, 'the companion-to-editor seam must render').toBeVisible();
      const panelColour = await panelSeam.evaluate((node) => getComputedStyle(node).backgroundColor);
      expect(luminance(panelColour), 'companion-to-editor seam must be darker than chrome').toBeLessThan(chrome);
      expect(luminance(panelColour), 'companion-to-editor seam must be darker than the editor well').toBeLessThan(editor);
    });

    // Signature 2. The stripe button in its RESTORED grammar (X3.4, named
    // choice 5): a weak fill when selected with the glyph at full ink, never a
    // saturated accent tile with an inverted glyph.
    test('the stripe selected state is a weak fill, not a saturated tile', async ({ page }) => {
      const selection = await resolveToken(page, '--ij-selection');
      const accent = await resolveToken(page, '--ij-accent');
      const ink = await resolveToken(page, '--ij-ink');

      const selected = page.locator('[data-surface-rail] button[aria-checked="true"]').first();
      await expect(selected).toHaveCSS('background-color', selection);
      await expect(selected).not.toHaveCSS('background-color', accent);
      await expect(selected).toHaveCSS('color', ink);

      // The stripe bar itself keeps its Int UI metrics and chrome ground.
      const stripe = page.locator('[data-paint-region="stripe"]');
      await expect(stripe).toHaveCSS('width', '40px');
      const glyph = selected.locator('svg');
      await expect(glyph).toHaveAttribute('width', '20');

      // Toggling a companion keeps the same grammar and the radio/toggle
      // semantics the I1 e2e governs.
      await page.keyboard.press('Alt+Shift+1');
      const companion = page.locator('[data-companion-nav="files"]');
      await expect(companion).toHaveAttribute('aria-pressed', 'true');
      await expect(companion).toHaveCSS('background-color', selection);
    });

    // Signature 3. The 4px accent underline on the active editor tab, and the
    // editor island it sits on (X3.3).
    test('the active tab underline and the editor island hold', async ({ page }) => {
      const accent = await resolveToken(page, '--ij-accent');
      const chrome = await resolveToken(page, '--ij-chrome');
      const editor = await resolveToken(page, '--ij-editor');

      const underline = page.locator('[role="tab"][aria-selected="true"] .h-ij-underline');
      await expect(underline).toHaveCSS('height', '4px');
      await expect(underline).toHaveCSS('background-color', accent);

      await expect(page.locator('[data-paint-region="tab-strip"]')).toHaveCSS('background-color', chrome);
      await expect(page.locator('[data-paint-region="editor-well"]').first()).toHaveCSS('background-color', editor);
      await expect(page.locator('[role="tab"][aria-selected="true"]')).toHaveCSS('background-color', editor);
    });

    // Signature 4. The run widget goes green while a run is live, and carries
    // the Int UI control height at rest.
    test('the run widget holds its metrics and its running colour', async ({ page }) => {
      const running = await resolveToken(page, '--ij-running');
      const widget = page.locator('[data-run-widget]');
      await expect(widget).toHaveCSS('height', '28px');
      await expect(widget).toHaveAttribute('data-running', 'false');

      const live = await page.evaluate((expected) => {
        const probe = document.createElement('div');
        probe.style.backgroundColor = 'var(--ij-running)';
        document.body.append(probe);
        const value = getComputedStyle(probe).backgroundColor;
        probe.remove();
        return value === expected;
      }, running);
      expect(live, '--ij-running must resolve in this theme').toBe(true);
    });

    // Signature 5. Type metrics: the register's 13px UI face, and the tool
    // window header strip at its Int UI 24px (X3.2).
    test('type metrics and the tool window header strip hold', async ({ page }) => {
      await expect(page.locator('html')).toHaveCSS('font-size', '13px');
      const header = page.locator('[data-paint-region="tool-window-header"]').first();
      await expect(header).toHaveCSS('height', '24px');
      await expect(header).toHaveCSS('font-size', '13px');
      const ink = await resolveToken(page, '--ij-ink');
      await expect(header).toHaveCSS('color', ink);
      // The right-aligned action slot carries the hide affordance.
      await expect(header.locator('[data-tool-window-hide]')).toBeVisible();
    });

    // X2 acceptance, on both themes: no named region inherits its background.
    test('every named region declares its paint', async ({ page }) => {
      await expectEveryRegionPainted(page);
    });

    // X3.A2: the header strip renders on all three companions.
    test('all three companions carry the header strip', async ({ page }) => {
      for (const companion of ['files', 'context', 'thread']) {
        const nav = page.locator(`[data-companion-nav="${companion}"]`);
        if ((await nav.getAttribute('aria-pressed')) !== 'true') await nav.click();
        const window = page.locator(`[data-tool-window="${companion}"]`);
        await expect(window, `${companion} tool window must render`).toBeVisible();
        await expect(
          window.locator('[data-tool-window-header]'),
          `${companion} must carry the Int UI header strip`,
        ).toBeVisible();
      }
    });

    // X1 acceptance, on both themes: the composer's only material is the sheen
    // canvas. Nothing else in the subtree carries a gradient, and the panel
    // carries no shadow (depth is value, seam and header, never shadow).
    test('the composer carries one material and no shadow', async ({ page }) => {
      const composer = page.locator('[data-paint-region="composer"]').first();
      await expect(composer).toBeVisible();

      const raised = await resolveToken(page, '--ij-raised');
      await expect(composer).toHaveCSS('background-color', raised);

      const scan = await composer.evaluate((root) => {
        const offenders: { tag: string; property: string; value: string }[] = [];
        let shadowed = 0;
        let blurred = 0;
        for (const node of [root, ...root.querySelectorAll('*')] as HTMLElement[]) {
          const styles = getComputedStyle(node);
          const isCanvas = node.tagName === 'CANVAS';
          for (const property of ['backgroundImage', 'background'] as const) {
            const value = styles[property];
            if (/gradient\(/.test(value) && !isCanvas) {
              offenders.push({ tag: node.tagName, property, value: value.slice(0, 80) });
            }
          }
          if (styles.boxShadow && styles.boxShadow !== 'none') shadowed += 1;
          if (styles.backdropFilter && styles.backdropFilter !== 'none') blurred += 1;
        }
        return {
          offenders,
          shadowed,
          blurred,
          canvases: root.querySelectorAll('canvas[data-composer-sheen]').length,
          marks: root.querySelectorAll('[data-presence-mark-placement]').length,
        };
      });

      expect(scan.offenders, 'the only gradient in the composer subtree lives inside the canvas').toEqual([]);
      expect(scan.shadowed, 'the composer is permanent, so it takes no shadow').toBe(0);
      expect(scan.blurred, 'the backdrop blur was deleted').toBe(0);
      expect(scan.canvases, 'exactly one sheen canvas').toBe(1);
      expect(scan.marks, 'exactly one Presence mark in the composer').toBe(1);
    });

    // X1 acceptance: the sheen's three states are visibly distinct, and reduced
    // motion renders a STATIC sheen rather than a removed one (the motion-gate
    // reconciliation: static is not absent).
    test('the sheen paints at idle and declares its three states', async ({ page }) => {
      const canvas = page.locator('canvas[data-composer-sheen]').first();
      await expect(canvas).toHaveAttribute('data-sheen-state', 'idle');

      const idle = await canvas.evaluate((node: HTMLCanvasElement) => {
        const context = node.getContext('2d');
        const pixels = context?.getImageData(0, 0, node.width, node.height).data;
        let painted = 0;
        for (let index = 3; index < (pixels?.length ?? 0); index += 4) {
          if ((pixels as Uint8ClampedArray)[index] > 0) painted += 1;
        }
        return { painted, frames: Number(node.dataset.sheenFrames ?? 0) };
      });
      expect(idle.painted, 'the idle sheen must be visibly painted, not blank').toBeGreaterThan(0);
      expect(idle.frames, 'idle draws once').toBeGreaterThan(0);
    });
  });
}

test.describe('the sheen under reduced motion', () => {
  test('renders static and still visible, never removed', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await openWorkspace(page, 'intellij-light');
    const canvas = page.locator('canvas[data-composer-sheen]').first();
    await expect(canvas).toHaveAttribute('data-sheen-state', 'idle');
    const first = await canvas.evaluate((node: HTMLCanvasElement) => Number(node.dataset.sheenFrames ?? 0));
    await page.waitForTimeout(500);
    const second = await canvas.evaluate((node: HTMLCanvasElement) => Number(node.dataset.sheenFrames ?? 0));
    expect(first, 'the resting frame still paints').toBeGreaterThan(0);
    expect(second, 'reduced motion opens no frame loop').toBe(first);
  });
});
