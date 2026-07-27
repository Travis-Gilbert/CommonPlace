import { describe, expect, it } from 'vitest';
import { canvasDropAction } from './canvas-drop';

describe('canvasDropAction', () => {
  it('links a node dropped on another node instead of moving it', () => {
    expect(
      canvasDropAction(
        { id: 'card-a', position: { x: 42.4, y: 73.8 } },
        [{ id: 'card-b' }],
      ),
    ).toEqual({
      kind: 'link',
      from: 'card-a',
      edge: 'CANVAS_CONNECT',
      to: 'card-b',
    });
  });

  it('moves a node when it is not dropped on another node', () => {
    expect(
      canvasDropAction(
        { id: 'card-a', position: { x: 42.4, y: 73.8 } },
        [],
      ),
    ).toEqual({
      kind: 'update',
      id: 'card-a',
      patch: { x: 42, y: 74 },
    });
  });
});
