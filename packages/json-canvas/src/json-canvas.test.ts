// SOURCING: none — pure logic, no upstream component applies.

import { describe, expect, it } from 'vitest';
import { applyJsonCanvasAsActions } from './apply';
import { PRESET_TO_IJ_TOKEN, resolveCanvasColor } from './colors';
import { fromJsonCanvas, toJsonCanvas } from './interchange';
import { CanvasParseError, parseCanvasText, parseCanvasValue } from './parse';
import { serializeCanvas } from './serialize';
import type { JSONCanvas } from './types';

const FIXTURE_TEXT = `{
  "nodes": [
    {
      "id": "n-group",
      "type": "group",
      "x": 0,
      "y": 0,
      "width": 800,
      "height": 600,
      "label": "Research",
      "backgroundStyle": "ratio"
    },
    {
      "id": "n-text",
      "type": "text",
      "x": 40,
      "y": 40,
      "width": 260,
      "height": 120,
      "color": "4",
      "text": "Spec grounding notes."
    },
    {
      "id": "n-file",
      "type": "file",
      "x": 340,
      "y": 40,
      "width": 260,
      "height": 120,
      "file": "docs/spec.md",
      "subpath": "#overview"
    },
    {
      "id": "n-link",
      "type": "link",
      "x": 40,
      "y": 200,
      "width": 260,
      "height": 80,
      "color": "#2D5F6B",
      "url": "https://jsoncanvas.org/spec/1.0/"
    }
  ],
  "edges": [
    {
      "id": "e-1",
      "fromNode": "n-text",
      "fromSide": "right",
      "toNode": "n-file",
      "toSide": "left",
      "toEnd": "arrow",
      "label": "references"
    },
    {
      "id": "e-2",
      "fromNode": "n-text",
      "toNode": "n-link",
      "color": "5"
    }
  ]
}`;

describe('JSON Canvas parse and serialize', () => {
  it('round-trips the fixture text byte-stably without graph ids', () => {
    const parsed = parseCanvasText(FIXTURE_TEXT);
    expect(serializeCanvas(parsed)).toBe(FIXTURE_TEXT);
  });

  it('rejects malformed nodes with a named path', () => {
    expect(() => parseCanvasValue({ nodes: [{ id: 'x', type: 'text' }] })).toThrow(CanvasParseError);
    try {
      parseCanvasValue({ nodes: [{ id: 'x', type: 'text' }] });
    } catch (error) {
      expect(error).toBeInstanceOf(CanvasParseError);
      expect((error as Error).message).toContain('$.nodes[0].x');
    }
  });
});

describe('graph-native interchange', () => {
  it('imports then exports with stable topology and preserved hex', () => {
    const document = parseCanvasText(FIXTURE_TEXT);
    const graph = fromJsonCanvas(document, {
      canvasId: 'canvas.demo',
      tenant: 'tenant-a',
      title: 'Demo',
    });
    expect(graph.placements).toHaveLength(3);
    expect(graph.groups).toHaveLength(1);
    expect(graph.connections).toHaveLength(2);
    const hexObject = graph.objects.find((object) => object.url?.includes('jsoncanvas'));
    expect(hexObject?.color).toBe('#2D5F6B');

    const exported = toJsonCanvas(graph);
    const again = fromJsonCanvas(exported, {
      canvasId: 'canvas.demo',
      tenant: 'tenant-a',
    });
    expect(again.placements.map((placement) => placement.objectId).sort()).toEqual(
      graph.placements.map((placement) => placement.objectId).sort(),
    );
    expect(again.connections).toHaveLength(graph.connections.length);
    const reexportedHex = again.objects.find((object) => object.id === hexObject?.id);
    expect(reexportedHex?.color).toBe('#2D5F6B');
  });

  it('preserves graphId identity across export then import', () => {
    const withIds: JSONCanvas = {
      nodes: [
        {
          id: 'a',
          type: 'text',
          x: 0,
          y: 0,
          width: 100,
          height: 40,
          text: 'Hello',
          graphId: 'note.hello',
          color: '1',
        },
        {
          id: 'b',
          type: 'text',
          x: 200,
          y: 0,
          width: 100,
          height: 40,
          text: 'World',
          graphId: 'note.world',
        },
      ],
      edges: [
        {
          id: 'e',
          fromNode: 'a',
          toNode: 'b',
          graphId: 'conn.a-b',
        },
      ],
    };
    const graph = fromJsonCanvas(withIds, { canvasId: 'c1', tenant: 't1' });
    expect(graph.placements.map((placement) => placement.objectId).sort()).toEqual([
      'note.hello',
      'note.world',
    ]);
    expect(graph.connections[0]?.id).toBe('conn.a-b');
    const round = fromJsonCanvas(toJsonCanvas(graph), { canvasId: 'c1', tenant: 't1' });
    expect(round.placements.map((placement) => placement.objectId).sort()).toEqual([
      'note.hello',
      'note.world',
    ]);
    expect(round.connections[0]?.id).toBe('conn.a-b');
  });
});

describe('colors', () => {
  it('maps presets to Int UI tokens', () => {
    expect(resolveCanvasColor('4')).toBe(PRESET_TO_IJ_TOKEN['4']);
    expect(resolveCanvasColor('#abc')).toBe('#abc');
  });
});

describe('apply as ObjectActions', () => {
  it('emits create and link actions for a validated document', () => {
    const document = parseCanvasText(FIXTURE_TEXT);
    const { actions } = applyJsonCanvasAsActions(document, {
      canvasId: 'canvas.demo',
      tenant: 'tenant-a',
    });
    expect(actions.some((action) => action.kind === 'create' && action.type === 'canvas')).toBe(true);
    expect(actions.some((action) => action.kind === 'link')).toBe(true);
  });
});
