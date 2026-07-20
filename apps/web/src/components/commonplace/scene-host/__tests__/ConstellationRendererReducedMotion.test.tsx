// @vitest-environment jsdom
/**
 * Reduced motion lives in its own file on purpose: motion reads the media query
 * once per module instance, so a single file cannot honestly exercise both
 * registers. Here the query answers "reduce" before the first render.
 */
import { beforeAll, describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { CONSTELLATION_STATE_FIXTURES } from '@commonplace/block-view-contracts/search-stack-fixture';
import { ConstellationSurface } from '../renderers/ConstellationRenderer';

beforeAll(() => {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: (query: string) => ({
      matches: query.includes('reduced-motion'),
      media: query,
      onchange: null,
      addListener: () => undefined,
      removeListener: () => undefined,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      dispatchEvent: () => false,
    }),
  });
});

describe('prefers-reduced-motion', () => {
  it('renders the settled graph immediately with no entrance animation', () => {
    const { container } = render(<ConstellationSurface state={CONSTELLATION_STATE_FIXTURES.success} />);

    const marks = container.querySelectorAll('.cp-constellation-canvas [tabindex="0"]');
    expect(marks.length).toBeGreaterThan(0);
    for (const mark of Array.from(marks)) {
      // No motion element, therefore no inline opacity or transform ramp.
      const style = mark.getAttribute('style');
      expect(style === null || !style.includes('opacity')).toBe(true);
      expect(style === null || !style.includes('transform')).toBe(true);
    }
  });

  it('places every node at its settled coordinate on the first frame', () => {
    const { container } = render(<ConstellationSurface state={CONSTELLATION_STATE_FIXTURES.success} />);
    const positioned = container.querySelectorAll('.cp-constellation-nodes > g[transform]');
    expect(positioned.length).toBe(10);
    for (const group of Array.from(positioned)) {
      expect(group.getAttribute('transform')).toMatch(/^translate\(-?\d+(\.\d+)? -?\d+(\.\d+)?\)$/);
    }
  });

  it('still announces every mark with its annotation', () => {
    render(<ConstellationSurface state={CONSTELLATION_STATE_FIXTURES.success} />);
    expect(screen.getAllByRole('button').length).toBeGreaterThanOrEqual(10);
    expect(screen.getAllByRole('group').length).toBeGreaterThan(0);
  });
});
