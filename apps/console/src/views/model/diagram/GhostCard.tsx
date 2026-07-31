'use client';

// SOURCING: jalco repo-card ghost treatment on @xyflow/react custom node contract.

import { Handle, Position, type NodeProps } from '@xyflow/react';
import { formatCoverage, formatFieldType } from '@commonplace/data-model-contracts';
import { RecordChip } from './RecordChip';
import type { GhostFlowNode } from './layout';

function stringifySample(value: unknown): string {
  if (typeof value === 'string') return value;
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

export function GhostCard({ data }: NodeProps<GhostFlowNode>) {
  const pending = data.pendingPin;

  return (
    <article
      className={[
        'flex w-64 flex-col overflow-hidden rounded-ij-arc border border-dashed border-ij-seam bg-ij-chrome font-ij-mono text-ij-ink-info',
        pending ? 'opacity-50' : '',
      ].filter(Boolean).join(' ')}
      onClick={() => data.onSelect({ kind: 'observed-type', key: data.observedKey })}
      aria-label={`Observed type ${data.label}`}
    >
      <Handle type="target" position={Position.Left} isConnectable={false} />

      <header className="flex items-center gap-2 border-b border-dashed border-ij-seam px-2 py-1.5">
        <RecordChip label={data.label} tint="var(--ij-row-gray)" ink="var(--ij-ink-info)" />
        <span className="ml-auto text-ij-island-meta" data-mono-ok>
          {formatCoverage(data.coverage)} · {data.occurrences}
        </span>
      </header>

      <ul className="max-h-24 overflow-auto px-2 py-1.5">
        {data.fields.map((field) => {
          const sampleTitle = field.sampleValues.length
            ? field.sampleValues.map(stringifySample).join(', ')
            : undefined;
          return (
            <li key={field.observedKey}>
              <button
                type="button"
                title={sampleTitle}
                className="flex w-full min-h-5 items-center gap-2 rounded-ij-arc px-1 text-left text-xs hover:bg-ij-hover-surface"
                onClick={(event) => {
                  event.stopPropagation();
                  data.onSelect({ kind: 'observed-field', key: field.observedKey });
                }}
              >
                <span className="truncate text-ij-ink">{field.key}</span>
                <span className="ml-auto truncate text-ij-ink-info">
                  {formatFieldType(field.fieldType)}
                </span>
              </button>
            </li>
          );
        })}
      </ul>

      <footer className="border-t border-dashed border-ij-seam px-2 py-1.5">
        <button
          type="button"
          disabled={pending || data.pinned}
          onClick={(event) => {
            event.stopPropagation();
            data.onPin();
          }}
          className="h-ij-control w-full rounded-ij-arc border border-ij-control-border px-2 text-ij-ink hover:bg-ij-hover-surface disabled:opacity-50"
        >
          {data.pinned ? 'Declared' : pending ? 'Pinning' : 'Pin'}
        </button>
      </footer>

      <Handle type="source" position={Position.Right} isConnectable={false} />
    </article>
  );
}
