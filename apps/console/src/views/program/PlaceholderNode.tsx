'use client';

// SOURCING: @xyflow/react. Unknown catalog id placeholder (PG11).

import { memo } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';

export type PlaceholderNodeData = {
  readonly catalogId: string;
  readonly refusal?: string;
  readonly inputs?: readonly string[];
  readonly outputs?: readonly string[];
};

function PlaceholderNodeInner({ data }: NodeProps) {
  const node = data as unknown as PlaceholderNodeData;
  return (
    <article className="min-w-40 rounded-ij-arc border border-dashed border-ij-warn bg-ij-warn-bg px-2 py-2 text-ij-warn">
      <p className="font-ij-mono text-xs" data-mono-ok>missing:{node.catalogId}</p>
      {node.refusal ? <p className="mt-1 text-xs">{node.refusal}</p> : null}
      {(node.inputs ?? []).map((port) => (
        <div key={`input:${port}`} className="relative h-4">
          <Handle type="target" position={Position.Left} id={port} />
          <span className="ml-2 font-ij-mono text-xs" data-mono-ok>{port}</span>
        </div>
      ))}
      {(node.outputs ?? []).map((port) => (
        <div key={`output:${port}`} className="relative h-4 text-right">
          <span className="mr-2 font-ij-mono text-xs" data-mono-ok>{port}</span>
          <Handle type="source" position={Position.Right} id={port} />
        </div>
      ))}
    </article>
  );
}

export const PlaceholderNode = memo(PlaceholderNodeInner);
