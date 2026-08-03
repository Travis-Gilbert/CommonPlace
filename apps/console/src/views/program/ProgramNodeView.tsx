'use client';

// SOURCING: @xyflow/react Handle + catalog-driven one renderer (PG4). React Flow UI
// base-node anatomy adapted under console tokens; one component for every CatalogEntry.

import { memo } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import {
  CheckCircledIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  CodeIcon,
  DotFilledIcon,
  ExitIcon,
  EyeOpenIcon,
  LayersIcon,
  LightningBoltIcon,
  QuestionMarkCircledIcon,
  StackIcon,
} from '@radix-ui/react-icons';
import type {
  CatalogEntry,
  CatalogLifecycle,
  ProcessLiveness,
  ProgramNodeKind,
} from '@commonplace/program-contracts';

export type ProgramNodeData = {
  readonly label: string;
  readonly catalogId: string;
  readonly kind: ProgramNodeKind['kind'];
  readonly inputs: readonly { id: string; shape: string }[];
  readonly outputs: readonly { id: string; shape: string }[];
  readonly liveness?: ProcessLiveness;
  readonly lifecycle?: CatalogLifecycle;
  readonly pinned?: boolean;
  readonly stale?: boolean;
  readonly eventLabel?: string;
  readonly collapsed?: boolean;
  readonly refusal?: string;
  readonly catalog?: CatalogEntry;
  readonly bypassed?: boolean;
  readonly muted?: boolean;
  readonly groupId?: string;
  readonly onToggleCollapsed?: () => void;
};

function KindIcon({ kind }: { readonly kind: ProgramNodeKind['kind'] }) {
  switch (kind) {
    case 'source':
      return <DotFilledIcon />;
    case 'sentinel':
      return <EyeOpenIcon />;
    case 'rule':
      return <CodeIcon />;
    case 'stochastic':
      return <LightningBoltIcon />;
    case 'verify':
      return <CheckCircledIcon />;
    case 'fold':
      return <LayersIcon />;
    case 'sink':
      return <ExitIcon />;
    case 'human_input':
      return <QuestionMarkCircledIcon />;
    case 'compound':
      return <StackIcon />;
  }
}

function ProgramNodeViewInner({ data, selected }: NodeProps) {
  const node = data as unknown as ProgramNodeData;
  const ring =
    node.liveness === 'running'
      ? 'ring-2 ring-ij-accent'
      : node.liveness === 'refused' || node.liveness === 'failed'
        ? 'ring-2 ring-ij-warn'
        : selected
          ? 'ring-1 ring-ij-accent'
          : '';

  return (
    <article
      className={[
        'min-w-44 rounded-ij-arc border border-ij-seam bg-ij-raised text-ij-ink shadow-none',
        ring,
        node.bypassed || node.muted ? 'opacity-50' : '',
      ].filter(Boolean).join(' ')}
      data-program-node={node.catalogId}
      aria-label={node.label}
    >
      <header className="flex items-center gap-2 border-b border-ij-seam px-2 py-1.5">
        <span className="text-ij-ink-info" aria-hidden="true">
          <KindIcon kind={node.kind} />
        </span>
        <span className="truncate text-sm" style={{ fontWeight: 'var(--rec-weight-cap)' as never }}>
          {node.label}
        </span>
        <button
          type="button"
          className="nodrag ml-auto h-5 rounded-ij-arc px-1 font-ij-mono text-xs text-ij-ink-info hover:bg-ij-hover-surface"
          aria-label={node.collapsed ? `Expand ${node.label}` : `Collapse ${node.label}`}
          onClick={node.onToggleCollapsed}
        >
          {node.collapsed ? <ChevronRightIcon /> : <ChevronDownIcon />}
        </button>
        {node.liveness ? (
          <span className="font-ij-mono text-xs text-ij-ink-info" data-mono-ok>
            {node.liveness}
          </span>
        ) : null}
      </header>
      {!node.collapsed ? (
        <div className="relative px-2 py-2">
          {node.inputs.map((port, index) => (
            <div key={port.id} className="relative flex items-center py-0.5 text-xs text-ij-ink-info">
              <Handle
                type="target"
                position={Position.Left}
                id={port.id}
                style={{ top: 12 + index * 18 }}
              />
              <span className="pl-2 font-ij-mono" data-mono-ok>{port.id}</span>
            </div>
          ))}
          {node.outputs.map((port, index) => (
            <div key={port.id} className="relative flex items-center justify-end py-0.5 text-xs text-ij-ink-info">
              <span className="pr-2 font-ij-mono" data-mono-ok>{port.id}</span>
              <Handle
                type="source"
                position={Position.Right}
                id={port.id}
                style={{ top: 12 + index * 18 }}
              />
            </div>
          ))}
          {node.catalog ? (
            <div className="mt-1 flex flex-wrap gap-1 border-t border-ij-seam pt-1 font-ij-mono text-xs text-ij-ink-info" data-mono-ok>
              <span>{node.catalog.fit_state}</span>
              {node.lifecycle && node.lifecycle !== 'stable' ? (
                <span className={node.lifecycle === 'legacy' ? 'text-ij-warn' : 'text-ij-gold'}>
                  {node.lifecycle}
                </span>
              ) : null}
              {node.pinned ? <span className="text-ij-gold">pinned</span> : null}
              {node.stale ? <span className="text-ij-warn">stale</span> : null}
            </div>
          ) : null}
          {node.eventLabel ? (
            <p className="mt-1 truncate font-ij-mono text-xs text-ij-ink-info" data-mono-ok>
              {node.eventLabel}
            </p>
          ) : null}
          {node.refusal ? (
            <p className="mt-1 text-xs text-ij-warn">{node.refusal}</p>
          ) : null}
        </div>
      ) : null}
    </article>
  );
}

export const ProgramNodeView = memo(ProgramNodeViewInner);
