// SOURCING: @xyflow/react node paint. Kind distinguished by shape label, not hue.

import { Handle, Position, type Node, type NodeProps } from '@xyflow/react';

export interface ProgramNodeData extends Record<string, unknown> {
  readonly label: string;
  readonly kind: string;
  readonly shape: string;
  readonly authority: string | null;
}

export function ProgramNodeCard({ data, selected }: NodeProps<Node<ProgramNodeData>>) {
  return (
    <article
      className={
        selected
          ? 'min-w-[160px] rounded-ij-arc border border-ij-accent bg-ij-raised px-3 py-2 text-ij-ink'
          : 'min-w-[160px] rounded-ij-arc border border-ij-control-border bg-ij-raised px-3 py-2 text-ij-ink'
      }
      data-program-node={data.kind}
      data-shape={data.shape}
      data-selected={selected ? 'true' : 'false'}
    >
      <Handle type="target" position={Position.Left} className="!border-ij-seam !bg-ij-seam-raised" />
      <div className="font-ij-mono text-[10px] uppercase tracking-wide text-ij-ink-info" data-mono-ok>
        {data.kind} · {data.shape}
      </div>
      <h3 className="mt-1 text-sm font-medium">{data.label}</h3>
      {data.authority ? (
        <p className="mt-1 text-xs text-ij-ink-info">{data.authority}</p>
      ) : null}
      <Handle type="source" position={Position.Right} className="!border-ij-seam !bg-ij-seam-raised" />
    </article>
  );
}
