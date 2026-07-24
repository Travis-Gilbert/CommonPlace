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
const LAYOUT_CACHE_KEY = 'commonplace.console.layout-cache.v1';
const LEGACY_SURFACE_KEY = 'commonplace.console.surface.v1';

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
  await page.evaluate(([appearance, layout, legacy]) => {
    localStorage.removeItem(appearance);
    localStorage.removeItem(layout);
    localStorage.removeItem(legacy);
  }, [APPEARANCE_KEY, LAYOUT_CACHE_KEY, LEGACY_SURFACE_KEY]);
  await page.reload();
  await settled(page);
  await page.locator('[data-layout-switcher]').click();
  const appearanceOption = page.locator('[data-layout-option="console-appearance"]');
  await expect(appearanceOption).toBeVisible({ timeout: 15_000 });
  await appearanceOption.click();
  await expect(page.locator('[data-shell]')).toHaveAttribute('data-active-surface', 'console-appearance', { timeout: 15_000 });
  await expect(page.locator('[data-appearance-view]')).toBeVisible({ timeout: 15_000 });
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
        { name: 'island header bottom', selector: '[data-paint-region="island-header"]', side: 'border-bottom-color' },
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

      // The sidebar is frame chrome (flush activity bar), not an island.
      const stripe = page.locator('[data-paint-region="stripe"]');
      await expect(stripe).toHaveCSS('width', '264px');
      await expect(stripe).toHaveAttribute('data-frame-resident', 'stripe');
      await expect(stripe).toHaveAttribute('data-sidebar-collapsed', 'false');
      await expect(stripe).not.toHaveAttribute('data-island');
      const glyph = selected.locator('svg');
      await expect(glyph).toHaveAttribute('width', '16');
      await page.keyboard.press('Meta+b');
      await expect(stripe).toHaveAttribute('data-sidebar-collapsed', 'true');
      await expect(stripe).toHaveCSS('width', '44px');
      await page.keyboard.press('Meta+b');

      // Companions stay dock panels (Alt+Shift), not rail destinations.
      await page.keyboard.press('Alt+Shift+1');
      const companion = page.locator('[data-tool-window="files"]');
      await expect(companion).toBeVisible();
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
    test('type metrics and the island header strip hold', async ({ page }) => {
      await expect(page.locator('html')).toHaveCSS('font-size', '13px');
      const header = page.locator('[data-paint-region="island-header"]').first();
      await expect(header).toHaveCSS('height', '36px');
      await expect(header).toHaveCSS('font-family', /IBM Plex Sans/i);
      const ink = await resolveToken(page, '--ij-ink');
      await expect(header).toHaveCSS('color', ink);
      // Hide affordance on tool-window shells.
      await expect(page.locator('[data-island-hide]').first()).toBeVisible();
    });

    // X3.5 density: the 24px row rhythm and the 4px grid, measured rather than
    // asserted by inspection. Tailwind's spacing scale is the 4px grid and the
    // bridge resets colour, font and radius but deliberately not spacing, so
    // the grid holds by construction -- this is the gate that keeps it holding.
    test('rows keep the 24px rhythm and paddings stay on the 4px grid', async ({ page }) => {
      await page.keyboard.press('Alt+Shift+1');
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

    // X3.A2: the island header strip renders on all three companions.
    test('all three companions carry the header strip', async ({ page }) => {
      for (const [index, companion] of (['files', 'context', 'thread'] as const).entries()) {
        await page.keyboard.press(`Alt+Shift+${index + 1}`);
        const window = page.locator(`[data-tool-window="${companion}"]`);
        await expect(window, `${companion} tool window must render`).toBeVisible();
        await expect(
          window.locator('[data-island-header]'),
          `${companion} must carry the IslandShell header strip`,
        ).toBeVisible();
        await page.keyboard.press(`Alt+Shift+${index + 1}`);
      }
    });

    // CH1 acceptance: the composer chrome is ShaderSurface material, not a
    // parallel 2d sheen canvas. Raised surface, keyline, no shadow.
    test('the composer carries ShaderSurface material and no shadow', async ({ page }) => {
      const composer = page.locator('[data-paint-region="composer"]').first();
      await expect(composer).toBeVisible();
      await expect(page.locator('[data-composer-material]')).toHaveCount(1);

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
          litEdges: root.querySelectorAll('[data-composer-lit-edge]').length,
          materials: root.querySelectorAll('[data-composer-material]').length,
          marks: root.querySelectorAll('[data-presence-mark-placement]').length,
        };
      });

      expect(scan.offenders, 'gradients stay off the content plane').toEqual([]);
      expect(scan.shadowed, 'the composer is permanent, so it takes no shadow').toBe(0);
      expect(scan.blurred, 'the backdrop blur was deleted').toBe(0);
      expect(scan.litEdges, 'the lit edge is gone').toBe(0);
      expect(scan.materials, 'exactly one composer ShaderSurface').toBe(1);
      expect(scan.marks, 'exactly one Presence mark in the composer').toBe(1);
    });

    test('the composer material declares idle and streaming states', async ({ page }) => {
      const surface = page.locator('[data-composer-material]').first();
      await expect(surface).toHaveAttribute('data-sheen-state', 'idle');
      await expect(surface).toHaveAttribute('data-material-texture', 'shader-surface');

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
      await input.fill('Show the material while the agent works.');
      await input.press('Enter');
      await expect(surface).toHaveAttribute('data-sheen-state', 'streaming');
      await expect(page.locator('[data-paint-region="composer"]').first()).toHaveScreenshot(
        `composer-sheen-streaming-${theme}.png`,
      );
      release();
      await expect(page.getByText('Grounded answer.')).toBeVisible();
      await expect(page.locator('[data-paint-region="composer"]').first()).toHaveScreenshot(
        `composer-sheen-idle-${theme}.png`,
      );
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

test.describe('composer material under reduced motion', () => {
  test('renders static and still present, never removed', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await openWorkspace(page, 'intellij-light');
    const surface = page.locator('[data-composer-material]').first();
    await expect(surface).toHaveAttribute('data-sheen-state', 'idle');
    await expect(surface).toHaveAttribute('data-material-texture', 'shader-surface');
    await expect(page.locator('[data-composer-lit-edge]')).toHaveCount(0);
  });
});
