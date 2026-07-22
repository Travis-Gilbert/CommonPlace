import { describe, expect, it } from 'vitest';
import {
  createStellarCardPositions,
  resolveCardFocus,
  STELLAR_CARD_SIZE,
  type StellarGalleryCard,
} from './3d-image-gallery';

const cards: readonly StellarGalleryCard[] = Array.from({ length: 9 }, (_, index) => ({
  id: `capture-${index}`,
  alt: `Capture ${index}`,
  title: `Capture ${index}`,
}));

describe('the installed 21st stellar layout', () => {
  it('preserves the upstream 12, 16, and 20 unit spherical layers', () => {
    const positions = createStellarCardPositions(cards);
    expect(positions).toHaveLength(cards.length);
    positions.forEach((position, index) => {
      const radius = Math.hypot(position.x, position.y, position.z);
      expect(radius).toBeCloseTo(12 + (index % 3) * 4, 8);
      expect(position.cardId).toBe(cards[index]?.id);
    });
  });

  it('is deterministic for identical Survey captures', () => {
    expect(createStellarCardPositions(cards)).toEqual(createStellarCardPositions(cards));
  });

  it('uses one fixed evidence frame for every source', () => {
    expect(STELLAR_CARD_SIZE).toEqual({ width: 6, height: 4.5 });
    expect(STELLAR_CARD_SIZE.width / STELLAR_CARD_SIZE.height).toBeCloseTo(4 / 3, 8);
  });

  it('keeps the corpus quiet until hover reveals a neighborhood', () => {
    const adjacency = new Map<string, ReadonlySet<string>>([
      ['capture-0', new Set(['capture-1', 'capture-2'])],
      ['capture-1', new Set(['capture-0'])],
      ['capture-2', new Set(['capture-0'])],
    ]);

    expect(resolveCardFocus('capture-0', null, adjacency)).toBe('idle');
    expect(resolveCardFocus('capture-0', 'capture-0', adjacency)).toBe('focused');
    expect(resolveCardFocus('capture-1', 'capture-0', adjacency)).toBe('related');
    expect(resolveCardFocus('capture-8', 'capture-0', adjacency)).toBe('dimmed');
  });
});
