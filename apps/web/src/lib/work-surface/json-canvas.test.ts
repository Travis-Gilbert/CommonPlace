import { describe, expect, it } from 'vitest';
import {
  CanvasParseError,
  EMPTY_CANVAS,
  parseCanvasText,
  parseCanvasValue,
  serializeCanvas,
  type JSONCanvas,
} from './json-canvas';

/**
 * Hand-authored fixture covering all four node kinds (text/file/link/group),
 * every optional generic field (color), every group-only field (label,
 * backgroundStyle), and edges exercising sides/ends/color/label. The exact
 * text (key order + 2-space indent) matches what `serializeCanvas` itself
 * produces, so this fixture also acts as a format-regression guard: any
 * accidental change to key order or omitted-field handling fails this test.
 */
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

describe('parseCanvasText / serializeCanvas round trip', () => {
  it('is byte-stable: serialize(parse(fixture)) === fixture', () => {
    const parsed = parseCanvasText(FIXTURE_TEXT);
    expect(serializeCanvas(parsed)).toBe(FIXTURE_TEXT);
  });

  it('is idempotent under a second round trip', () => {
    const once = serializeCanvas(parseCanvasText(FIXTURE_TEXT));
    const twice = serializeCanvas(parseCanvasText(once));
    expect(twice).toBe(once);
  });

  it('parses every node kind with its distinguishing fields', () => {
    const canvas = parseCanvasText(FIXTURE_TEXT);
    expect(canvas.nodes).toHaveLength(4);
    const [group, text, file, link] = canvas.nodes;
    expect(group).toMatchObject({ type: 'group', label: 'Research', backgroundStyle: 'ratio' });
    expect(text).toMatchObject({ type: 'text', text: 'Spec grounding notes.', color: '4' });
    expect(file).toMatchObject({ type: 'file', file: 'docs/spec.md', subpath: '#overview' });
    expect(link).toMatchObject({ type: 'link', url: 'https://jsoncanvas.org/spec/1.0/' });
  });

  it('parses edges with sides, ends, color, and label', () => {
    const canvas = parseCanvasText(FIXTURE_TEXT);
    expect(canvas.edges).toEqual([
      {
        id: 'e-1',
        fromNode: 'n-text',
        fromSide: 'right',
        toNode: 'n-file',
        toSide: 'left',
        toEnd: 'arrow',
        label: 'references',
      },
      { id: 'e-2', fromNode: 'n-text', toNode: 'n-link', color: '5' },
    ]);
  });
});

describe('EMPTY_CANVAS / missing nodes+edges', () => {
  it('treats a bare {} as an empty canvas', () => {
    expect(parseCanvasValue({})).toEqual(EMPTY_CANVAS);
  });

  it('serializes the empty canvas to empty arrays', () => {
    expect(serializeCanvas(EMPTY_CANVAS)).toBe('{\n  "nodes": [],\n  "edges": []\n}');
  });
});

describe('parseCanvasValue defensive validation', () => {
  it('rejects a non-object top level', () => {
    expect(() => parseCanvasValue([])).toThrow(CanvasParseError);
    expect(() => parseCanvasValue('nope')).toThrow(CanvasParseError);
    expect(() => parseCanvasValue(null)).toThrow(CanvasParseError);
  });

  it('rejects nodes that is not an array', () => {
    expect(() => parseCanvasValue({ nodes: {} })).toThrow(/\$\.nodes.*array/);
  });

  it('rejects edges that is not an array', () => {
    expect(() => parseCanvasValue({ edges: 'x' })).toThrow(/\$\.edges.*array/);
  });

  it('rejects a node missing a required generic field', () => {
    expect(() =>
      parseCanvasValue({ nodes: [{ id: 'a', type: 'text', x: 0, y: 0, width: 1, text: 'hi' }] }),
    ).toThrow(/\$\.nodes\[0\]\.height/);
  });

  it('rejects a node with a non-integer coordinate', () => {
    expect(() =>
      parseCanvasValue({
        nodes: [{ id: 'a', type: 'text', x: 1.5, y: 0, width: 1, height: 1, text: 'hi' }],
      }),
    ).toThrow(/\$\.nodes\[0\]\.x.*integer/);
  });

  it('rejects an unknown node type', () => {
    expect(() =>
      parseCanvasValue({ nodes: [{ id: 'a', type: 'shape', x: 0, y: 0, width: 1, height: 1 }] }),
    ).toThrow(/\$\.nodes\[0\]\.type/);
  });

  it('rejects a text node missing text', () => {
    expect(() =>
      parseCanvasValue({ nodes: [{ id: 'a', type: 'text', x: 0, y: 0, width: 1, height: 1 }] }),
    ).toThrow(/\$\.nodes\[0\]\.text/);
  });

  it('rejects a file node missing file', () => {
    expect(() =>
      parseCanvasValue({ nodes: [{ id: 'a', type: 'file', x: 0, y: 0, width: 1, height: 1 }] }),
    ).toThrow(/\$\.nodes\[0\]\.file/);
  });

  it('rejects a link node missing url', () => {
    expect(() =>
      parseCanvasValue({ nodes: [{ id: 'a', type: 'link', x: 0, y: 0, width: 1, height: 1 }] }),
    ).toThrow(/\$\.nodes\[0\]\.url/);
  });

  it('rejects a group node with an invalid backgroundStyle', () => {
    expect(() =>
      parseCanvasValue({
        nodes: [{ id: 'a', type: 'group', x: 0, y: 0, width: 1, height: 1, backgroundStyle: 'tiled' }],
      }),
    ).toThrow(/\$\.nodes\[0\]\.backgroundStyle/);
  });

  it('rejects an invalid color (not a preset or hex)', () => {
    expect(() =>
      parseCanvasValue({
        nodes: [{ id: 'a', type: 'text', x: 0, y: 0, width: 1, height: 1, text: 'hi', color: 'red' }],
      }),
    ).toThrow(/\$\.nodes\[0\]\.color/);
  });

  it('accepts a 3-digit and 6-digit hex color', () => {
    const canvas = parseCanvasValue({
      nodes: [
        { id: 'a', type: 'text', x: 0, y: 0, width: 1, height: 1, text: 'hi', color: '#f00' },
        { id: 'b', type: 'text', x: 0, y: 0, width: 1, height: 1, text: 'hi', color: '#ff0000' },
      ],
    });
    expect(canvas.nodes.map((n) => n.color)).toEqual(['#f00', '#ff0000']);
  });

  it('rejects an edge missing fromNode/toNode', () => {
    expect(() => parseCanvasValue({ edges: [{ id: 'e', toNode: 'b' }] })).toThrow(/\$\.edges\[0\]\.fromNode/);
  });

  it('rejects an edge with an invalid side', () => {
    expect(() =>
      parseCanvasValue({ edges: [{ id: 'e', fromNode: 'a', toNode: 'b', fromSide: 'north' }] }),
    ).toThrow(/\$\.edges\[0\]\.fromSide/);
  });

  it('rejects an edge with an invalid end', () => {
    expect(() =>
      parseCanvasValue({ edges: [{ id: 'e', fromNode: 'a', toNode: 'b', toEnd: 'diamond' }] }),
    ).toThrow(/\$\.edges\[0\]\.toEnd/);
  });

  it('rejects malformed JSON text with a SyntaxError, not a CanvasParseError', () => {
    expect(() => parseCanvasText('{not json')).toThrow(SyntaxError);
  });
});

describe('serializeCanvas', () => {
  it('omits undefined optional fields rather than writing null', () => {
    const canvas: JSONCanvas = {
      nodes: [{ id: 'a', type: 'text', x: 0, y: 0, width: 10, height: 10, text: 'hi' }],
      edges: [],
    };
    const text = serializeCanvas(canvas);
    expect(text).not.toContain('null');
    expect(text).not.toContain('color');
  });
});
