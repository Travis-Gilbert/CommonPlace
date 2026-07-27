// SOURCING: @xyflow/react wrap + SPEC-ISOMETRIC-REGISTER paint cues for
// canvas cards (SPEC-CONSOLE-COMPONENT-SOURCING-1.0 SC4). Handles stay
// seam-colored at rest; accent appears only on selection / connect.

import { Handle, Position, type Node, type NodeProps } from '@xyflow/react';
import type { CanvasCardData } from './canvas-flow';

export function CanvasCardNode({ data, selected }: NodeProps<Node<CanvasCardData>>) {
  return (
    <article
      className={
        selected
          ? 'min-h-full rounded-ij-arc border border-ij-accent bg-ij-raised px-3 py-2 text-ij-ink'
          : 'min-h-full rounded-ij-arc border border-ij-control-border bg-ij-raised px-3 py-2 text-ij-ink'
      }
      data-canvas-card=""
      data-selected={selected ? 'true' : 'false'}
    >
      <Handle
        type="target"
        position={Position.Top}
        className="!border-ij-seam !bg-ij-seam-raised"
      />
      <div className="font-ij-mono text-ij-ink-info">{data.sourceType}</div>
      <h3 className="mt-1 font-medium">{data.title}</h3>
      {data.text ? <p className="mt-1 line-clamp-3 text-ij-ink-info">{data.text}</p> : null}
      <Handle
        type="source"
        position={Position.Bottom}
        className="!border-ij-seam !bg-ij-seam-raised"
      />
    </article>
  );
}
