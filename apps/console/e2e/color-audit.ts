// SOURCING: @playwright/test. The colored-words scan
// (32-HANDOFF-PROACTIVITY-MATERIAL-AND-DENSITY Q6), in the shape paint-audit.ts
// established: resolve what the register says, scan what the page computed, and
// prove the scan can fail before trusting a clean result.
//
// Cause 4 in the handoff is that the speaker registers shipped as colored
// metadata text instead of structural elements. The mechanism it names is
// specific and worth stating, because it is the thing this file makes
// impossible to reintroduce: semantic color in small type on a light ground
// vibrates, reads cheap, and collides with link blue. Color belongs in shapes,
// which have their own ground to sit on.
//
// So the rule is mechanical: below the 13px body size, the only colors allowed
// are the neutral inks. A hue that small must be inside a badge, a tile, a
// meter, or a rail.

import { expect, type Page } from '@playwright/test';

/** The inks a small run of text may wear. Everything else is semantic. */
export const NEUTRAL_INKS = ['--ij-ink', '--ij-ink-info', '--ij-ink-disabled', '--ij-ink-bright'];

/** Shapes that MAY carry a hue at any size, because each one is a shape with
 *  its own ground rather than type on the page. */
export const COLOR_BEARING_SHAPES = ['[data-state-badge]', '[data-kind-tile]', '[data-author-rail]', '[data-slot="commit-ref"]', '[data-slot="commit-tag"]'];

export interface ColorFinding {
  readonly text: string;
  readonly size: number;
  readonly color: string;
  readonly tag: string;
}

/** Runs the scan in the page and returns every small run of text wearing a
 *  non-neutral color outside a color-bearing shape. */
export async function auditColoredWords(
  page: Page,
  root: string,
): Promise<{ findings: ColorFinding[]; scanned: number }> {
  return page.evaluate(
    ([neutrals, shapes, rootSelector]) => {
      const host = document.querySelector(rootSelector);
      if (!host) return { findings: [], scanned: 0 };

      const resolve = (tokenName: string) => {
        const probe = document.createElement('div');
        probe.style.color = `var(${tokenName})`;
        document.body.append(probe);
        const value = getComputedStyle(probe).color;
        probe.remove();
        return value;
      };
      const allowed = new Set(neutrals.map(resolve));
      // Fully transparent text is not a color claim.
      allowed.add('rgba(0, 0, 0, 0)');

      const findings: ColorFinding[] = [];
      let scanned = 0;

      for (const node of host.querySelectorAll<HTMLElement>('*')) {
        // Only elements that own a text run: an ancestor's color is the child's
        // problem, not its own.
        const ownText = [...node.childNodes]
          .filter((child) => child.nodeType === Node.TEXT_NODE)
          .map((child) => child.textContent ?? '')
          .join('')
          .trim();
        if (ownText.length === 0) continue;
        if (shapes.some((shape) => node.closest(shape))) continue;

        const style = getComputedStyle(node);
        const size = Number.parseFloat(style.fontSize);
        if (!Number.isFinite(size) || size >= 13) continue;
        scanned += 1;
        if (!allowed.has(style.color)) {
          findings.push({ text: ownText.slice(0, 40), size, color: style.color, tag: node.tagName.toLowerCase() });
        }
      }

      return { findings, scanned };
    },
    [NEUTRAL_INKS, COLOR_BEARING_SHAPES, root] as const,
  ) as Promise<{ findings: ColorFinding[]; scanned: number }>;
}

/** The assertion, plus the self-test that proves the scan can fire. */
export async function expectNoColoredWords(page: Page, root: string): Promise<void> {
  await page.evaluate((rootSelector) => {
    const host = document.querySelector(rootSelector);
    if (!host) return;
    const probe = document.createElement('span');
    probe.id = '__color-probe';
    // Exactly the defect: a semantic hue on a sub-13px run of text, outside any
    // shape. This is what "teal agent at 11px" was.
    probe.style.fontSize = '11px';
    probe.style.color = 'var(--ij-warn)';
    probe.textContent = 'probe';
    host.append(probe);
  }, root);
  const probed = await auditColoredWords(page, root);
  await page.evaluate(() => document.getElementById('__color-probe')?.remove());
  expect(
    probed.findings.some((finding) => finding.text === 'probe'),
    'the colored-word probe was NOT caught; the color scan is inert',
  ).toBe(true);

  const { findings, scanned } = await auditColoredWords(page, root);
  expect(
    findings,
    `semantic color on text below 13px, outside a badge/tile/meter/rail: ${JSON.stringify(findings, null, 2)}`,
  ).toEqual([]);
  expect(scanned, 'too few small text runs scanned to be the real surface').toBeGreaterThan(10);
}

/**
 * The grayscale authorship assertion (Q3). Color is an enhancement, never the
 * only carrier: with hue removed entirely, authorship must still read. It does,
 * because it is carried twice and neither carrier is a color — the tile's rail
 * (a position and a shape) and the title's face (a typeface).
 */
export async function expectAuthorshipSurvivesGrayscale(page: Page, root: string): Promise<void> {
  await page.evaluate((rootSelector) => {
    const host = document.querySelector<HTMLElement>(rootSelector);
    if (host) host.style.filter = 'grayscale(1)';
  }, root);

  const result = await page.evaluate((rootSelector) => {
    const host = document.querySelector(rootSelector);
    if (!host) return { rails: 0, tiles: 0, faces: [] as string[] };
    const rails = host.querySelectorAll('[data-author-rail]').length;
    const tiles = host.querySelectorAll('[data-kind-tile]').length;
    const faces = [...host.querySelectorAll<HTMLElement>('[data-type-role="title"][data-type-speaker]')].map(
      (node) => `${node.dataset.typeSpeaker}:${getComputedStyle(node).fontFamily}`,
    );
    return { rails, tiles, faces };
  }, root);

  expect(result.tiles, 'no kind tiles rendered; the leading anchor is missing').toBeGreaterThan(0);
  expect(result.rails, 'no author rails rendered; authorship has only one carrier').toBeGreaterThan(0);

  // Both speakers present, and wearing different faces: that difference is what
  // survives when the hue is gone.
  const human = new Set(result.faces.filter((f) => f.startsWith('human:')).map((f) => f.split(':')[1]));
  const agent = new Set(result.faces.filter((f) => f.startsWith('agent:')).map((f) => f.split(':')[1]));
  expect(human.size, 'no human-authored title on the surface to distinguish').toBeGreaterThan(0);
  expect(agent.size, 'no agent-authored title on the surface to distinguish').toBeGreaterThan(0);
  for (const face of human) {
    expect(agent.has(face), `the human and agent titles share the face ${face}; authorship dies in grayscale`).toBe(false);
  }
}
