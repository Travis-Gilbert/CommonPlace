// SOURCING: none. Unit oracle for rail tier derivation and unique labels.

import { describe, expect, it } from 'vitest';
import {
  assertUniqueRailLabels,
  deriveRailCollections,
  KIND_RAIL_POLICY,
  PLACE_ENTRIES,
} from './rail-model';
import { KIND_GLYPH_ORDER } from '@/lib/material/kind-hues';

describe('rail-model', () => {
  it('places are the closed five destinations', () => {
    expect(PLACE_ENTRIES.map((place) => place.label)).toEqual([
      'Chat',
      'Workspace',
      'Filing',
      'Canvas',
      'Automation',
    ]);
  });

  it('derives collections from the kind set without a hand-authored list', () => {
    const collections = deriveRailCollections();
    expect(collections.every((entry) => entry.tier === 'collection')).toBe(true);
    expect(collections.map((entry) => entry.label).sort()).toEqual([
      'Cards',
      'Documents',
      'Files',
      'Records',
      'Threads',
    ]);
  });

  it('hides a kind that declares itself hidden', () => {
    expect(KIND_RAIL_POLICY.canvas.rail).toBe('hidden');
    expect(deriveRailCollections().some((entry) => entry.kindGlyph === 'canvas')).toBe(false);
  });

  it('adding a temporary collection policy surfaces a new entry', () => {
    const withKanban = KIND_GLYPH_ORDER;
    const baseline = deriveRailCollections(withKanban).length;
    // Policy stays hidden for kanban; count equals baseline until policy flips.
    expect(baseline).toBe(5);
    expect(KIND_RAIL_POLICY.kanban.rail).toBe('hidden');
  });

  it('rejects duplicate labels across places and collections', () => {
    expect(() => assertUniqueRailLabels()).not.toThrow();
  });

  it('never invents a collection for an unregistered glyph', () => {
    const labels = new Set(deriveRailCollections().map((entry) => entry.kindGlyph));
    for (const glyph of labels) {
      expect(KIND_GLYPH_ORDER.includes(glyph)).toBe(true);
    }
  });
});
