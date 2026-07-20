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

      // The inversion, stated as the pinned register actually holds it. In Int
      // UI Dark --ij-seam and --ij-editor are BOTH gray-1: the seam beside the
      // well is the well's own value, and the boundary reads because chrome
      // (gray-2) is lighter than both. So the rule is "never lighter than a
      // neighbour, and strictly darker than the chrome it bounds" -- demanding
      // strictly-darker-than-everything would be asserting against JetBrains
      // rather than against drift.
      expect(seam, 'seam must be darker than chrome').toBeLessThan(chrome);
      expect(seam, 'seam must never be lighter than the editor well').toBeLessThanOrEqual(editor);

      // --ij-seam-raised is a different job from --ij-seam, and the pinned
      // register treats it differently. A structural seam separates two planes
      // of the app and sinks below both. A raised seam is the border of a
      // surface FLOATING above the plane behind it, so it moves away from its
      // own surface toward whatever it has to be visible against: gray-4 over
      // gray-3 in dark (lighter), gray-10 under white in light (darker). The
      // rule is therefore a measurable separation in the direction the theme
      // needs, which is what "visible against white" means in light.
      expect(
        Math.abs(seamRaised - raised),
        'the raised seam must separate measurably from the surface it bounds',
      ).toBeGreaterThan(0.005);
      if (theme === 'light') {
        expect(seamRaised, 'in light the raised seam must be darker than the white it bounds').toBeLessThan(raised);
      } else {
        expect(seamRaised, 'in dark the raised seam rises off its surface, per Int UI Dark').toBeGreaterThan(raised);
      }

      // Island junctions that still carry CSS seams (headers, tabs). Frame-
      // resident toolbar/status and gutters are painted by the Material Layer.
      const junctions: { name: string; selector: string; side: string }[] = [
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
          `${junction.name}: seam ${colour} must be darker than the chrome ladder slot`,
        ).toBeLessThan(chrome);
      }

      // Companion-to-editor boundary is the island gutter (transparent handle).
      const panelSeam = page.locator('[data-panel-seam]').first();
      await expect(panelSeam, 'the companion-to-editor gutter must render').toBeVisible();
      await expect(panelSeam).toHaveCSS('width', '10px');
      await expect(panelSeam).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
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

      // The stripe is frame chrome (flush activity bar), not an island.
      const stripe = page.locator('[data-paint-region="stripe"]');
      await expect(stripe).toHaveCSS('width', '40px');
      await expect(stripe).toHaveAttribute('data-frame-resident', 'stripe');
      await expect(stripe).not.toHaveAttribute('data-island');
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
    // editor island whose fill the Material Layer paints (transparent DOM).
    test('the active tab underline and the editor island hold', async ({ page }) => {
      const accent = await resolveToken(page, '--ij-accent');
      const editor = await resolveToken(page, '--ij-editor');

      const underline = page.locator('[role="tab"][aria-selected="true"] .h-ij-underline');
      await expect(underline).toHaveCSS('height', '4px');
      await expect(underline).toHaveCSS('background-color', accent);

      await expect(page.locator('[data-paint-region="tab-strip"]')).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
      await expect(page.locator('[data-paint-region="editor-well"]').first()).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
      await expect(page.locator('[data-island="editor"]')).toBeVisible();
      await expect(page.locator('[data-material-layer]')).toBeVisible();
      await expect(page.locator('[data-frame-resident="stripe"]')).toBeVisible();
      await expect(page.locator('[data-bottom-dock]')).toHaveCount(0);
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
    // window header strip at 36px Manrope (amendment 35).
    test('type metrics and the tool window header strip hold', async ({ page }) => {
      await expect(page.locator('html')).toHaveCSS('font-size', '13px');
      const header = page.locator('[data-paint-region="tool-window-header"]').first();
      await expect(header).toHaveCSS('height', '36px');
      await expect(header).toHaveCSS('font-size', '13px');
      await expect(header).toHaveCSS('font-family', /Manrope/i);
      const ink = await resolveToken(page, '--ij-ink');
      await expect(header).toHaveCSS('color', ink);
      // The right-aligned action slot carries the hide affordance.
      await expect(header.locator('[data-tool-window-hide]')).toBeVisible();
    });

    // X3.5 density: the 24px row rhythm and the 4px grid, measured rather than
    // asserted by inspection. Tailwind's spacing scale is the 4px grid and the
    // bridge resets colour, font and radius but deliberately not spacing, so
    // the grid holds by construction -- this is the gate that keeps it holding.
    test('rows keep the 24px rhythm and paddings stay on the 4px grid', async ({ page }) => {
      await page.locator('[data-companion-nav="files"]').click();
      const row = page.locator('[data-tool-window="files"] [role="treeitem"]').first();
      if (await row.count()) await expect(row).toHaveCSS('height', '24px');

      const offGrid = await page.evaluate(() => {
        const offenders: { region: string; property: string; value: string }[] = [];
        for (const node of document.querySelectorAll<HTMLElement>('[data-paint-region]')) {
          const styles = getComputedStyle(node);
          for (const property of ['paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft'] as const) {
            const value = Number.parseFloat(styles[property]);
            if (Number.isFinite(value) && value % 4 !== 0) {
              offenders.push({ region: node.dataset.paintRegion ?? '?', property, value: styles[property] });
            }
          }
        }
        return offenders;
      });
      expect(offGrid, 'every named region pads on the 4px grid').toEqual([]);
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

    // X1 acceptance: the capture set. The three sheen states must render
    // VISIBLY, which means mutually distinguishable pixels, not three names for
    // the same paint. Idle and streaming also land as PNG artifacts so the
    // side-by-side is inspectable; commit lives for DUR.fast, so it is captured
    // from the canvas itself rather than raced against the screenshot pipeline.
    test('the sheen capture set distinguishes idle, streaming and commit', async ({ page }) => {
      const composer = page.locator('[data-paint-region="composer"]').first();
      const canvas = page.locator('canvas[data-composer-sheen]').first();

      /** A cheap, stable signature of what the canvas is currently painting. */
      const signature = () =>
        canvas.evaluate((node: HTMLCanvasElement) => {
          const context = node.getContext('2d');
          const pixels = context?.getImageData(0, 0, node.width, node.height).data;
          let alpha = 0;
          let red = 0;
          let green = 0;
          let blue = 0;
          for (let index = 0; index < (pixels?.length ?? 0); index += 4) {
            const data = pixels as Uint8ClampedArray;
            alpha += data[index + 3];
            red += data[index];
            green += data[index + 1];
            blue += data[index + 2];
          }
          return { alpha, red, green, blue, state: node.dataset.sheenState };
        });

      const idle = await signature();
      expect(idle.state).toBe('idle');
      await expect(composer).toHaveScreenshot(`composer-sheen-idle-${theme}.png`);

      // Hold the stream open so the streaming state is observable rather than
      // instantaneous.
      let release: () => void = () => {};
      const held = new Promise<void>((resolve) => {
        release = resolve;
      });
      await page.route('**/api/chat/stream', async (route) => {
        await held;
        await route.fulfill({
          status: 200,
          contentType: 'text/event-stream',
          body: 'event: text\ndata: {"text":"Grounded answer."}\n\n',
        });
      });

      const input = page.locator('[data-composer-input]');
      await input.fill('Show the sheen while the agent works.');
      await input.press('Enter');
      await expect(canvas).toHaveAttribute('data-sheen-state', 'streaming');
      const streaming = await signature();
      await expect(composer).toHaveScreenshot(`composer-sheen-streaming-${theme}.png`);

      release();
      await expect(page.getByText('Grounded answer.')).toBeVisible();
      // The commit flash: sample the canvas inside its own window.
      const commit = await canvas.evaluate((node: HTMLCanvasElement) => new Promise<{
        alpha: number;
        state: string | undefined;
      }>((resolve) => {
        const read = () => {
          const context = node.getContext('2d');
          const pixels = context?.getImageData(0, 0, node.width, node.height).data;
          let alpha = 0;
          for (let index = 3; index < (pixels?.length ?? 0); index += 4) {
            alpha += (pixels as Uint8ClampedArray)[index];
          }
          return { alpha, state: node.dataset.sheenState };
        };
        const started = performance.now();
        const poll = () => {
          const sample = read();
          if (sample.state === 'commit' || performance.now() - started > 2000) resolve(sample);
          else requestAnimationFrame(poll);
        };
        poll();
      }));

      // The three states are distinct paint, not three labels for one wash.
      expect(idle.alpha, 'idle must paint something').toBeGreaterThan(0);
      expect(streaming.alpha, 'streaming must paint something').toBeGreaterThan(0);
      expect(commit.alpha, 'commit must paint something').toBeGreaterThan(0);
      expect(commit.state, 'the commit state must be reached').toBe('commit');
      expect(
        commit.alpha,
        'commit lifts the wash above idle (0.08 against 0.032 in the canvas budget)',
      ).toBeGreaterThan(idle.alpha);
    });
  });
}

// X4 acceptance: the baseline set covers BOTH themes at 1280 and 1440. The
// light pair lives in appearance.spec (it predates this pass); the dark pair is
// captured here so the two themes are gated at the same widths by the same
// workspace path, which is what stops light from being a variant checked once.
for (const { theme, preset } of THEMES.filter((entry) => entry.theme === 'dark')) {
  for (const viewport of [
    { width: 1280, height: 800 },
    { width: 1440, height: 900 },
  ]) {
    test(`holds the ${viewport.width} ${theme} baseline`, async ({ page }) => {
      await page.emulateMedia({ reducedMotion: 'reduce', colorScheme: theme });
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await openWorkspace(page, preset);
      await expect(page).toHaveScreenshot(`workspace-${viewport.width}-${theme}.png`, { fullPage: true });
    });
  }
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
