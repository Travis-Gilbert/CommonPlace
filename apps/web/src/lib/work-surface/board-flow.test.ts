import { describe, expect, it } from 'vitest';
import {
  addTextNode,
  applyNodePositions,
  canvasToFlow,
  removeNodes,
  resolveNodeColor,
  sourceHandleId,
  targetHandleId,
  updateNodeText,
} from './board-flow';
import type { JSONCanvas } from './json-canvas';

const SAMPLE: JSONCanvas = {
  nodes: [
    { id: 'g1', type: 'group', x: 0, y: 0, width: 400, height: 300, label: 'Group' },
    { id: 't1', type: 'text', x: 10, y: 10, width: 200, height: 100, text: 'hello', color: '2' },
    { id: 'f1', type: 'file', x: 220, y: 10, width: 200, height: 100, file: 'a.md' },
    { id: 'l1', type: 'link', x: 10, y: 130, width: 200, height: 60, url: 'https://x.test', color: '#123456' },
  ],
  edges: [
    { id: 'e1', fromNode: 't1', toNode: 'f1', fromSide: 'right', toSide: 'left', label: 'ref' },
    { id: 'e2', fromNode: 't1', toNode: 'l1' },
  ],
};

describe('canvasToFlow', () => {
  it('maps every node to a positioned/sized flow node carrying the source node in data', () => {
    const { nodes } = canvasToFlow(SAMPLE);
    expect(nodes).toHaveLength(4);
    const t1 = nodes.find((n) => n.id === 't1')!;
    expect(t1.type).toBe('text');
    expect(t1.position).toEqual({ x: 10, y: 10 });
    expect(t1.style).toEqual({ width: 200, height: 100 });
    expect(t1.data.node).toEqual(SAMPLE.nodes[1]);
  });

  it('gives group nodes a lower zIndex than every other node', () => {
    const { nodes } = canvasToFlow(SAMPLE);
    const group = nodes.find((n) => n.id === 'g1')!;
    const others = nodes.filter((n) => n.id !== 'g1');
    expect(others.every((n) => n.zIndex > group.zIndex)).toBe(true);
  });

  it('maps edges to source/target handles derived from fromSide/toSide, defaulting when absent', () => {
    const { edges } = canvasToFlow(SAMPLE);
    expect(edges).toEqual([
      {
        id: 'e1',
        source: 't1',
        target: 'f1',
        sourceHandle: 'right-source',
        targetHandle: 'left-target',
        label: 'ref',
        data: { color: undefined, fromEnd: 'none', toEnd: 'arrow' },
      },
      {
        id: 'e2',
        source: 't1',
        target: 'l1',
        sourceHandle: 'bottom-source',
        targetHandle: 'top-target',
        label: undefined,
        data: { color: undefined, fromEnd: 'none', toEnd: 'arrow' },
      },
    ]);
  });
});

describe('sourceHandleId / targetHandleId', () => {
  it('defaults to bottom-source / top-target when the side is unspecified', () => {
    expect(sourceHandleId(undefined)).toBe('bottom-source');
    expect(targetHandleId(undefined)).toBe('top-target');
  });

  it('uses the given side otherwise', () => {
    expect(sourceHandleId('left')).toBe('left-source');
    expect(targetHandleId('right')).toBe('right-target');
  });
});

describe('resolveNodeColor', () => {
  it('maps presets 1-6 to real design tokens', () => {
    expect(resolveNodeColor('1')).toBe('var(--tag-red)');
    expect(resolveNodeColor('6')).toBe('var(--tag-purple)');
  });

  it('passes through a hex color unchanged', () => {
    expect(resolveNodeColor('#123456')).toBe('#123456');
  });

  it('returns undefined when there is no color', () => {
    expect(resolveNodeColor(undefined)).toBeUndefined();
  });
});

describe('applyNodePositions', () => {
  it('updates only the given node ids, rounding to integers', () => {
    const updated = applyNodePositions(SAMPLE, new Map([['t1', { x: 12.6, y: 8.2 }]]));
    expect(updated.nodes.find((n) => n.id === 't1')).toMatchObject({ x: 13, y: 8 });
    expect(updated.nodes.find((n) => n.id === 'f1')).toEqual(SAMPLE.nodes[2]);
  });

  it('is a no-op for an empty position map (returns the same reference)', () => {
    expect(applyNodePositions(SAMPLE, new Map())).toBe(SAMPLE);
  });

  it('ignores positions for unknown ids', () => {
    const updated = applyNodePositions(SAMPLE, new Map([['nope', { x: 1, y: 1 }]]));
    expect(updated.nodes).toEqual(SAMPLE.nodes);
  });
});

describe('updateNodeText', () => {
  it('updates a text node in place', () => {
    const updated = updateNodeText(SAMPLE, 't1', 'updated text');
    expect(updated.nodes.find((n) => n.id === 't1')).toMatchObject({ text: 'updated text' });
  });

  it('is a no-op when the id is not a text node', () => {
    const updated = updateNodeText(SAMPLE, 'f1', 'nope');
    expect(updated.nodes.find((n) => n.id === 'f1')).toEqual(SAMPLE.nodes[2]);
  });
});

describe('addTextNode', () => {
  it('appends a new text node with default size and empty text', () => {
    const updated = addTextNode(SAMPLE, { id: 'new1', x: 5, y: 6 });
    const added = updated.nodes.at(-1);
    expect(added).toEqual({ id: 'new1', type: 'text', x: 5, y: 6, width: 240, height: 120, text: '' });
  });

  it('accepts initial text and rounds coordinates', () => {
    const updated = addTextNode(SAMPLE, { id: 'new2', x: 5.9, y: 6.1, text: 'seed' });
    expect(updated.nodes.at(-1)).toMatchObject({ x: 6, y: 6, text: 'seed' });
  });
});

describe('removeNodes', () => {
  it('removes the given nodes and any edges touching them', () => {
    const updated = removeNodes(SAMPLE, ['f1']);
    expect(updated.nodes.map((n) => n.id)).toEqual(['g1', 't1', 'l1']);
    expect(updated.edges.map((e) => e.id)).toEqual(['e2']);
  });

  it('is a no-op for an empty id list', () => {
    expect(removeNodes(SAMPLE, [])).toBe(SAMPLE);
  });
});
