import { describe, expect, it } from 'vitest';
import { SPRING, FADE_EXIT, SETTLE_EXIT } from './work-motion';

/**
 * Only the pure constant exports are covered here. `useSpring` itself is a
 * hook (calls motion/react's useReducedMotion) and would need
 * @testing-library/react to render/assert -- not installed in this repo,
 * and adding it for one hook would be new tooling for a single call site,
 * so it's exercised indirectly via the live dev-server smoke test instead
 * (see WorkThread.tsx/WorkStageHost.tsx/WorkTextEditor.tsx call sites).
 */
describe('work-motion', () => {
  describe('SPRING', () => {
    it('defines snappy, natural, and gentle presets', () => {
      expect(Object.keys(SPRING).sort()).toEqual(['gentle', 'natural', 'snappy']);
    });

    it.each(Object.entries(SPRING))('%s preset is a valid spring shape', (_name, preset) => {
      expect(preset.type).toBe('spring');
      expect(preset.stiffness).toBeGreaterThan(0);
      expect(preset.damping).toBeGreaterThan(0);
    });

    it('orders presets from snappiest to gentlest by stiffness', () => {
      expect(SPRING.snappy.stiffness).toBeGreaterThan(SPRING.natural.stiffness);
      expect(SPRING.natural.stiffness).toBeGreaterThan(SPRING.gentle.stiffness);
    });
  });

  describe('FADE_EXIT', () => {
    it('only animates opacity, never a layout or position property', () => {
      expect(FADE_EXIT).toEqual({ opacity: 0 });
    });
  });

  describe('SETTLE_EXIT', () => {
    it('fades and settles upward without animating layout properties', () => {
      expect(SETTLE_EXIT).toEqual({ opacity: 0, y: -6 });
    });
  });
});
