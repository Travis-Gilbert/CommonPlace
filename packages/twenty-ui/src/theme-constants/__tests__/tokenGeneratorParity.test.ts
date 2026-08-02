// SOURCING: none — pure logic, no upstream component applies. Replaces
// upstream's cornerShapeThemeParity test, which pinned a squircle invariant the
// CommonPlace register rules out (round, not squircle: the MaterialLayer SDF
// draws circular rounded rects and a squircle DOM clip over a circular shader
// corner is the doubled-corner halo).
//
// The TU2 oracle. Three claims, each of which would otherwise only be checked
// by eye:
//
//   1. Every variable a component can read is emitted, in both modes. The
//      accessor map (themeCssVariables.ts) is upstream's contract; a name there
//      with no declaration in the generated CSS is a component that renders
//      unstyled.
//   2. No upstream color value survives. Semantic slots must be register
//      references; the palette namespace must be OKLCH from the CommonPlace
//      model. A display-p3 literal or a bare hex is a leak.
//   3. THEME_COMMON is preserved field for field. Twenty's proportions are what
//      the records surface and the model canvas were built to inherit.

import * as fs from 'node:fs';
import * as path from 'node:path';

import { BORDER_COMMON } from '@ui/theme/constants/BorderCommon';
import { THEME_COMMON } from '@ui/theme/constants/ThemeCommon';
import { themeCssVariables } from '../themeCssVariables';

const THEME_CONSTANTS_DIR = path.resolve(__dirname, '..');
const MODES = ['dark', 'light'] as const;

const readThemeCss = (mode: (typeof MODES)[number]) =>
  fs.readFileSync(path.join(THEME_CONSTANTS_DIR, `theme-${mode}.css`), 'utf-8');

/** Every `--t-NAME` the accessor map exposes to components. */
function accessorVariableNames(): string[] {
  const names: string[] = [];
  const walk = (node: unknown) => {
    if (typeof node === 'string') {
      const match = node.match(/^var\((--t-[a-z0-9-_]+)\)$/);
      if (match !== null) names.push(match[1]);
      return;
    }
    if (typeof node === 'object' && node !== null) {
      for (const child of Object.values(node)) walk(child);
    }
  };
  walk(themeCssVariables);
  return names;
}

/** Every `--t-NAME` the generated CSS declares. */
function declaredVariableNames(css: string): Set<string> {
  return new Set(
    [...css.matchAll(/^\s+(--t-[a-z0-9-_]+):/gm)].map((match) => match[1]),
  );
}

describe.each(MODES)('generated theme-%s.css', (mode) => {
  const css = readThemeCss(mode);
  const declared = declaredVariableNames(css);

  it('declares every variable the accessor map exposes', () => {
    const missing = accessorVariableNames().filter((name) => !declared.has(name));
    expect(missing).toEqual([]);
  });

  it('carries no upstream display-p3 color value', () => {
    expect(css).not.toContain('display-p3');
  });

  it('carries no bare hex color', () => {
    // Semantic slots are var(--ij-*) references; the palette is oklch().
    // A hex literal means a value was snapshotted instead of referenced.
    expect(css.match(/#[0-9a-fA-F]{3,8}\b/g)).toBeNull();
  });

  it('resolves the semantic slots to the CommonPlace register', () => {
    for (const [variable, expected] of [
      ['--t-font-color-primary', 'var(--ij-ink)'],
      ['--t-font-color-secondary', 'var(--ij-ink-info)'],
      ['--t-accent-primary', 'var(--ij-accent)'],
      ['--t-background-primary', 'var(--ij-editor)'],
      ['--t-background-secondary', 'var(--ij-chrome)'],
      ['--t-border-color-light', 'var(--ij-seam)'],
      ['--t-border-color-strong', 'var(--ij-control-border)'],
      ['--t-font-family', 'var(--ij-font-ui)'],
      ['--t-code-font-family', 'var(--ij-font-mono)'],
      ['--t-font-color-on-accent', 'var(--ij-ink-bright)'],
    ] as const) {
      expect(css).toContain(`${variable}: ${expected};`);
    }
  });

  it('routes the record proportions through the --rec- structural group', () => {
    for (const [variable, expected] of [
      ['--t-table-horizontal-cell-padding', 'var(--rec-cell-pad)'],
      ['--t-table-checkbox-column-width', 'var(--rec-utility-col)'],
      ['--t-side-panel-width', 'var(--rec-side-panel)'],
      ['--t-between-siblings-gap', 'var(--rec-sibling-gap)'],
      [
        '--t-clickable-element-background-transition',
        'var(--rec-clickable-transition)',
      ],
    ] as const) {
      expect(css).toContain(`${variable}: ${expected};`);
    }
  });

  it('applies the radius law and rules out squircle corners', () => {
    expect(css).toContain('--t-corner-shape: round;');
    expect(css).not.toContain('corner-shape: squircle');
    expect(css).not.toContain('@supports (corner-shape: squircle)');
    // Radii floor at the chip radius: below roughly three device pixels of arc,
    // a corner antialiases into a chipped square.
    expect(css).toContain('--t-border-radius-xs: var(--radius-chip, 4px);');
    expect(css).toContain('--t-border-radius-md: var(--radius-control, 7px);');
  });

  it('scopes itself to the console register as well as the bare class', () => {
    const selector =
      mode === 'dark'
        ? '[data-register="intui"]'
        : '[data-register="intui"][data-theme="light"]';
    expect(css).toContain(selector);
  });

  it('derives the palette namespace in OKLCH under the chroma clamp', () => {
    const chromas = [...css.matchAll(/oklch\([\d.]+% ([\d.]+) [\d.]+\)/g)].map(
      (match) => Number(match[1]),
    );
    expect(chromas.length).toBeGreaterThan(0);
    // ACCENT_CHROMA_BAND.max from the console's two-knob engine.
    expect(Math.max(...chromas)).toBeLessThanOrEqual(0.12);
  });
});

describe('THEME_COMMON', () => {
  // Pinned from twentyhq/twenty at b754e15331c6472d772b1bbe448469f811b28afd,
  // packages/twenty-ui/src/theme/constants/ThemeCommon.ts. Twenty's proportions
  // are the layer the fork exists to inherit; they do not move.
  it('keeps upstream field names', () => {
    expect(Object.keys(THEME_COMMON).sort()).toEqual(
      [
        'animation',
        'betweenSiblingsGap',
        'buttons',
        'clickableElementBackgroundTransition',
        'icon',
        'lastLayerZIndex',
        'modal',
        'sidePanelWidth',
        'spacing',
        'spacingMultiplicator',
        'table',
        'text',
      ].sort(),
    );
  });

  it('keeps upstream proportion values', () => {
    expect(THEME_COMMON.spacingMultiplicator).toBe(4);
    expect(THEME_COMMON.spacing(1)).toBe('4px');
    expect(THEME_COMMON.spacing(2, 3)).toBe('8px 12px');
    expect(THEME_COMMON.lastLayerZIndex).toBe(2147483647);
    expect(THEME_COMMON.animation.duration).toEqual({
      instant: 0.075,
      fast: 0.15,
      normal: 0.3,
      slow: 1.5,
    });
    expect(THEME_COMMON.icon.size).toEqual({ sm: 14, md: 16, lg: 20, xl: 24 });
    expect(THEME_COMMON.modal.size.xl).toEqual({
      width: '1200px',
      height: '800px',
    });
  });

  it('points the record metrics at the --rec- group they were extracted to', () => {
    // 8px cell padding, 32px utility column, 500px side panel, 2px sibling gap,
    // the 0.1s background transition. Same numbers, one source.
    expect(THEME_COMMON.table.horizontalCellPadding).toBe('var(--rec-cell-pad)');
    expect(THEME_COMMON.table.checkboxColumnWidth).toBe('var(--rec-utility-col)');
    expect(THEME_COMMON.sidePanelWidth).toBe('var(--rec-side-panel)');
    expect(THEME_COMMON.betweenSiblingsGap).toBe('var(--rec-sibling-gap)');
    expect(THEME_COMMON.clickableElementBackgroundTransition).toBe(
      'var(--rec-clickable-transition)',
    );
  });
});

describe('BORDER_COMMON', () => {
  it('carries the console radius law, not upstream millimetres', () => {
    expect(BORDER_COMMON.radius.xs).toBe('var(--radius-chip, 4px)');
    expect(BORDER_COMMON.radius.md).toBe('var(--radius-control, 7px)');
    expect(BORDER_COMMON.radius.lg).toBe('var(--radius-sunken, 10px)');
    expect(BORDER_COMMON.radius.pill).toBe('999px');
  });
});
