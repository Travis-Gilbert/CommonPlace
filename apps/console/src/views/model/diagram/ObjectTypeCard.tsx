'use client';

// SOURCING: jalco repo-card anatomy on @xyflow/react custom node contract.

import { Handle, Position, type NodeProps } from '@xyflow/react';
import { formatFieldType, type Enforcement } from '@commonplace/data-model-contracts';
import { RecordChip } from './RecordChip';
import type { ObjectTypeFlowNode } from './layout';

function EnforcementChip({ enforcement }: { readonly enforcement: Enforcement }) {
  return (
    <span className="rounded-ij-arc bg-ij-chrome px-1.5 font-ij-mono text-ij-island-meta text-ij-ink-info">
      {enforcement}
    </span>
  );
}

function DivergenceBadge({
  count,
  signalIds,
  onOpen,
}: {
  readonly count: number;
  readonly signalIds: readonly string[];
  readonly onOpen: () => void;
}) {
  if (count <= 0) return null;
  return (
    <button
      type="button"
      onClick={(event) => {
        event.stopPropagation();
        onOpen();
      }}
      className="rounded-ij-arc bg-ij-warn-bg px-1.5 font-ij-mono text-ij-island-meta text-ij-warn"
      data-mono-ok
      title={signalIds.join(', ')}
    >
      {count} diverge
    </button>
  );
}

export function ObjectTypeCard({ data, selected }: NodeProps<ObjectTypeFlowNode>) {
  const showDivergence = data.enforcement === 'warn' && data.divergenceCount > 0;
  const border = selected || data.isSelected ? 'border-ij-accent' : 'border-ij-seam';

  return (
    <article
      className={[
        'flex w-64 flex-col overflow-hidden rounded-ij-arc border bg-ij-raised font-ij-mono text-ij-ink shadow-none',
        border,
        data.system ? 'opacity-70' : '',
      ].filter(Boolean).join(' ')}
      onClick={() => data.onSelect({ kind: 'declared-type', key: data.id })}
      aria-label={`Declared type ${data.label}`}
    >
      <Handle type="target" position={Position.Left} isConnectable={false} />

      <header className="flex items-start gap-2 border-b border-ij-seam px-2 py-1.5">
        <RecordChip
          label={data.label}
          tint={data.tint.tint}
          ink={data.tint.ink}
          icon={data.icon ? <span aria-hidden="true">{data.icon}</span> : undefined}
        />
        <div className="ml-auto flex shrink-0 flex-wrap items-center justify-end gap-1">
          {data.recordCount !== undefined ? (
            <span className="text-ij-island-meta text-ij-ink-info" data-mono-ok>
              · {data.recordCount}
            </span>
          ) : null}
          <EnforcementChip enforcement={data.enforcement} />
          {showDivergence ? (
            <DivergenceBadge
              count={data.divergenceCount}
              signalIds={data.divergenceSignalIds}
              onOpen={() => data.onOpenDivergences()}
            />
          ) : null}
        </div>
      </header>

      <div className="flex flex-col gap-1 px-2 py-1.5">
        {data.relations.map((relation) => (
          <div key={relation.id} className="relative flex min-h-5 items-center gap-2">
            <Handle
              type="source"
              position={Position.Right}
              id={`rel:${relation.key}`}
              isConnectable={false}
            />
            <button
              type="button"
              className="flex min-h-5 flex-1 items-center gap-2 rounded-ij-arc px-1 text-left text-xs text-ij-ink-info hover:bg-ij-hover-surface"
              onClick={(event) => {
                event.stopPropagation();
                data.onSelect({ kind: 'declared-relation', key: relation.id });
              }}
            >
              <span className="truncate text-ij-ink">{relation.label}</span>
              <RecordChip
                label={relation.targetLabel}
                tint={relation.targetTint.tint}
                ink={relation.targetTint.ink}
                className="ml-auto shrink-0"
              />
            </button>
          </div>
        ))}

        <button
          type="button"
          className="flex min-h-5 items-center rounded-ij-arc px-1 text-left text-xs text-ij-ink-info hover:bg-ij-hover-surface"
          onClick={(event) => {
            event.stopPropagation();
            data.onToggleFields();
          }}
        >
          {data.expandedFields ? 'Hide fields' : `${data.scalarFields.length} fields`}
        </button>

        {data.expandedFields ? (
          <ul className="grid gap-0.5">
            {data.scalarFields.map((field) => (
              <li key={field.id}>
                <button
                  type="button"
                  className="flex w-full min-h-5 items-center gap-2 rounded-ij-arc px-1 text-left text-xs hover:bg-ij-hover-surface"
                  onClick={(event) => {
                    event.stopPropagation();
                    data.onSelect({ kind: 'declared-field', key: field.id });
                  }}
                >
                  <span className="truncate text-ij-ink">{field.label}</span>
                  <span className="ml-auto truncate text-ij-ink-info">
                    {formatFieldType(field.fieldType)}
                    {field.required ? ' *' : ''}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </div>

      {!data.expandedFields ? (
        <Handle
          type="source"
          position={Position.Right}
          id="card"
          isConnectable={false}
        />
      ) : null}
    </article>
  );
}
