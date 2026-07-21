import { describe, expect, it } from 'vitest';
import { wcagContrast } from '@travis-gilbert/markdown-theory/tokens';
import { DARK_NEUTRALS, LIGHT_NEUTRALS, NAVY_KNOBS, generateTheme, hexToOklch } from './theme-engine';

function lightness(value: string): number {
  if (value.startsWith('#')) return hexToOklch(value).l;
  const match = value.match(/^oklch\(([0-9.]+)%/);
  if (!match) throw new Error(`unsupported generated color: ${value}`);
  return Number(match[1]) / 100;
}

describe('generated console coloration', () => {
  it.each([
    ['dark', DARK_NEUTRALS],
    ['light', LIGHT_NEUTRALS],
  ] as const)('returns the stock %s ramp byte-for-byte at zero chroma', (mode, ramp) => {
    const theme = generateTheme(mode, { ...NAVY_KNOBS, tintChroma: 0 });
    expect(ramp.map((_, index) => theme.variables[`--ij-gray-${index + 1}`])).toEqual(ramp);
  });

  it.each(['dark', 'light'] as const)('keeps the seam darker than adjacent %s surfaces', (mode) => {
    const theme = generateTheme(mode, NAVY_KNOBS);
    const ramp = Array.from({ length: 14 }, (_, index) => lightness(theme.variables[`--ij-gray-${index + 1}`]));
    const seam = ramp[mode === 'dark' ? 0 : 11];
    const chrome = ramp[mode === 'dark' ? 1 : 12];
    expect(seam).toBeLessThan(chrome);
    expect(ramp.every((value, index) => index === 0 || value >= ramp[index - 1])).toBe(true);
    expect(theme.checks.every((check) => check.pass)).toBe(true);
  });

  it.each([
    { tintHue: -900, tintChroma: 1, highlightHue: 900 },
    { tintHue: Number.NaN, tintChroma: -1, highlightHue: Number.NaN },
    { tintHue: 84, tintChroma: 0.04, highlightHue: 84 },
  ])('clamps adversarial input and still emits readable pairs', (knobs) => {
    const theme = generateTheme('dark', knobs);
    expect(theme.knobs.tintChroma).toBeGreaterThanOrEqual(0);
    expect(theme.knobs.tintChroma).toBeLessThanOrEqual(0.03);
    expect(theme.checks.every((check) => check.pass)).toBe(true);
  });

  it('fails an out-of-envelope island-to-frame pair in a deliberate probe', () => {
    const theme = generateTheme('dark', { ...NAVY_KNOBS, tintChroma: 0 });
    const frame = hexToOklch(theme.variables['--ij-frame'] ?? DARK_NEUTRALS[2]);
    const chrome = hexToOklch(DARK_NEUTRALS[1]);
    const editor = hexToOklch(DARK_NEUTRALS[0]);
    expect(theme.checks.find((check) => check.name === 'chrome island on frame')?.pass).toBe(true);
    expect(theme.checks.find((check) => check.name === 'editor island on frame')?.pass).toBe(true);
    // Deliberate failure probe: same color cannot meet the 1.20 floor.
    const same = checkProbe(chrome, chrome, 1.2);
    expect(same.pass).toBe(false);
    expect(frame.l).toBeGreaterThan(chrome.l);
    expect(frame.l).toBeGreaterThan(editor.l);
  });
});

function checkProbe(
  foreground: ReturnType<typeof hexToOklch>,
  background: ReturnType<typeof hexToOklch>,
  target: number,
) {
  const ratio = wcagContrast(foreground, background);
  return { ratio, target, pass: ratio >= target };
}