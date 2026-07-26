'use client';

// SOURCING: @assistant-ui/react (thread primitives) plus hand-roll for the
// docked rail contract. SPEC-COMMONPLACE-CONSOLE-SHELL-1.0 CS10: one transcript
// column, docked right, collapsible to 32. Plan renders inline. Step status is
// name treatment, never a progress fraction.

import { useEffect, useRef, useState } from 'react';
import type { ViewRenderProps } from '@commonplace/block-view/types';
import { BlockShell } from '@/components/block/BlockShell';
import { Composer } from '@/components/composer/Composer';
import { useThreadStore, type AgentPlanStep } from '@/lib/thread-store';
import { markViewDirty } from '@/lib/surface-object';

type StepTone = AgentPlanStep['status'] | 'awaiting' | 'failed' | 'done';

function toneOf(status: string): StepTone {
  if (status === 'complete') return 'done';
  if (status === 'refused') return 'failed';
  if (status === 'running' || status === 'pending' || status === 'awaiting' || status === 'failed') {
    return status as StepTone;
  }
  return 'pending';
}

function stepClass(status: string): string {
  const tone = toneOf(status);
  switch (tone) {
    case 'running':
      return 'text-ij-ink-info animate-pulse';
    case 'done':
      return 'text-ij-ink';
    case 'awaiting':
      return 'text-[color:var(--hue-status-awaiting)] animate-pulse';
    case 'failed':
      return 'text-[color:var(--hue-status-failed)]';
    case 'pending':
    default:
      return 'text-ij-ink-disabled';
  }
}

function InlinePlan({
  steps,
  onOpenCanvas,
}: {
  steps: readonly AgentPlanStep[];
  onOpenCanvas: () => void;
}) {
  if (steps.length === 0) return null;
  return (
    <section data-agent-plan aria-label="Agent plan" className="mx-2 my-2">
      <div className="mb-1 flex items-center gap-2 text-ij-ink" style={{ fontWeight: 'var(--rec-weight-cap)' }}>
        <span className="flex-1">Plan</span>
        <button
          type="button"
          onClick={onOpenCanvas}
          className="h-ij-control rounded-[var(--radius-control)] border border-ij-control-border px-2 text-ij-ink-info hover:bg-ij-hover-surface hover:text-ij-ink"
        >
          Open in canvas
        </button>
      </div>
      <ol className="grid gap-1">
        {steps.map((step) => (
          <li key={step.id} data-plan-status={step.status} data-status-hue className={stepClass(step.status)}>
            {step.label}
            {step.tool ? <span className="ml-2 font-ij-mono text-ij-ink-disabled">{step.tool}</span> : null}
          </li>
        ))}
      </ol>
    </section>
  );
}

export function AgentRailBlock({
  host,
  collapsed: collapsedProp,
  onToggleCollapse,
  onOpenPlanInCanvas,
  showComposer = true,
}: ViewRenderProps & {
  collapsed?: boolean;
  onToggleCollapse?: () => void;
  onOpenPlanInCanvas?: () => void;
  /** Chat page owns the main composer; hide the shell Composer there. */
  showComposer?: boolean;
}) {
  const messages = useThreadStore((state) => state.messages);
  const plan = useThreadStore((state) => state.plan);
  const isRunning = useThreadStore((state) => state.isRunning);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const scrollTopRef = useRef(0);
  const [uncontrolledCollapsed, setUncontrolledCollapsed] = useState(collapsedProp ?? false);
  const collapsed = collapsedProp ?? uncontrolledCollapsed;

  useEffect(() => {
    const node = scrollRef.current;
    if (!node || collapsed) return;
    node.scrollTop = scrollTopRef.current;
  }, [collapsed, messages.length]);

  const toggle = () => {
    const node = scrollRef.current;
    if (node) scrollTopRef.current = node.scrollTop;
    if (collapsedProp === undefined) setUncontrolledCollapsed(!collapsed);
    onToggleCollapse?.();
  };

  const openCanvas = () => {
    onOpenPlanInCanvas?.();
    markViewDirty('view-chat');
  };

  return (
    <BlockShell
      material="docked"
      dock="right"
      collapsed={collapsed}
      title="Agent"
      onToggleCollapse={toggle}
      className="w-full"
      style={{ width: collapsed ? 32 : undefined, maxWidth: 'var(--ij-agent-rail-max-w)' }}
    >
      <div className="flex h-full min-h-0 flex-col">
        <div
          ref={scrollRef}
          className="min-h-0 flex-1 overflow-y-auto"
          onScroll={(event) => {
            scrollTopRef.current = event.currentTarget.scrollTop;
          }}
        >
          {messages.map((message) => (
            <div key={message.id} className="px-3 py-2">
              <div
                data-speaker={message.role === 'user' ? 'human' : 'agent'}
                className={
                  message.role === 'user'
                    ? 'rounded-[var(--radius-control)] bg-ij-raised px-3 py-2 font-cp-human text-cp-human'
                    : 'px-1 font-cp-agent text-cp-agent'
                }
              >
                {message.parts.map((part, index) => (
                  <p key={`${message.id}-${index}`}>{part.text}</p>
                ))}
              </div>
              {message.role === 'user' ? (
                <InlinePlan steps={plan} onOpenCanvas={openCanvas} />
              ) : null}
            </div>
          ))}
          {isRunning && plan.length > 0 && messages.at(-1)?.role !== 'user' ? (
            <InlinePlan steps={plan} onOpenCanvas={openCanvas} />
          ) : null}
        </div>
        <div className="shrink-0 border-t border-ij-seam p-2">
          <Composer host={host} compact />
        </div>
        <footer
          data-agent-ledger
          className="flex h-ij-statusbar shrink-0 items-center gap-3 border-t border-ij-seam px-2 text-ij-ink-info"
        >
          {/* Ledger fields are rendered only when the substrate emits them.
              Until then, report absence honestly instead of inventing a fraction. */}
          <span>context: unavailable</span>
          <span>spend: unavailable</span>
          <span>{isRunning ? 'budget: running' : 'budget: idle'}</span>
        </footer>
      </div>
    </BlockShell>
  );
}
