// SOURCING: @xyflow/react wrap. React Flow supplies the graph node contract.

import { Handle, Position, type Node, type NodeProps } from '@xyflow/react';
import type { CanvasCardData } from './canvas-flow';

export function CanvasCardNode({ data }: NodeProps<Node<CanvasCardData>>) {
  return (
    <article className="min-h-full rounded-ij-arc border border-ij-control-border bg-ij-raised px-3 py-2 text-ij-ink shadow-ij-raised">
      <Handle type="target" position={Position.Top} className="!border-ij-seam !bg-ij-accent" />
      <div className="font-ij-mono text-ij-ink-info">{data.sourceType}</div>
      <h3 className="mt-1 font-medium">{data.title}</h3>
      {data.text ? <p className="mt-1 line-clamp-3 text-ij-ink-info">{data.text}</p> : null}
      <Handle type="source" position={Position.Bottom} className="!border-ij-seam !bg-ij-accent" />
    </article>
  );
}
