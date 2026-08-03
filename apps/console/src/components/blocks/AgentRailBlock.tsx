'use client';

// SOURCING: BlockShell docked rail (CS10).
// SPEC-COMMONPLACE-CHAT-SHELL-1.2 SH1: the chat rail does not embed input. It
// carries the run, its artifacts, the objects it touched, and the inspector
// ledger. Other hosts may opt into the runtime Composer explicitly.

import type { ChatArtifactPayload } from '@/lib/chat/project-types';
import type { ContextEntry } from '@/lib/chat/context-types';
import type { ViewRenderProps } from '@commonplace/block-view/types';
import { BlockShell } from '@/components/block/BlockShell';
import { useEffect, useRef, useState } from 'react';
import { useThreadStore, type AgentPlanStep } from '@/lib/thread-store';
import { submitThreadText } from '@/lib/thread-submit';

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
  artifacts = [],
  contextEntries = [],
  showComposer = false,
}: ViewRenderProps & {
  collapsed?: boolean;
  onToggleCollapse?: () => void;
  onOpenPlanInCanvas?: () => void;
  artifacts?: readonly ChatArtifactPayload[];
  contextEntries?: readonly ContextEntry[];
  /** The chat page owns the main composer; rail input is opt-in elsewhere. */
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
  };

  const included = contextEntries.filter((entry) => entry.included !== false);
  const touched = included.filter((entry) => !entry.unavailable);

  return (
    <BlockShell
      material="docked"
      dock="right"
      collapsed={collapsed}
      title="Runs"
      onToggleCollapse={toggle}
      className="w-full"
      style={{ width: collapsed ? 32 : undefined, maxWidth: 'var(--ij-agent-rail-max-w)' }}
    >
      <div
        className="flex h-full min-h-0 flex-col"
        data-agent-rail
        data-has-composer={showComposer ? 'true' : 'false'}
      >
        <div
          ref={scrollRef}
          className="min-h-0 flex-1 overflow-y-auto"
          onScroll={(event) => {
            scrollTopRef.current = event.currentTarget.scrollTop;
          }}
        >
          <section className="border-b border-ij-seam px-3 py-2" aria-label="Run">
            <p className="text-ij-ink-info" style={{ fontWeight: 'var(--rec-weight-cap)' }}>
              {isRunning ? 'Running' : 'Idle'}
            </p>
            {plan.length > 0 ? (
              <InlinePlan steps={plan} onOpenCanvas={openCanvas} />
            ) : (
              <p className="text-ij-ink-disabled">No active plan steps.</p>
            )}
          </section>

          <section className="border-b border-ij-seam px-3 py-2" aria-label="Artifacts">
            <p className="mb-1 text-ij-ink-info" style={{ fontWeight: 'var(--rec-weight-cap)' }}>
              Artifacts
            </p>
            {artifacts.length === 0 ? (
              <p className="text-ij-ink-disabled">None on this run.</p>
            ) : (
              <ul className="grid gap-1">
                {artifacts.map((artifact, index) => (
                  <li key={`${artifact.kind}-${index}`} className="text-ij-ink">
                    {artifact.kind}
                    {artifact.kind === 'markdown' ? ` · ${artifact.markdown.slice(0, 48)}` : null}
                    {artifact.kind === 'code' ? ` · ${artifact.language}` : null}
                    {artifact.kind === 'data-model' ? ` · ${artifact.title}` : null}
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="border-b border-ij-seam px-3 py-2" aria-label="Objects touched">
            <p className="mb-1 text-ij-ink-info" style={{ fontWeight: 'var(--rec-weight-cap)' }}>
              Objects
            </p>
            {touched.length === 0 ? (
              <p className="text-ij-ink-disabled">No context objects included.</p>
            ) : (
              <ul className="grid gap-1">
                {touched.map((entry) => (
                  <li key={entry.id} className="flex items-center gap-2 text-ij-ink">
                    <span className="min-w-0 flex-1 truncate">{entry.label}</span>
                    <span className="shrink-0 text-ij-ink-disabled">{entry.provenance}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="px-3 py-2" aria-label="Inspector">
            <p className="mb-1 text-ij-ink-info" style={{ fontWeight: 'var(--rec-weight-cap)' }}>
              Inspector
            </p>
            <ul className="grid gap-1 text-ij-ink-info">
              <li>messages: {messages.length}</li>
              <li>plan steps: {plan.length}</li>
              <li>context: {included.length} included</li>
            </ul>
          </section>
        </div>
        {showComposer ? (
          <form
            className="flex shrink-0 gap-2 border-t border-ij-seam p-2"
            onSubmit={(event) => {
              event.preventDefault();
              const form = event.currentTarget;
              const data = new FormData(form);
              const value = String(data.get('agent-rail-input') ?? '').trim();
              if (!value) return;
              void submitThreadText(value);
              form.reset();
            }}
          >
            <input
              name="agent-rail-input"
              aria-label="Agent rail message"
              className="h-ij-control min-w-0 flex-1 rounded-ij-arc border border-ij-control-border bg-ij-editor px-2 text-ij-ink"
              placeholder="Ask…"
            />
            <button
              type="submit"
              className="h-ij-control rounded-ij-arc border border-ij-control-border px-3 text-ij-ink hover:bg-ij-hover-surface"
            >
              Send
            </button>
          </form>
        ) : null}
        <footer
          data-agent-ledger
          className="flex h-ij-statusbar shrink-0 items-center gap-3 border-t border-ij-seam px-2 text-ij-ink-info"
        >
          <span>context: {included.length > 0 ? `${included.length}` : 'unavailable'}</span>
          <span>spend: unavailable</span>
          <span>{isRunning ? 'budget: running' : 'budget: idle'}</span>
        </footer>
      </div>
    </BlockShell>
  );
}
