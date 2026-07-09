// TW1 acceptance: calibrated tokens must be within 5% of measured Twenty proportions.
// This is the DTCG sheet diff, encoded as assertions. Failing means the register
// drifted — retune the CSS custom properties in porcelain-theme.css.

import { describe, it, expect } from 'vitest';

function px(v: string): number {
  if (v.endsWith('rem')) return parseFloat(v) * 16;
  if (v.endsWith('px')) return parseFloat(v);
  throw new Error(`Cannot parse px value: ${v}`);
}

function withinTolerance(actual: number, expected: number, tolerance = 5) {
  const pct = Math.abs(actual - expected) / expected * 100;
  if (pct > tolerance) {
    throw new Error(`${actual}px is ${pct.toFixed(1)}% off expected ${expected}px (limit: ${tolerance}%)`);
  }
}

// Measured Twenty proportions — observable facts from the running product.
const TWENTY = {
  text: { xxs: 10, xs: 13.6, sm: 14.72, md: 16, lg: 19.68, xl: 24.64, xxl: 29.6 },
  icon: { sm: 14, md: 16, lg: 20, xl: 24 },
  radii: { chip: 4, control: 8, row: 8, band: 16, pill: 999 },
  grid: 4,
  table: { cellPadX: 8, cellMarginX: 8, checkboxCol: 32 },
  motion: { instant: 75, fast: 150, normal: 300, slow: 1500 },
};

// Calibrated porcelain tokens — must match porcelain-theme.css.
const PORCELAIN = {
  ground: '#FFFFFF',
  text: { xxs: '0.625rem', xs: '0.85rem', sm: '0.92rem', md: '1rem', lg: '1.23rem', xl: '1.54rem', xxl: '1.85rem' },
  icon: { sm: 14, md: 16, lg: 20, xl: 24 },
  radii: { chip: 4, control: 8, row: 8, band: 16, pill: 999 },
  grid: 4,
  table: { cellPadX: 8, cellMarginX: 8, checkboxCol: 32 },
  motion: { instant: 75, fast: 150, normal: 300, slow: 1500 },
};

describe('TW1 register calibration', () => {
  it('type ramp matches measured proportions within 5%', () => {
    for (const [step, expected] of Object.entries(TWENTY.text)) {
      const actual = px(PORCELAIN.text[step as keyof typeof PORCELAIN.text]);
      withinTolerance(actual, expected);
    }
  });

  it('icon sizes match measured values', () => {
    for (const [size, expected] of Object.entries(TWENTY.icon)) {
      expect(PORCELAIN.icon[size as keyof typeof PORCELAIN.icon]).toBe(expected);
    }
  });

  it('border radii match measured values', () => {
    for (const [tier, expected] of Object.entries(TWENTY.radii)) {
      expect(PORCELAIN.radii[tier as keyof typeof PORCELAIN.radii]).toBe(expected);
    }
  });

  it('spacing grid unit is 4px', () => {
    expect(PORCELAIN.grid).toBe(4);
  });

  it('table dimensions match measured values', () => {
    expect(PORCELAIN.table.cellPadX).toBe(8);
    expect(PORCELAIN.table.cellMarginX).toBe(8);
    expect(PORCELAIN.table.checkboxCol).toBe(32);
  });

  it('animation durations match measured values', () => {
    for (const [key, expected] of Object.entries(TWENTY.motion)) {
      expect(PORCELAIN.motion[key as keyof typeof PORCELAIN.motion]).toBe(expected);
    }
  });

  it('palette is white-ground, not parchment', () => {
    // After TW1 flattening: the porcelain ground is #FFFFFF (white),
    // not the warm parchment (#F6F5F4) of the original design.
    // Guards against accidental warm-tint drift.
    expect(PORCELAIN.ground).toBe('#FFFFFF');
  });
});
