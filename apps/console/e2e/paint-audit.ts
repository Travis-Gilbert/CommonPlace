// SOURCING: @playwright/test. The paint audit (HANDOFF-CONSOLE-DIMENSIONALITY
// X2), shared by the signature gate so it runs identically on both themes.
//
// The second drift mechanism the handoff names is paint by omission: the
// register lint forbids wrong colors but never required right ones, so a region
// that painted nothing inherited white and passed. Dark mode hid this because
// unpainted regions inherited dark. Light is the X-ray.
//
// Every named shell region therefore declares data-paint-region, and this scan
// asserts the region's computed background actually resolves to the register
// token it is supposed to carry -- never transparent, never the page default.

import { expect, type Page } from '@playwright/test';

/** The named-region map. Each region root must paint this token, explicitly. */
export const REGION_PAINT: Record<string, string> = {
  toolbar: '--ij-chrome',
  stripe: '--ij-chrome',
  'tool-window': '--ij-chrome',
  'tool-window-header': '--ij-chrome',
  'tab-strip': '--ij-chrome',
  'editor-well': '--ij-editor',
  'status-bar': '--ij-chrome',
  composer: '--ij-raised',
};

/** Regions that must EXIST on the workspace surface. A region cannot pass the
 *  audit by not rendering; that is the void the empty-state work is about. */
export const REQUIRED_REGIONS = [
  'toolbar',
  'stripe',
  'tool-window',
  'tool-window-header',
  'editor-well',
  'status-bar',
];

export interface PaintFinding {
  readonly region: string;
  readonly index: number;
  readonly actual: string;
  readonly expected: string;
  readonly token: string;
  readonly reason: 'transparent' | 'mismatch';
}

/** Runs the scan in the page and returns every region that fails it. */
export async function auditPaint(page: Page): Promise<{
  findings: PaintFinding[];
  seen: string[];
}> {
  return page.evaluate((paintMap) => {
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
  }, REGION_PAINT) as Promise<{ findings: PaintFinding[]; seen: string[] }>;
}

/** The assertion form, plus the self-test that proves the scan actually fires.
 *  A gate that cannot fail is decoration; the probe injects an unpainted region
 *  and requires the scan to catch it before trusting a clean result. */
export async function expectEveryRegionPainted(page: Page): Promise<void> {
  // Hostile probe: attach a region that paints nothing, run the REAL scan, and
  // require it to be reported. Checking only that the probe reads transparent
  // would test the browser, not the gate.
  await page.evaluate(() => {
    const probe = document.createElement('div');
    probe.dataset.paintRegion = 'toolbar';
    probe.id = '__paint-probe';
    probe.style.background = 'transparent';
    document.body.append(probe);
  });
  const probed = await auditPaint(page);
  await page.evaluate(() => document.getElementById('__paint-probe')?.remove());
  expect(
    probed.findings.some((finding) => finding.reason === 'transparent'),
    'the unpainted-region probe was NOT caught; the paint scan is inert',
  ).toBe(true);

  const { findings, seen } = await auditPaint(page);
  expect(
    findings,
    `regions inheriting paint instead of declaring it: ${JSON.stringify(findings, null, 2)}`,
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
