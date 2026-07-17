// SOURCING: @travis-gilbert/markdown-theory (WCAG contrast computation).
// The derived coloration engine preserves each shipped neutral's OKLCH
// lightness and re-anchors only chroma/hue. At chroma zero it returns the
// source hex bytes exactly, which makes the stock registers a fixed point.

import { inGamut, wcagContrast } from '@travis-gilbert/markdown-theory/tokens';

export type ResolvedThemeMode = 'dark' | 'light';

export interface ThemeKnobs {
  readonly tintHue: number;
  readonly tintChroma: number;
  readonly highlightHue: number;
}

export interface OklchColor {
  readonly l: number;
  readonly c: number;
  readonly h: number;
}

export interface ContrastCheck {
  readonly name: string;
  readonly ratio: number;
  readonly target: number;
  readonly pass: boolean;
}

export interface GeneratedTheme {
  readonly mode: ResolvedThemeMode;
  readonly knobs: ThemeKnobs;
  readonly variables: Readonly<Record<string, string>>;
  readonly checks: readonly ContrastCheck[];
  readonly clampNotes: readonly string[];
}

export const NAVY_KNOBS: ThemeKnobs = {
  tintHue: 250,
  tintChroma: 0.025,
  highlightHue: 20,
};

export const DARK_NEUTRALS = [
  '#1E1F22', '#2B2D30', '#393B40', '#43454A', '#4E5157', '#5A5D63', '#6F737A',
  '#868A91', '#9DA0A8', '#B4B8BF', '#CED0D6', '#DFE1E5', '#F0F1F2', '#FFFFFF',
] as const;

export const LIGHT_NEUTRALS = [
  '#000000', '#27282E', '#383A42', '#494B57', '#5A5D6B', '#6C707E', '#818594',
  '#A8ADBD', '#C9CCD6', '#D3D5DB', '#DFE1E5', '#EBECF0', '#F7F8FA', '#FFFFFF',
] as const;

export const GENERATED_THEME_VARIABLES = [
  ...Array.from({ length: 14 }, (_, index) => `--ij-gray-${index + 1}`),
  '--ij-frame',
  '--ij-gold',
  '--ij-selection',
  '--ij-selection-inactive',
  '--ij-editor-line',
  '--ij-search-match',
  '--ij-text-selection',
] as const;

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

function hue(value: number): number {
  const normalized = value % 360;
  return normalized < 0 ? normalized + 360 : normalized;
}

/** Published OKLab conversion matrices (Bjorn Ottosson). */
export function hexToOklch(hex: string): OklchColor {
  const value = hex.replace('#', '');
  const [r, g, b] = [0, 2, 4]
    .map((index) => Number.parseInt(value.slice(index, index + 2), 16) / 255)
    .map((channel) =>
      channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4,
    );
  const linearL = 0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b;
  const linearM = 0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b;
  const linearS = 0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b;
  const l3 = Math.cbrt(linearL);
  const m3 = Math.cbrt(linearM);
  const s3 = Math.cbrt(linearS);
  const lightness = 0.2104542553 * l3 + 0.793617785 * m3 - 0.0040720468 * s3;
  const axisA = 1.9779984951 * l3 - 2.428592205 * m3 + 0.4505937099 * s3;
  const axisB = 0.0259040371 * l3 + 0.7827717662 * m3 - 0.808675766 * s3;
  const chroma = Math.sqrt(axisA * axisA + axisB * axisB);
  return {
    l: lightness,
    c: chroma,
    h: hue((Math.atan2(axisB, axisA) * 180) / Math.PI),
  };
}

// Extract once when the module is evaluated. Knob changes reuse these fixed
// anchors rather than repeatedly converting the pinned hexadecimal ramps.
const LIGHTNESS_LADDERS: Readonly<Record<ResolvedThemeMode, readonly OklchColor[]>> = {
  dark: DARK_NEUTRALS.map(hexToOklch),
  light: LIGHT_NEUTRALS.map(hexToOklch),
};

const FRAME_ANCHORS: Readonly<Record<ResolvedThemeMode, OklchColor>> = {
  dark: hexToOklch('#131314'),
  light: hexToOklch('#EBECF0'),
};

function css(color: OklchColor): string {
  return `oklch(${(color.l * 100).toFixed(3)}% ${color.c.toFixed(4)} ${color.h.toFixed(2)})`;
}

function gamutColor(l: number, requestedChroma: number, requestedHue: number): OklchColor {
  let color: OklchColor = { l, c: requestedChroma, h: requestedHue };
  while (!inGamut(color) && color.c > 0.0001) {
    color = { ...color, c: color.c * 0.9 };
  }
  return color;
}

function solveBackground(
  foreground: OklchColor,
  seed: OklchColor,
  target: number,
  direction: 'lighter' | 'darker',
): { color: OklchColor; clamped: boolean } {
  let color = seed;
  if (wcagContrast(foreground, color) >= target) return { color, clamped: false };
  for (let step = 0; step < 80; step += 1) {
    const nextLightness = clamp(color.l + (direction === 'lighter' ? 0.01 : -0.01), 0, 1);
    color = gamutColor(nextLightness, color.c, color.h);
    if (wcagContrast(foreground, color) >= target) return { color, clamped: true };
  }
  return { color: { l: direction === 'lighter' ? 1 : 0, c: 0, h: color.h }, clamped: true };
}

function solveForeground(
  foreground: OklchColor,
  background: OklchColor,
  target: number,
  direction: 'lighter' | 'darker',
): { color: OklchColor; clamped: boolean } {
  if (wcagContrast(foreground, background) >= target) return { color: foreground, clamped: false };
  let color = foreground;
  for (let step = 0; step < 80; step += 1) {
    color = gamutColor(clamp(color.l + (direction === 'lighter' ? 0.01 : -0.01), 0, 1), color.c, color.h);
    if (wcagContrast(color, background) >= target) return { color, clamped: true };
  }
  return { color: { l: direction === 'lighter' ? 1 : 0, c: 0, h: color.h }, clamped: true };
}

function check(name: string, foreground: OklchColor, background: OklchColor, target: number): ContrastCheck {
  const ratio = wcagContrast(foreground, background);
  return { name, ratio, target, pass: ratio >= target };
}

export function generateTheme(mode: ResolvedThemeMode, input: ThemeKnobs): GeneratedTheme {
  const notes: string[] = [];
  const knobs: ThemeKnobs = {
    tintHue: hue(Number.isFinite(input.tintHue) ? input.tintHue : NAVY_KNOBS.tintHue),
    tintChroma: clamp(Number.isFinite(input.tintChroma) ? input.tintChroma : 0, 0, 0.04),
    highlightHue: hue(Number.isFinite(input.highlightHue) ? input.highlightHue : NAVY_KNOBS.highlightHue),
  };
  if (knobs.tintChroma !== input.tintChroma) notes.push('Background chroma was limited to the safe 0–0.04 range.');

  const stock = mode === 'dark' ? DARK_NEUTRALS : LIGHT_NEUTRALS;
  const anchors = LIGHTNESS_LADDERS[mode];
  const neutrals = stock.map((hex, index) => {
    const source = anchors[index];
    if (knobs.tintChroma === 0) return { source: hex, color: source };
    return { source: css(gamutColor(source.l, knobs.tintChroma, knobs.tintHue)), color: gamutColor(source.l, knobs.tintChroma, knobs.tintHue) };
  });
  const variables: Record<string, string> = Object.fromEntries(
    neutrals.map((entry, index) => [`--ij-gray-${index + 1}`, entry.source]),
  );

  const frameStock = FRAME_ANCHORS[mode];
  variables['--ij-frame'] = knobs.tintChroma === 0
    ? mode === 'dark' ? '#131314' : '#EBECF0'
    : css(gamutColor(frameStock.l, knobs.tintChroma, knobs.tintHue));

  const ink = neutrals[mode === 'dark' ? 11 : 1].color;
  const chrome = neutrals[mode === 'dark' ? 1 : 12].color;
  const info = neutrals[mode === 'dark' ? 7 : 5].color;
  const highlightSeed = gamutColor(mode === 'dark' ? 0.34 : 0.9, 0.08, knobs.highlightHue);
  const highlight = solveBackground(ink, highlightSeed, 4.5, mode === 'dark' ? 'darker' : 'lighter');
  if (highlight.clamped) notes.push('Highlight lightness was adjusted to keep selected text readable.');
  variables['--ij-selection'] = css(highlight.color);
  variables['--ij-text-selection'] = css(highlight.color);
  variables['--ij-selection-inactive'] = css(gamutColor(mode === 'dark' ? 0.32 : 0.91, 0.035, knobs.highlightHue));
  variables['--ij-editor-line'] = css(gamutColor(mode === 'dark' ? 0.27 : 0.965, 0.018, knobs.highlightHue));
  variables['--ij-search-match'] = css(gamutColor(mode === 'dark' ? 0.4 : 0.86, 0.07, knobs.highlightHue));

  const accent = hexToOklch(mode === 'dark' ? '#3574F0' : '#3574F0');
  const gold = solveForeground(
    hexToOklch(mode === 'dark' ? '#D6AE58' : '#A46704'),
    chrome,
    4.5,
    mode === 'dark' ? 'lighter' : 'darker',
  );
  variables['--ij-gold'] = css(gold.color);
  if (gold.clamped) notes.push('Learned-register gold was adjusted to preserve text contrast.');
  const checks = [
    check('ink on chrome', ink, chrome, 4.5),
    check('info on chrome', info, chrome, 3),
    check('ink on selection', ink, highlight.color, 4.5),
    check('accent on chrome', accent, chrome, 3),
    check('gold on chrome', gold.color, chrome, 4.5),
  ];
  if (checks.some((candidate) => !candidate.pass)) {
    notes.push('One or more generated pairs reached their safe contrast boundary.');
  }

  return { mode, knobs, variables, checks, clampNotes: notes };
}
