// SOURCING: @xyflow/react wrap. React Flow supplies the graph node contract.

import { Handle, Position, type Node, type NodeProps } from '@xyflow/react';
import type { CanvasCardData } from './canvas-flow';

export function CanvasCardNode({ data }: NodeProps<Node<CanvasCardData>>) {
  return (
    <article className="canvas-card-node min-h-full px-3 py-2 text-ij-ink" data-canvas-card-node>
      <Handle type="target" position={Position.Top} className="canvas-card-handle" />
      <div className="canvas-card-text-plane" data-canvas-card-text-plane="flat">
        <div className="font-ij-mono text-ij-ink-info">{data.sourceType}</div>
        <h3 className="mt-1 font-medium">{data.title}</h3>
        {data.text ? <p className="mt-1 line-clamp-3 text-ij-ink-info">{data.text}</p> : null}
      </div>
      <Handle type="source" position={Position.Bottom} className="canvas-card-handle" />
    </article>
  );
}
