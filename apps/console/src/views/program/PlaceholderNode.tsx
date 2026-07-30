'use client';

// SOURCING: @xyflow/react. Unknown catalog id placeholder (PG11).

import { memo } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';

export type PlaceholderNodeData = {
  readonly catalogId: string;
  readonly refusal?: string;
  readonly ports?: readonly string[];
};

function PlaceholderNodeInner({ data }: NodeProps) {
  const node = data as unknown as PlaceholderNodeData;
  return (
    <article className="min-w-40 rounded-ij-arc border border-dashed border-ij-warn bg-ij-warn-bg px-2 py-2 text-ij-warn">
      <p className="font-ij-mono text-xs" data-mono-ok>missing:{node.catalogId}</p>
      {node.refusal ? <p className="mt-1 text-xs">{node.refusal}</p> : null}
      {(node.ports ?? []).map((port) => (
        <div key={port} className="relative h-4">
          <Handle type="target" position={Position.Left} id={`in:${port}`} />
          <Handle type="source" position={Position.Right} id={`out:${port}`} />
        </div>
      ))}
    </article>
  );
}

export const PlaceholderNode = memo(PlaceholderNodeInner);
