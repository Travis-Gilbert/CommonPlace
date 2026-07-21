// SOURCING: @playwright/test. The paint audit (HANDOFF-CONSOLE-DIMENSIONALITY
// X2), amended by Spec 35 Material Review for the islands Material Layer.
//
// Two paint contracts now coexist:
// 1. Shell islands and frame-resident chrome: the Material Layer paints them.
//    DOM backgrounds must be transparent (inverted lint for those regions).
// 2. Content instruments (composer, Index panes, receipts): still declare an
//    explicit register background, never inherit white.

import { expect, type Page } from '@playwright/test';

/** Regions whose fill is owned by the WebGL Material Layer. Transparent CSS. */
export const SHADER_REGIONS = new Set([
  'toolbar',
  'stripe',
  'tool-window',
  'island-shell',
  'island-header',
  'island-footer',
  'tab-strip',
  'editor-well',
  'status-bar',
]);

/** Content regions that still must paint an explicit register token. */
export const REGION_PAINT: Record<string, string> = {
  composer: '--ij-raised',
  'filing-index': '--ij-editor',
  'filing-rules': '--ij-editor',
  'filing-urgent': '--ij-editor',
  'filing-receipt': '--ij-raised',
};

/** Regions that must EXIST on the workspace surface. */
export const REQUIRED_REGIONS = [
  'toolbar',
  'stripe',
  'tool-window',
  'island-header',
  'editor-well',
  'status-bar',
];

export interface PaintFinding {
  readonly region: string;
  readonly index: number;
  readonly actual: string;
  readonly expected: string;
  readonly token: string;
  readonly reason: 'transparent' | 'mismatch' | 'painted';
}

/** Runs the scan in the page and returns every region that fails it. */
export async function auditPaint(page: Page): Promise<{
  findings: PaintFinding[];
  seen: string[];
}> {
  return page.evaluate(
    ({ paintMap, shaderRegions }) => {
      const resolve = (token: string) => {
        const probe = document.createElement('div');
        probe.style.backgroundColor = `var(${token})`;
        document.body.append(probe);
        const value = getComputedStyle(probe).backgroundColor;
        probe.remove();
        return value;
      };

      const TRANSPARENT = new Set(['rgba(0, 0, 0, 0)', 'transparent']);
      const findings: PaintFinding[] = [];
      const seen = new Set<string>();

      for (const region of shaderRegions) {
        const nodes = [...document.querySelectorAll<HTMLElement>(`[data-paint-region="${region}"]`)];
        nodes.forEach((node, index) => {
          seen.add(region);
          const actual = getComputedStyle(node).backgroundColor;
          if (!TRANSPARENT.has(actual)) {
            findings.push({
              region,
              index,
              actual,
              expected: 'transparent',
              token: 'material-layer',
              reason: 'painted' as const,
            });
          }
        });
      }

      for (const [region, token] of Object.entries(paintMap)) {
        const expected = resolve(token);
        const nodes = [...document.querySelectorAll<HTMLElement>(`[data-paint-region="${region}"]`)];
        nodes.forEach((node, index) => {
          seen.add(region);
          const actual = getComputedStyle(node).backgroundColor;
          if (TRANSPARENT.has(actual)) {
            findings.push({ region, index, actual, expected, token, reason: 'transparent' as const });
            return;
          }
          if (actual !== expected) {
            findings.push({ region, index, actual, expected, token, reason: 'mismatch' as const });
          }
        });
      }

      return { findings, seen: [...seen] };
    },
    { paintMap: REGION_PAINT, shaderRegions: [...SHADER_REGIONS] },
  ) as Promise<{ findings: PaintFinding[]; seen: string[] }>;
}

/** Assert shell regions are shader-transparent and content regions stay painted.
 *  Self-test: inject a painted shell probe and require the scan to catch it. */
export async function expectEveryRegionPainted(page: Page): Promise<void> {
  await page.evaluate(() => {
    const probe = document.createElement('div');
    probe.dataset.paintRegion = 'toolbar';
    probe.id = '__paint-probe';
    probe.style.background = 'var(--ij-chrome)';
    document.body.append(probe);
  });
  const probed = await auditPaint(page);
  await page.evaluate(() => document.getElementById('__paint-probe')?.remove());
  expect(
    probed.findings.some((finding) => finding.reason === 'painted'),
    'the painted-shell-region probe was NOT caught; the paint scan is inert',
  ).toBe(true);

  const { findings, seen } = await auditPaint(page);
  expect(
    findings,
    `paint contract failures: ${JSON.stringify(findings, null, 2)}`,
  ).toEqual([]);
  for (const region of REQUIRED_REGIONS) {
    expect(seen, `named region "${region}" did not render at all`).toContain(region);
  }
}

/** sRGB relative luminance, for the seam assertions. */
export function luminance(rgb: string): number {
  const parts = rgb.match(/\d+(\.\d+)?/g);
  if (!parts) return Number.NaN;
  const [r, g, b] = parts.slice(0, 3).map((value) => {
    const channel = Number(value) / 255;
    return channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Resolves a register token to its computed rgb in the live page. */
export async function resolveToken(page: Page, token: string): Promise<string> {
  return page.evaluate((name) => {
    const probe = document.createElement('div');
    probe.style.backgroundColor = `var(${name})`;
    document.body.append(probe);
    const value = getComputedStyle(probe).backgroundColor;
    probe.remove();
    return value;
  }, token);
}
