import { describe, expect, it } from 'vitest';

import { oklchCssToSrgb } from './oklch-read';

/* The Playwright oracles cannot run from the offline store, so the parsing and
   scaling that HP3 leans on is pinned here in vitest. The underlying OKLCH to
   sRGB math belongs to @travis-gilbert/markdown-theory (the register source);
   these tests cover the CSS-string boundary this file owns. */

describe('oklchCssToSrgb', () => {
  it('resolves achromatic extremes', () => {
    expect(oklchCssToSrgb('oklch(0% 0 0)')).toEqual([0, 0, 0]);
    expect(oklchCssToSrgb('oklch(100% 0 0)')).toEqual([255, 255, 255]);
  });

  it('resolves an achromatic mid grey with equal channels', () => {
    const mid = oklchCssToSrgb('oklch(50% 0 0)');
    expect(mid).not.toBeNull();
    const [r, g, b] = mid!;
    expect(r).toBe(g);
    expect(g).toBe(b);
    expect(r).toBeGreaterThan(80);
    expect(r).toBeLessThan(140);
  });

  it('resolves the register-shaped warm ground near-white and warm', () => {
    const ground = oklchCssToSrgb('oklch(91.5% 0.01 95)');
    expect(ground).not.toBeNull();
    const [r, g, b] = ground!;
    expect(r).toBeGreaterThanOrEqual(g);
    expect(g).toBeGreaterThanOrEqual(b);
    expect(r).toBeGreaterThan(210);
    expect(b).toBeGreaterThan(200);
  });

  it('accepts a bare 0..1 lightness and rejects non-oklch strings', () => {
    expect(oklchCssToSrgb('oklch(1 0 0)')).toEqual([255, 255, 255]);
    expect(oklchCssToSrgb('rgb(1, 2, 3)')).toBeNull();
    expect(oklchCssToSrgb('')).toBeNull();
  });
});
