'use client';

// SOURCING: HANDOFF-CONSOLE-CHAT-SURFACE choice 5 (Zed multibuffer excerpts).
// Sticky header + collapsible body. Tool receipts default collapsed.
// Texture stays Deterministic until FORME DischargeState lands
// (docs/plans/console-chat-surface/FOLLOWUP-FORME-DISCHARGE-TEXTURE.md).

import { useId, useState, type ReactNode } from 'react';

export type ExcerptKind = 'human' | 'agent' | 'tool' | 'object' | 'plan';

export function ThreadExcerpt({
  kind,
  speaker,
  timestamp,
  summary,
  defaultCollapsed = false,
  excerptId,
  children,
  actions,
}: {
  readonly kind: ExcerptKind;
  readonly speaker: string;
  readonly timestamp?: string;
  readonly summary?: string;
  readonly defaultCollapsed?: boolean;
  readonly excerptId: string;
  readonly children: ReactNode;
  readonly actions?: ReactNode;
}) {
  const [collapsed, setCollapsed] = useState(defaultCollapsed);
  const panelId = useId();
  const face =
    kind === 'human'
      ? 'font-cp-human text-cp-human'
      : kind === 'agent'
        ? 'font-cp-agent text-cp-agent'
        : 'font-ij-ui text-ij-ink';

  return (
    <section
      id={excerptId}
      data-thread-excerpt={kind}
      data-excerpt-collapsed={collapsed ? 'true' : 'false'}
      className="border-b border-ij-seam bg-ij-raised last:border-b-0"
      style={{ borderRadius: 'var(--ij-radius-md)' }}
    >
      <header
        className="sticky top-0 z-10 flex items-center gap-2 border-b border-ij-seam bg-ij-raised px-3 font-ij-mono text-ij-ink-info"
        style={{
          height: 'var(--ij-excerpt-header-h)',
          fontSize: 'var(--ij-excerpt-header-font-size)',
        }}
      >
        <button
          type="button"
          aria-expanded={!collapsed}
          aria-controls={panelId}
          data-excerpt-toggle
          onClick={() => setCollapsed((value) => !value)}
          className="inline-flex min-w-0 flex-1 items-center gap-2 text-left hover:text-ij-ink"
        >
          <span data-excerpt-speaker className="truncate text-ij-ink">
            {speaker}
          </span>
          {timestamp ? (
            <span data-excerpt-time className="shrink-0 text-ij-ink-disabled">
              {timestamp}
            </span>
          ) : null}
          <span className="ml-auto shrink-0" aria-hidden="true">
            {collapsed ? '+' : '−'}
          </span>
        </button>
        {actions}
      </header>
      {collapsed ? (
        summary ? (
          <p
            data-excerpt-summary
            className="truncate px-3 py-1 text-ij-ink-info"
            style={{ fontSize: 'var(--ij-chat-chip-font-size)' }}
          >
            {summary}
          </p>
        ) : null
      ) : (
        <div id={panelId} data-excerpt-body className={`px-3 py-2 ${face}`}>
          {children}
        </div>
      )}
    </section>
  );
}
