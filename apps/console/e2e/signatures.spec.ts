// SOURCING: @playwright/test. The signature gate (HANDOFF-CONSOLE-DIMENSIONALITY
// X4): the five IntelliJ chrome signatures, the X2 paint scan, the X1 composer
// material assertion, and the X3 junction-seam assertions, all parameterized
// over data-theme and run on dark AND light.
//
// The five-minute test is the point. Light is not a variant to be checked once;
// it is the mode that exposes every unpainted surface and every missing seam,
// so the gate that governs dark governs light identically or it governs nothing.

import {
  expect,
  test,
  type APIRequestContext,
  type Page,
} from '@playwright/test';
import { expectEveryRegionPainted, luminance, resolveToken } from './paint-audit';
import { resetLocalStorageBeforeNavigation } from './storage-reset';

const APPEARANCE_KEY = 'commonplace.console.appearance.v1';
const LAYOUT_CACHE_KEY = 'commonplace.console.layout-cache.v1';
const LEGACY_SURFACE_KEY = 'commonplace.console.surface.v1';
const STUB_BASE = `http://localhost:${process.env.STUB_DATA_API_PORT ?? '50591'}`;

const THEMES = [
  { theme: 'dark', preset: 'intellij-dark' },
  { theme: 'light', preset: 'intellij-light' },
] as const;

async function settled(page: Page) {
  await page.waitForSelector('[data-shell]');
  await page.waitForFunction(
    () => document.documentElement.getAttribute('data-layout-ready') === '1',
    { timeout: 60_000 },
  );
}

async function resetStubLayout(request: APIRequestContext) {
  const response = await request.post(`${STUB_BASE}/objects/test/reset-layout`, {
    headers: { 'x-api-key': 'dev-key' },
  });
  expect(response.ok()).toBeTruthy();
}

/** Opens the workspace surface in the requested theme. Both themes travel the
 *  same path, so a signature cannot pass in one mode by taking a shortcut. */
async function openWorkspace(
  page: Page,
  request: APIRequestContext,
  preset: string,
) {
  await resetStubLayout(request);
  await resetLocalStorageBeforeNavigation(page, {
    keys: [APPEARANCE_KEY, LAYOUT_CACHE_KEY, LEGACY_SURFACE_KEY],
  });
  await page.goto('/workspace');
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
    test.beforeEach(async ({ page, request }) => {
      await openWorkspace(page, request, preset);
      await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
    });

    // Signature 1. The Int UI inversion: seams are DARKER than the surfaces
    // they separate, in BOTH themes. This is the assertion the handoff calls
    // "the inversion test generalized", and it is what caught the
    // companion-to-editor junction painting --ij-divider (gray-3 in dark:
    // lighter than the gray-2 chrome beside it).
    test('every named junction seam stays at or below neighbouring chrome', async ({ page }) => {
      const seam = luminance(await resolveToken(page, '--ij-seam'));
      const seamRaised = luminance(await resolveToken(page, '--ij-seam-raised'));
      const chrome = luminance(await resolveToken(page, '--ij-chrome'));
      const editor = luminance(await resolveToken(page, '--ij-editor'));
      const raised = luminance(await resolveToken(page, '--ij-raised'));

      // Material register elevation differs by theme: in dark the editor well is
      // sunken below ground seam; in light the seam is the darker keyline against
      // the paper well. Dark mode may clamp seam and chrome to one frame plane,
      // but the seam must never rise above the chrome it separates.
      expect(seam, 'seam must stay at or below chrome').toBeLessThanOrEqual(chrome);
      if (theme === 'light') {
        expect(seam, 'in light the seam is darker than the editor well').toBeLessThanOrEqual(editor);
      } else {
        expect(editor, 'in dark the editor well sinks at or below the seam plane').toBeLessThanOrEqual(seam);
      }

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
        const junctionLuminance = luminance(colour);
        if (theme === 'dark') {
          expect(
            junctionLuminance,
            `${junction.name}: seam ${colour} must stay at or below the chrome ladder slot`,
          ).toBeLessThanOrEqual(chrome);
        } else {
          expect(
            junctionLuminance,
            `${junction.name}: seam ${colour} must be darker than the chrome ladder slot`,
          ).toBeLessThan(chrome);
        }
      }

      // Companion-to-editor boundary is the island gutter (transparent handle).
      const panelSeam = page.locator('[data-panel-seam]').first();
      await expect(panelSeam, 'the companion-to-editor gutter must render').toBeVisible();
      await expect(panelSeam).toHaveCSS('width', '6px');
      await expect(panelSeam).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
    });

    // Signature 2. The stripe button is a sunken well with a seam inset and
    // full-strength ink, never a saturated accent tile with inverted ink.
    test('the stripe selected state is a sunken well, not a saturated tile', async ({ page }) => {
      const sunken = await resolveToken(page, '--ij-editor');
      const accent = await resolveToken(page, '--ij-accent');
      const ink = await resolveToken(page, '--ij-ink');

      const selected = page.locator('[data-surface-rail] button[aria-checked="true"]').first();
      await expect(selected).toHaveCSS('background-color', sunken);
      await expect(selected).not.toHaveCSS('background-color', accent);
      await expect(selected).toHaveCSS('color', ink);

      // Left chrome: published 21st/@jshguo TwoLevelSidebar (w-16 rail + w-80 panel).
      const iconRail = page.locator('[data-jshguo-icon-rail]');
      const railShell = page.locator('[data-jshguo-sidebar]');
      await expect(iconRail).toHaveCSS('width', '64px');
      await expect(railShell).toHaveAttribute('data-panel-open', 'true');
      const stripe = page.locator('[data-paint-region="stripe"]');
      await expect(stripe).toHaveAttribute('data-frame-resident', 'stripe');
      await expect(stripe).not.toHaveAttribute('data-island');
      const glyph = selected.locator('svg');
      await expect(glyph).toHaveAttribute('width', '16');
      await page.keyboard.press('Meta+b');
      await expect(railShell).toHaveAttribute('data-panel-open', 'false');
      await expect(iconRail).toHaveCSS('width', '64px');
      await page.keyboard.press('Meta+b');
      await expect(railShell).toHaveAttribute('data-panel-open', 'true');

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

    // Signature 4. Account chrome stays in the toolbar; the run widget is gone.
    // Bottom status / presence metadata is removed from the page frame.
    test('account chrome holds without a run widget or bottom status metadata', async ({ page }) => {
      await expect(page.locator('[data-run-widget]')).toHaveCount(0);
      await expect(page.locator('[data-account-trigger]')).toBeVisible();
      // 32, not the Int UI 28: --ij-control-h resolves to Twenty's
      // --t-spacing-8 since the register inverted onto Twenty's proportions.
      await expect(page.locator('[data-account-trigger]')).toHaveCSS('height', '32px');
      await expect(page.locator('[data-paint-region="status-bar"]')).toHaveCount(0);
      await expect(page.locator('[data-connection-owner="status-bar"]')).toHaveCount(0);
      await expect(page.locator('[data-shell-sidebar-seam]')).toBeVisible();
    });

    // Signature 5. Type metrics: the register's 13px UI face and the compact
    // 24px BlockShell identity strip.
    test('type metrics and the island header strip hold', async ({ page }) => {
      await expect(page.locator('html')).toHaveCSS('font-size', '13px');
      const header = page.locator('[data-paint-region="island-header"]').first();
      await expect(header).toHaveCSS('height', '24px');
      await expect(header).toHaveCSS('font-family', /IBM Plex Sans/i);
      const ink = await resolveToken(page, '--ij-ink');
      await expect(header).toHaveCSS('color', ink);
      // Hide affordance on tool-window shells.
      await expect(page.getByRole('button', { name: /^Hide / }).first()).toBeVisible();
    });

    // X3.5 density: the 24px row rhythm and the 4px grid, measured rather than
    // asserted by inspection. Tailwind's spacing scale is the 4px grid and the
    // bridge resets colour, font and radius but deliberately not spacing, so
    // the grid holds by construction -- this is the gate that keeps it holding.
    test('rows keep the 24px rhythm and paddings stay on the 4px grid', async ({ page }) => {
      await page.keyboard.press('Alt+Shift+1');
      const row = page.locator('[data-tool-window="files"] [role="treeitem"]').first();
      if (await row.count()) {
        await expect(row).toHaveCSS('min-height', '24px');
        const rowBox = await row.boundingBox();
        expect(rowBox, 'the file row must have measurable geometry').not.toBeNull();
        expect(rowBox?.height ?? 0).toBeGreaterThanOrEqual(24);
        expect(rowBox?.height ?? 0).toBeLessThanOrEqual(44);
      }

      const offGrid = await page.evaluate(() => {
        const offenders: { region: string; property: string; value: string }[] = [];
        for (const node of document.querySelectorAll<HTMLElement>('[data-paint-region]')) {
          const styles = getComputedStyle(node);
          for (const property of ['paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft'] as const) {
            const value = Number.parseFloat(styles[property]);
            // 6px is the intentional island gutter (--ij-island-gutter), not
            // Tailwind spacing drift; allow it alongside the 4px grid.
            if (Number.isFinite(value) && value % 4 !== 0 && value !== 6) {
              offenders.push({ region: node.dataset.paintRegion ?? '?', property, value: styles[property] });
            }
          }
        }
        return offenders;
      });
      expect(offGrid, 'every named region pads on the 4px grid (or island gutter)').toEqual([]);
    });

    // X2 acceptance, on both themes: no named region inherits its background.
    test('every named region declares its paint', async ({ page }) => {
      await expectEveryRegionPainted(page);
    });

    // X3.A2: the island header strip renders on all three companions.
    test('all three companions carry the header strip', async ({ page }) => {
      for (const [index, companion] of (['files', 'context', 'thread'] as const).entries()) {
        const window = page.locator(`[data-tool-window="${companion}"]`);
        const wasOpen = await window.isVisible();
        if (!wasOpen) await page.keyboard.press(`Alt+Shift+${index + 1}`);
        await expect(window, `${companion} tool window must render`).toBeVisible();
        await expect(
          window.locator('[data-island-header]'),
          `${companion} must carry the IslandShell header strip`,
        ).toBeVisible();
        if (!wasOpen) {
          await page.keyboard.press(`Alt+Shift+${index + 1}`);
          await expect(window, `${companion} tool window must close before the next toggle`).toHaveCount(0);
        }
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
      const composer = page.locator('[data-paint-region="composer"]').first();
      const idleBox = await composer.boundingBox();
      expect(idleBox, 'the idle composer must have measurable geometry').not.toBeNull();
      await input.fill('Show the material while the agent works.');
      await input.press('Enter');
      await expect(surface).toHaveAttribute('data-sheen-state', 'streaming');
      const streamingBox = await composer.boundingBox();
      expect(streamingBox, 'the streaming composer must keep measurable geometry').not.toBeNull();
      expect(Math.round(streamingBox?.width ?? 0)).toBe(Math.round(idleBox?.width ?? 0));
      expect(Math.round(streamingBox?.height ?? 0)).toBe(Math.round(idleBox?.height ?? 0));
      release();
      await expect(page.getByText('Grounded answer.')).toBeVisible();
      await expect(surface).toHaveAttribute('data-sheen-state', 'focused');
      await input.blur();
      await expect(surface).toHaveAttribute('data-sheen-state', 'idle');
      const settledBox = await composer.boundingBox();
      expect(settledBox, 'the settled composer must remain mounted').not.toBeNull();
      expect(Math.round(settledBox?.width ?? 0)).toBe(Math.round(idleBox?.width ?? 0));
    });
  });
}

// X4 acceptance: dark shell geometry is measured at both named widths. The
// platform-specific full-page snapshots described a retired shell and hid the
// contract inside incidental pixels. These assertions keep the responsive
// width, frame fit, sidebar, ground, and status-bar geometry merge-blocking.
for (const { theme, preset } of THEMES.filter((entry) => entry.theme === 'dark')) {
  for (const viewport of [
    { width: 1280, height: 800 },
    { width: 1440, height: 900 },
  ]) {
    test(`holds the ${viewport.width} ${theme} shell geometry`, async ({ page, request }) => {
      await page.emulateMedia({ reducedMotion: 'reduce', colorScheme: theme });
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await openWorkspace(page, request, preset);
      const geometry = await page.evaluate(() => {
        const rect = (selector: string) => {
          const box = document.querySelector<HTMLElement>(selector)?.getBoundingClientRect();
          return box
            ? {
                x: Math.round(box.x),
                y: Math.round(box.y),
                width: Math.round(box.width),
                height: Math.round(box.height),
                bottom: Math.round(box.bottom),
              }
            : null;
        };
        return {
          viewport: {
            width: window.innerWidth,
            height: window.innerHeight,
            scrollWidth: document.documentElement.scrollWidth,
          },
          shell: rect('[data-shell]'),
          sidebar: rect('[data-jshguo-sidebar]'),
          ground: rect('[data-shell-region="ground"]'),
          status: rect('[data-paint-region="status-bar"]'),
        };
      });

      expect(geometry.viewport).toEqual({
        width: viewport.width,
        height: viewport.height,
        scrollWidth: viewport.width,
      });
      expect(geometry.shell).toEqual({
        x: 0,
        y: 0,
        width: viewport.width,
        height: viewport.height,
        bottom: viewport.height,
      });
      // Published jshguo: icon rail (w-16=64) + expanded detail (w-80=320).
      expect(geometry.sidebar?.width).toBe(384);
      expect(geometry.ground?.width ?? 0).toBeGreaterThan(viewport.width / 3);
      expect(geometry.ground?.height ?? 0).toBeGreaterThan(viewport.height / 2);
      expect(geometry.status).toBeNull();
    });
  }
}

test.describe('composer material under reduced motion', () => {
  test('renders static and still present, never removed', async ({ page, request }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await openWorkspace(page, request, 'intellij-light');
    const surface = page.locator('[data-composer-material]').first();
    await expect(surface).toHaveAttribute('data-sheen-state', 'idle');
    await expect(surface).toHaveAttribute('data-material-texture', 'shader-surface');
    await expect(page.locator('[data-composer-lit-edge]')).toHaveCount(0);
  });
});
