import { renderToStaticMarkup } from 'react-dom/server';
import type { Node, NodeProps } from '@xyflow/react';
import { describe, expect, it, vi } from 'vitest';
import type { CanvasCardData } from './canvas-flow';

vi.mock('@xyflow/react', () => ({
  Handle: ({
    className,
    position,
    type,
  }: {
    className?: string;
    position: string;
    type: string;
  }) => (
    <span className={className} data-handle-position={position} data-handle-type={type} />
  ),
  Position: { Bottom: 'bottom', Top: 'top' },
}));

import { CanvasCardNode } from './CanvasCardNode';

describe('CanvasCardNode', () => {
  it('keeps the text flat and leaves both handles neutral in component markup', () => {
    const props = {
      id: 'canvas-card-a',
      selected: false,
      data: {
        sourceType: 'note',
        title: 'Ground the claim',
        text: 'Compare the proposal with the source evidence.',
      },
    } as unknown as NodeProps<Node<CanvasCardData>>;

    const markup = renderToStaticMarkup(<CanvasCardNode {...props} />);

    expect(markup).toContain('data-canvas-card-node="true"');
    expect(markup).toContain('data-canvas-card-text-plane="flat"');
    expect(markup).toContain('data-handle-type="target"');
    expect(markup).toContain('data-handle-type="source"');
    expect(markup.match(/canvas-card-handle/g)).toHaveLength(2);
    expect(markup).not.toContain('bg-ij-accent');
    expect(markup).not.toContain('shadow-ij-raised');
    expect(markup).not.toContain('rounded-ij-arc');
  });
});
