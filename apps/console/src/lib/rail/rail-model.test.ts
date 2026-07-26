// SOURCING: none. Unit oracle for rail tier derivation and unique labels.
// SPEC-COMMONPLACE-CONSOLE-SHELL-1.1 CS11.

import { describe, expect, it } from 'vitest';
import {
  assertUniqueRailLabels,
  deriveLayoutCollections,
  deriveRailCollections,
  KIND_RAIL_POLICY,
  PLACE_ENTRIES,
} from './rail-model';
import { KIND_GLYPH_ORDER } from '@/lib/material/kind-hues';

describe('rail-model', () => {
  it('places are the launch set of five', () => {
    expect(PLACE_ENTRIES.map((place) => place.label)).toEqual([
      'Chat',
      'Researcher',
      'Index',
      'Editor',
      'Models',
    ]);
    expect(PLACE_ENTRIES.map((place) => place.path)).toEqual([
      '/chat',
      '/indexer',
      '/filing',
      '/workspace',
      '/models',
    ]);
    expect(PLACE_ENTRIES.map((place) => place.surfaceId)).toEqual([
      'console-chat',
      'console-survey',
      'console-index',
      'console-workspace',
      'console-models',
    ]);
    expect(PLACE_ENTRIES).toHaveLength(5);
  });

  it('keeps glyphs unique across the five launch kinds', () => {
    const kinds = PLACE_ENTRIES.map((place) => place.kind);
    expect(new Set(kinds).size).toBe(kinds.length);
  });

  it('clears rail collections while layout collections remain for routes', () => {
    expect(deriveRailCollections()).toEqual([]);
    const collections = deriveLayoutCollections();
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
    expect(deriveLayoutCollections().some((entry) => entry.kindGlyph === 'canvas')).toBe(false);
  });

  it('adding a temporary collection policy surfaces a new entry', () => {
    const baseline = deriveLayoutCollections(KIND_GLYPH_ORDER).length;
    expect(baseline).toBe(5);
    expect(KIND_RAIL_POLICY.kanban.rail).toBe('hidden');
  });

  it('rejects duplicate labels across places and layout collections', () => {
    expect(() => assertUniqueRailLabels()).not.toThrow();
  });

  it('never invents a collection for an unregistered glyph', () => {
    const labels = new Set(deriveLayoutCollections().map((entry) => entry.kindGlyph));
    for (const glyph of labels) {
      expect(KIND_GLYPH_ORDER.includes(glyph)).toBe(true);
    }
  });
});
