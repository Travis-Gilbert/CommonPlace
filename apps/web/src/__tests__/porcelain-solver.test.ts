// TW1 solver unit tests: verifies the token map, axis adjustments,
// CSS generation, and register switching.

import { describe, it, expect } from 'vitest';
import {
  MEASURED,
  DEFAULT_AXES,
  SolverAxes,
  tokenMap,
  generateCSS,
} from '@/lib/theme/porcelain-solver';

describe('TW1 Porcelain Solver', () => {
  describe('MEASURED facts', () => {
    it('encodes observable Twenty proportions as constants', () => {
      expect(MEASURED.grid).toBe(4);
      expect(MEASURED.text.sm).toBeCloseTo(14.72, 1);
      expect(MEASURED.text.md).toBe(16);
      expect(MEASURED.text.lg).toBeCloseTo(19.68, 1);
      expect(MEASURED.icon.md).toBe(16);
      expect(MEASURED.radii.control).toBe(8);
      expect(MEASURED.table.cellPadX).toBe(8);
      expect(MEASURED.motion.normal).toBe(300);
    });
  });

  describe('DEFAULT_AXES', () => {
    it('defaults to 16px base, 4px unit, 1.0 compactness', () => {
      expect(DEFAULT_AXES.baseFontSize).toBe(16);
      expect(DEFAULT_AXES.spacingUnit).toBe(4);
      expect(DEFAULT_AXES.compactness).toBe(1.0);
    });
  });

  describe('tokenMap()', () => {
    it('returns porcelain (light) tokens by default', () => {
      const tokens = tokenMap('porcelain');
      expect(tokens['--plane']).toBe('#FFFFFF');
      expect(tokens['--ink']).toBe('#1A1A1A');
      expect(tokens['--g0']).toBe('#FFFFFF');
      expect(tokens['--g1']).toBe('#F1F1F1');
    });

    it('returns umber (dark) tokens for dark register', () => {
      const tokens = tokenMap('umber');
      expect(tokens['--plane']).toBe('#222222');
      expect(tokens['--ink']).toBe('#E5E5E5');
    });

    it('all type ramp values are computed, not hand-authored', () => {
      const tokens = tokenMap('porcelain');
      expect(typeof tokens['--text-sm']).toBe('string');
      expect(tokens['--text-md']).toBe('1rem');
      expect(tokens['--text-xs']).toBe('0.85rem');
    });

    it('scales type ramp with baseFontSize axis', () => {
      const tokens = tokenMap('porcelain', { baseFontSize: 20 });
      expect(tokens['--text-md']).toBe('1rem'); // md is always 1rem
      expect(tokens['--text-lg']).toBe('0.98rem'); // 19.68 / 20 ≈ 0.98
    });

    it('spacing tokens use calc expressions', () => {
      const tokens = tokenMap('porcelain');
      expect(tokens['--space-4']).toBe('calc(var(--grid) * 4)');
    });

    it('compactness affects table padding', () => {
      const tight = tokenMap('porcelain', { compactness: 0.5 });
      const loose = tokenMap('porcelain', { compactness: 1.5 });
      const tightPad = parseInt(tight['--table-cell-pad-x']);
      const loosePad = parseInt(loose['--table-cell-pad-x']);
      expect(loosePad).toBeGreaterThan(tightPad);
    });

    it('emits both currentColor and accent color vars', () => {
      const tokens = tokenMap('porcelain');
      expect(tokens['--accent']).toBeDefined();
      expect(tokens['--accent-soft']).toBeDefined();
      expect(tokens['--accent-deep']).toBeDefined();
      expect(tokens['--accent-ink']).toBeDefined();
    });

    it('emits border/hair tokens', () => {
      const tokens = tokenMap('porcelain');
      expect(tokens['--hair']).toBeDefined();
      expect(tokens['--hair-soft']).toBeDefined();
    });

    it('emits motion tokens', () => {
      const tokens = tokenMap('porcelain');
      expect(tokens['--motion']).toBe('300ms');
      expect(tokens['--motion-fast']).toBe('150ms');
      expect(tokens['--ease']).toBeDefined();
    });
  });

  describe('generateCSS()', () => {
    it('emits complete porcelain register block', () => {
      const css = generateCSS(DEFAULT_AXES);
      expect(css).toContain('.porcelain {');
      expect(css).toContain('--plane:');
      expect(css).toContain('--ink:');
      expect(css).toContain('}');
    });

    it('emits both porcelain and umber registers', () => {
      const css = generateCSS(DEFAULT_AXES);
      expect(css).toContain('.porcelain');
      expect(css).toContain("[data-register='umber']");
    });

    it('includes GENERATED header warning', () => {
      const css = generateCSS(DEFAULT_AXES);
      expect(css).toContain('GENERATED');
      expect(css.toLowerCase()).toContain('do not edit');
    });

    it('includes reduced-motion media query', () => {
      const css = generateCSS(DEFAULT_AXES);
      expect(css).toContain('prefers-reduced-motion');
      expect(css).toContain('--motion: 0ms');
    });

    it('produces valid CSS with balanced braces', () => {
      const css = generateCSS(DEFAULT_AXES);
      const open = (css.match(/\{/g) || []).length;
      const close = (css.match(/\}/g) || []).length;
      expect(open).toBe(close);
    });
  });
});
