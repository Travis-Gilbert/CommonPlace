import { describe, expect, it } from 'vitest';
import { DEFAULT_PAPER_ANCHOR, ink, paper } from './coloration';
import {
  DARK_NEUTRALS,
  LIGHT_NEUTRALS,
  PAPER_KNOBS,
  generateTheme,
  hexToOklch,
  measureCanvasChroma,
  measureInkChroma,
} from './theme-engine';

function lightness(value: string): number {
  if (value.startsWith('#')) return hexToOklch(value).l;
  const match = value.match(/^oklch\(([0-9.]+)%/);
  if (!match) throw new Error(`unsupported generated color: ${value}`);
  return Number(match[1]) / 100;
}

function chroma(value: string): number {
  if (value.startsWith('#')) return hexToOklch(value).c;
  const match = value.match(/^oklch\([0-9.]+%\s+([0-9.]+)/);
  if (!match) throw new Error(`unsupported generated color: ${value}`);
  return Number(match[1]);
}

function hueOf(value: string): number {
  if (value.startsWith('#')) return hexToOklch(value).h;
  const match = value.match(/^oklch\([0-9.]+%\s+[0-9.]+\s+([0-9.]+)/);
  if (!match) throw new Error(`unsupported generated color: ${value}`);
  return Number(match[1]);
}

describe('paper and ink ladders (CS1)', () => {
  it('keeps canvas chroma at or below 0.008 at paper anchor 62', () => {
    expect(measureCanvasChroma('light', DEFAULT_PAPER_ANCHOR)).toBeLessThanOrEqual(0.008);
    const theme = generateTheme('light', PAPER_KNOBS);
    expect(chroma(theme.variables['--paper-canvas'])).toBeLessThanOrEqual(0.008);
  });

  it('keeps ink chroma at or below 0.014 on the complement hue', () => {
    expect(measureInkChroma('light', DEFAULT_PAPER_ANCHOR)).toBeLessThanOrEqual(0.014);
    const theme = generateTheme('light', PAPER_KNOBS);
    expect(chroma(theme.variables['--ink-primary'])).toBeLessThanOrEqual(0.014);
    const inkHue = hueOf(theme.variables['--ink-primary']);
    const paperHue = hueOf(theme.variables['--paper-canvas']);
    // Ink is complement of the paper *anchor*, not the torsioned canvas hue.
    // Distance from 180 degrees on the circle should be near zero vs the anchor.
    const vsAnchor = Math.abs((((inkHue - DEFAULT_PAPER_ANCHOR) % 360) + 360) % 360 - 180);
    expect(vsAnchor).toBeLessThan(5);
    // Canvas torsion keeps warm identity near the anchor.
    expect(Math.abs(paperHue - DEFAULT_PAPER_ANCHOR)).toBeLessThan(10);
  });

  it('never green-drifts paper across a hue sweep from 40 to 90', () => {
    for (let anchor = 40; anchor <= 90; anchor += 5) {
      const canvas = paper(0, 'light', anchor);
      // Yellow-green drift sits near 100 to 140 at high L; warm paper stays below ~85.
      expect(canvas.h).toBeLessThan(95);
      expect(canvas.c).toBeLessThanOrEqual(0.008);
    }
  });

  it('names clamp adjustments when contrast requires them', () => {
    const theme = generateTheme('light', {
      ...PAPER_KNOBS,
      tintHue: 62,
      tintChroma: 0.008,
      inkChromaClamp: 0.014,
    });
    expect(theme.clampNotes.length).toBeGreaterThan(0);
    expect(theme.checks.every((check) => check.pass)).toBe(true);
  });

  it('mirrors dark lightness while keeping hue anchors', () => {
    const lightInk = ink(0, 'light', 62);
    const darkInk = ink(0, 'dark', 62);
    expect(Math.abs(lightInk.h - darkInk.h)).toBeLessThan(0.01);
    expect(darkInk.l).toBeGreaterThan(0.5);
  });
});

describe('generated console coloration', () => {
  it.each([
    ['dark', DARK_NEUTRALS],
    ['light', LIGHT_NEUTRALS],
  ] as const)('returns the stock %s ramp byte-for-byte at zero chroma', (mode, ramp) => {
    const theme = generateTheme(mode, { ...PAPER_KNOBS, tintChroma: 0 });
    expect(ramp.map((_, index) => theme.variables[`--ij-gray-${index + 1}`])).toEqual(ramp);
  });

  it.each(['dark', 'light'] as const)('keeps the seam darker than adjacent %s surfaces', (mode) => {
    const theme = generateTheme(mode, PAPER_KNOBS);
    const seam = lightness(theme.variables['--paper-seam']);
    const canvas = lightness(theme.variables['--paper-canvas']);
    const sunken = lightness(theme.variables['--paper-sunken']);
    if (mode === 'light') {
      expect(seam).toBeLessThan(canvas);
      expect(seam).toBeLessThan(sunken);
    } else {
      expect(seam).toBeLessThan(canvas);
      expect(seam).toBeLessThan(sunken);
    }
    expect(theme.checks.every((check) => check.pass)).toBe(true);
  });

  it.each([
    { tintHue: -900, tintChroma: 1, highlightHue: 900, inkChromaClamp: 1 },
    { tintHue: Number.NaN, tintChroma: -1, highlightHue: Number.NaN, inkChromaClamp: -1 },
    { tintHue: 84, tintChroma: 0.04, highlightHue: 84, inkChromaClamp: 0.014 },
  ])('clamps adversarial input and still emits readable pairs', (knobs) => {
    const theme = generateTheme('dark', knobs);
    expect(theme.knobs.tintChroma).toBeGreaterThanOrEqual(0);
    expect(theme.knobs.tintChroma).toBeLessThanOrEqual(0.04);
    expect(theme.knobs.inkChromaClamp).toBeLessThanOrEqual(0.014);
    expect(theme.checks.every((check) => check.pass)).toBe(true);
  });
});
