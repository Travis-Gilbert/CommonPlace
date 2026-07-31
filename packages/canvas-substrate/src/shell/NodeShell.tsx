'use client';

// SOURCING: @xyflow/react Handle/Position — vendor the connection primitives;
// the surrounding chrome is the substrate's own shell (issue 144 A).
//
// This file is the one component every node kind renders through. It must not
// learn about kinds: everything it draws comes from `NodeShellModel`, which the
// kind produced. If adding a kind ever requires an edit here, the contract in
// kinds/types.ts was too narrow and that is what should grow instead.

import { memo, type ReactNode } from 'react';
import { Handle, Position } from '@xyflow/react';
import type {
  NodeBadge,
  NodeShellModel,
  NodeKindBodyProps,
  SubstratePort,
  WidgetRenderer,
} from '../kinds/types';
import { familyStroke } from '../edges/law';
import { PortRow } from './PortRow';

const TONE_CLASS: Record<NonNullable<NodeBadge['tone']>, string> = {
  neutral: 'text-ij-ink-info',
  info: 'text-ij-ink-info',
  ok: 'text-ij-ok',
  warn: 'text-ij-warn',
  error: 'text-ij-error',
  accent: 'text-ij-accent',
  gold: 'text-ij-gold',
};

function Badge({ badge }: { readonly badge: NodeBadge }) {
  const tone = TONE_CLASS[badge.tone ?? 'neutral'];
  return (
    <span
      className={[
        'rounded-ij-arc bg-ij-row-gray px-1.5 py-0.5 text-xs',
        tone,
        badge.mono ? 'font-ij-mono' : 'font-semibold uppercase tracking-wide',
      ].join(' ')}
      title={badge.title}
      {...(badge.mono ? { 'data-mono-ok': true } : {})}
      data-substrate-badge={badge.id}
    >
      {badge.text}
    </span>
  );
}

/**
 * The status ring is deliberately not the only selection signal: the contrast
 * gate's rule D3 requires a selected state to differ on at least two of
 * fill / keyline / edge / type-weight. Selection here moves the keyline colour
 * *and* the border width, and the header title gains weight.
 */
function ringClass(model: NodeShellModel, selected: boolean): string {
  if (model.status === 'running') return 'ring-2 ring-ij-accent';
  if (model.status === 'refused' || model.status === 'failed') return 'ring-2 ring-ij-warn';
  return selected ? 'ring-1 ring-ij-accent' : '';
}

export interface NodeShellProps<TData> {
  readonly nodeId: string;
  readonly model: NodeShellModel;
  readonly data: TData;
  readonly selected: boolean;
  readonly Body?: React.ComponentType<NodeKindBodyProps<TData>>;
  readonly Widget?: WidgetRenderer;
  /** Ports the layout document says this reader has hidden. */
  readonly hiddenPorts?: ReadonlySet<string>;
}

/**
 * Families this node's inputs accept, as an attribute-selector-friendly list.
 * Undefined when nothing is declared, so a node that says nothing about its
 * ports never dims -- silence is not a refusal.
 */
function acceptedFamilies(ports: readonly SubstratePort[]): string | undefined {
  const families = new Set(
    ports
      .filter((port) => port.side === 'target' && port.connectable !== false)
      .flatMap((port) => (port.family ? [port.family] : [])),
  );
  return families.size > 0 ? [...families].join(' ') : undefined;
}

function FrameShell({ model }: { readonly model: NodeShellModel }) {
  return (
    <div
      className="pointer-events-none h-full w-full rounded-ij-arc border border-dashed border-ij-seam-raised bg-ij-row-gray/30"
      data-substrate-frame={model.kindId}
    >
      <span className="pointer-events-auto inline-block px-2 py-1 text-xs font-semibold uppercase tracking-wide text-ij-ink-info">
        {model.title}
      </span>
    </div>
  );
}

function NodeShellInner<TData>({
  nodeId,
  model,
  data,
  selected,
  Body,
  Widget,
  hiddenPorts,
}: NodeShellProps<TData>) {
  if (model.frame) return <FrameShell model={model} />;

  const dimmed = Boolean(model.flags?.bypassed || model.flags?.muted);
  const ports = (model.ports ?? []).filter((port) => !hiddenPorts?.has(port.id));
  const primary = ports.filter((port) => (port.section ?? 'primary') === 'primary');
  const advanced = ports.filter((port) => port.section === 'advanced');
  const showAdvanced = Boolean(model.advancedOpen);

  return (
    <article
      className={[
        'relative select-none rounded-ij-arc border bg-ij-raised font-ij-ui text-ij-ink',
        model.ghost
          ? 'border-dashed border-ij-ink-disabled'
          : selected
            ? 'border-ij-accent'
            : 'border-ij-seam hover:border-ij-control-border',
        ringClass(model, selected),
        dimmed ? 'opacity-50' : '',
      ]
        .filter(Boolean)
        .join(' ')}
      style={model.width ? { width: model.width } : undefined}
      data-substrate-node={model.kindId}
      data-port-families={acceptedFamilies(ports)}
      data-bypassed={model.flags?.bypassed ? 'true' : undefined}
      data-muted={model.flags?.muted ? 'true' : undefined}
      data-ghost={model.ghost ? 'true' : undefined}
      aria-label={model.title}
    >
      <header className="flex items-center gap-2 border-b border-ij-seam px-2 py-1.5">
        {model.accent ? (
          <span className="min-h-4 w-1 shrink-0 self-stretch rounded-ij-arc-underline bg-ij-graph" />
        ) : null}
        {model.icon ? (
          <span className="shrink-0 text-ij-ink-info" aria-hidden="true">
            {model.icon}
          </span>
        ) : null}
        <span
          className={[
            'min-w-0 flex-1 truncate text-sm',
            selected ? 'font-semibold' : 'font-medium',
          ].join(' ')}
          title={model.title}
        >
          {model.title}
        </span>
        {model.idBadge ? (
          <span
            className="shrink-0 font-ij-mono text-xs text-ij-ink-disabled"
            data-mono-ok
            data-substrate-id-badge
            title={nodeId}
          >
            {model.idBadge}
          </span>
        ) : null}
        {model.onToggleCollapsed ? (
          <button
            type="button"
            className="nodrag h-ij-control shrink-0 rounded-ij-arc px-1 text-xs text-ij-ink-info hover:bg-ij-hover-surface"
            aria-label={model.collapsed ? `Expand ${model.title}` : `Collapse ${model.title}`}
            aria-expanded={!model.collapsed}
            onClick={(event) => {
              event.stopPropagation();
              model.onToggleCollapsed?.();
            }}
          >
            {model.collapsed ? '+' : '−'}
          </button>
        ) : null}
      </header>

      {model.badges?.length || model.statusLabel ? (
        <div className="flex flex-wrap items-center gap-1 px-2 py-1">
          {model.badges?.map((badge) => <Badge key={badge.id} badge={badge} />)}
          {model.statusLabel ? (
            <span className="font-ij-mono text-xs text-ij-ink-info" data-mono-ok>
              {model.statusLabel}
            </span>
          ) : null}
        </div>
      ) : null}

      {model.flags && model.onToggleFlag ? (
        <div className="flex gap-1 px-2 pb-1">
          <FlagButton
            active={Boolean(model.flags.bypassed)}
            label="Bypass"
            activeLabel="Bypassed"
            onToggle={() => model.onToggleFlag?.('bypassed')}
          />
          <FlagButton
            active={Boolean(model.flags.muted)}
            label="Mute"
            activeLabel="Muted"
            onToggle={() => model.onToggleFlag?.('muted')}
          />
        </div>
      ) : null}

      {!model.collapsed ? (
        <div className="px-2 pb-2">
          {primary.map((port) => (
            <PortRow key={port.id} port={port} Widget={Widget} />
          ))}

          {advanced.length > 0 ? (
            <>
              <button
                type="button"
                className="nodrag mt-1 flex w-full items-center justify-center gap-1 border-t border-ij-seam pt-1 text-xs text-ij-accent hover:bg-ij-hover-surface"
                aria-expanded={showAdvanced}
                onClick={(event) => {
                  event.stopPropagation();
                  model.onToggleAdvanced?.();
                }}
              >
                {showAdvanced
                  ? 'Hide advanced'
                  : `${advanced.length} advanced input${advanced.length > 1 ? 's' : ''}`}
              </button>
              {showAdvanced
                ? advanced.map((port) => (
                    <PortRow key={port.id} port={port} Widget={Widget} />
                  ))
                : null}
            </>
          ) : null}

          {Body ? (
            <Body nodeId={nodeId} data={data} selected={selected} Widget={Widget} />
          ) : null}
        </div>
      ) : (
        // A collapsed node still has to be connectable, or collapsing would
        // silently drop every edge anchor it owns.
        <CollapsedHandles ports={ports} />
      )}
    </article>
  );
}

function FlagButton({
  active,
  label,
  activeLabel,
  onToggle,
}: {
  readonly active: boolean;
  readonly label: string;
  readonly activeLabel: string;
  readonly onToggle: () => void;
}) {
  return (
    <button
      type="button"
      className={[
        'nodrag h-ij-control rounded-ij-arc border px-2 text-xs',
        active
          ? 'border-ij-accent text-ij-accent'
          : 'border-ij-control-border text-ij-ink-info hover:bg-ij-hover-surface',
      ].join(' ')}
      aria-pressed={active}
      onClick={(event) => {
        event.stopPropagation();
        onToggle();
      }}
    >
      {active ? activeLabel : label}
    </button>
  );
}

/**
 * A collapsed node still has to be connectable, and each port has to stay
 * individually reachable: stacking every handle at one offset means only the
 * topmost is clickable and no reader can tell which wire belongs to which port.
 * Handles fan down each side at a tight pitch, so the node keeps its collapsed
 * silhouette while every port keeps its own target.
 */
const COLLAPSED_HANDLE_TOP = 14;
const COLLAPSED_HANDLE_PITCH = 9;

function CollapsedHandles({ ports }: { readonly ports: readonly SubstratePort[] }) {
  let targets = 0;
  let sources = 0;
  return (
    <>
      {ports.map((port) => {
        const index = port.side === 'target' ? targets++ : sources++;
        return (
          <Handle
            key={port.id}
            type={port.side}
            position={port.side === 'target' ? Position.Left : Position.Right}
            id={port.id}
            isConnectable={port.connectable !== false}
            title={port.label ?? port.id}
            style={{
              top: COLLAPSED_HANDLE_TOP + index * COLLAPSED_HANDLE_PITCH,
              background: port.family ? familyStroke(port.family) : 'var(--ij-editor)',
              borderColor: 'var(--ij-accent)',
            }}
          />
        );
      })}
    </>
  );
}

export const NodeShell = memo(NodeShellInner) as typeof NodeShellInner;
