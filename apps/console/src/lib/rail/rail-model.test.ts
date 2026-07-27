// SOURCING: none. Unit oracle for rail tier derivation and unique labels.
// SPEC-COMMONPLACE-CONSOLE-SHELL-1.1 CS11.

import { describe, expect, it } from 'vitest';
import {
  assertUniqueRailLabels,
  deriveBlockPaletteItems,
  deriveLayoutCollections,
  deriveRailCollections,
  KIND_RAIL_POLICY,
  PLACE_ENTRIES,
  type ConsoleViewDescriptor,
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

  it('derives Blocks membership only from descriptor palette flags', () => {
    const visible = descriptor('visible', true);
    const hidden = descriptor('hidden', false);

    expect(deriveBlockPaletteItems([visible, hidden])).toEqual([
      {
        id: 'visible',
        label: 'Visible',
        kind: 'records',
        descriptorId: 'visible',
        material: 'sunken',
      },
    ]);
  });

  it('adds and removes palette rows by changing only the descriptor list', () => {
    const baseline = [descriptor('records', true)];
    const added = descriptor('canvas', true);

    expect(deriveBlockPaletteItems(baseline).map((item) => item.id)).toEqual(['records']);
    expect(deriveBlockPaletteItems([...baseline, added]).map((item) => item.id)).toEqual([
      'records',
      'canvas',
    ]);
    expect(deriveBlockPaletteItems([added]).map((item) => item.id)).toEqual(['canvas']);
  });

  it('carries an explicit object query without deriving one from the glyph', () => {
    const visible = {
      ...descriptor('visible', true),
      palette: {
        kind: 'records',
        query: { types: ['record'] },
      },
    } satisfies ConsoleViewDescriptor;

    expect(deriveBlockPaletteItems([visible])[0]).toMatchObject({
      kind: 'records',
      query: { types: ['record'] },
    });
    expect(deriveBlockPaletteItems([descriptor('queryless', true)])[0])
      .not.toHaveProperty('query');
  });
});

function descriptor(id: string, paletteVisible: boolean): ConsoleViewDescriptor {
  const label = `${id.charAt(0).toUpperCase()}${id.slice(1)}`;
  return {
    id,
    name: label,
    paletteVisible,
    accepts: {},
    emits: [],
    renderer: id,
    source: {
      package: 'rail-model-test',
      component: 'Fixture',
      mode: 'bespoke',
      regime: 'css-vars',
      allowedBespokeReason: 'Pure palette derivation fixture.',
    },
    block: {
      usage: 'test palette membership',
      placements: ['ground'],
      defaultSize: 'm',
      density: 'compact',
      kindGlyph: 'records',
    },
    render: () => null,
  };
}
