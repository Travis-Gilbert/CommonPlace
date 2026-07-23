// SOURCING: none. Pure logic, no upstream component applies.

import { describe, expect, it } from 'vitest';
import { parseCanvasValue } from '@commonplace/json-canvas';
import { CANVAS_CONNECT_EDGE, CANVAS_MEMBER_EDGE, CANVAS_TYPE } from './object-bridge';
import { CanvasStore, DEFAULT_CANVAS_ID, REFUSAL_NOTE } from './store';

describe('CanvasStore', () => {
  it('refuses when tenant is missing', () => {
    const store = new CanvasStore(null);
    const set = store.query({ types: [CANVAS_TYPE], page: { limit: 10 } });
    expect(set.notes).toContain(REFUSAL_NOTE);
    expect(store.emit({
      kind: 'create',
      type: 'note',
      props: { id: 'n1', title: 'A', canvasId: DEFAULT_CANVAS_ID },
    }).ok).toBe(false);
  });

  it('places, moves, links, and unlinks without deleting the object', () => {
    const store = new CanvasStore('tenant-a');
    const created = store.emit({
      kind: 'create',
      type: 'note',
      props: {
        id: 'note.a',
        title: 'Alpha',
        text: 'Hello',
        canvasId: DEFAULT_CANVAS_ID,
        x: 10,
        y: 20,
      },
    });
    expect(created.ok).toBe(true);

    const moved = store.emit({
      kind: 'update',
      id: 'note.a',
      patch: { x: 100, y: 200 },
    });
    expect(moved.ok).toBe(true);
    expect(store.getCanvas(DEFAULT_CANVAS_ID)?.placements[0]).toMatchObject({
      objectId: 'note.a',
      x: 100,
      y: 200,
    });

    store.emit({
      kind: 'create',
      type: 'note',
      props: { id: 'note.b', title: 'Beta', canvasId: DEFAULT_CANVAS_ID, x: 300, y: 20 },
    });
    const linked = store.emit({
      kind: 'link',
      from: 'note.a',
      edge: CANVAS_CONNECT_EDGE,
      to: 'note.b',
    });
    expect(linked.ok).toBe(true);
    expect(store.getCanvas(DEFAULT_CANVAS_ID)?.connections).toHaveLength(1);

    const unlinked = store.emit({
      kind: 'unlink',
      from: DEFAULT_CANVAS_ID,
      edge: CANVAS_MEMBER_EDGE,
      to: 'note.a',
    });
    expect(unlinked.ok).toBe(true);
    const canvas = store.getCanvas(DEFAULT_CANVAS_ID)!;
    expect(canvas.placements.some((placement) => placement.objectId === 'note.a')).toBe(false);
    expect(canvas.objects.some((object) => object.id === 'note.a')).toBe(true);
  });

  it('imports and exports a JSON Canvas document', () => {
    const store = new CanvasStore('tenant-a');
    const document = parseCanvasValue({
      nodes: [
        { id: 't', type: 'text', x: 0, y: 0, width: 120, height: 60, text: 'Imported', color: '3' },
        { id: 'u', type: 'link', x: 200, y: 0, width: 120, height: 60, url: 'https://example.com', color: '5' },
      ],
      edges: [{ id: 'e', fromNode: 't', toNode: 'u' }],
    });
    const receipt = store.importDocument(DEFAULT_CANVAS_ID, document);
    expect(receipt.ok).toBe(true);
    const exported = store.exportDocument(DEFAULT_CANVAS_ID);
    expect(exported?.nodes.length).toBeGreaterThanOrEqual(2);
    expect(exported?.edges).toHaveLength(1);
    const link = store.getCanvas(DEFAULT_CANVAS_ID)?.objects.find((object) => object.url);
    expect(link?.color).toBe('5');
  });

  it('applies agent JSON Canvas via invoke_tool', () => {
    const store = new CanvasStore('tenant-a');
    const document = parseCanvasValue({
      nodes: [{ id: 'a', type: 'text', x: 1, y: 2, width: 10, height: 10, text: 'Agent' }],
      edges: [],
    });
    const receipt = store.emit({
      kind: 'invoke_tool',
      tool: 'canvas.apply_json',
      args: { canvasId: DEFAULT_CANVAS_ID, document: document as unknown as Record<string, never> },
    });
    expect(receipt.ok).toBe(true);
    expect(store.getCanvas(DEFAULT_CANVAS_ID)?.placements.length).toBeGreaterThan(0);
  });

  it('refuses invalid JSON Canvas apply requests', () => {
    const store = new CanvasStore('tenant-a');
    const receipt = store.emit({
      kind: 'invoke_tool',
      tool: 'canvas.apply_json',
      args: { canvasId: DEFAULT_CANVAS_ID, document: { nodes: 'invalid' } },
    });
    expect(receipt.ok).toBe(false);
  });
});
