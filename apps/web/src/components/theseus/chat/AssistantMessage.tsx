'use client';

import {
  ActionBarPrimitive,
  ActionBarMorePrimitive,
  AuiIf,
  ErrorPrimitive,
  MessagePrimitive,
  useMessage,
} from '@assistant-ui/react';
import { MarkdownText } from '@/components/assistant-ui/markdown-text';
import { ToolFallback } from '@/components/assistant-ui/tool-fallback';
import { TooltipIconButton } from '@/components/assistant-ui/tooltip-icon-button';
import { Reasoning, ReasoningGroup } from '@/components/assistant-ui/reasoning';
import { cn } from '@/lib/utils';
import { useWaitTier } from '@/lib/commonplace-wait-tier';
import { narrationFor } from '@/lib/commonplace-wait-narration';
import { WeaveSpinner } from '@/components/WeaveSpinner';
import {
  CheckIcon,
  CopyIcon,
  DownloadIcon,
  MoreHorizontalIcon,
  RefreshCwIcon,
} from '@/lib/icons';
import type { FC } from 'react';
import type { TheseusMessageMetadata } from '@/lib/theseus-assistant-runtime';

const BRAILLE_FRAMES = ['⣾', '⣽', '⣻', '⢿', '⡿', '⣟', '⣯', '⣷'];

function StageLabel({ label }: { label: string }) {
  if (!label) return null;
  return (
    <div
      className="aui-stage-label"
      style={{
        marginTop: 6,
        fontFamily: 'var(--font-mono)',
        fontSize: 10,
        letterSpacing: '0.12em',
        textTransform: 'uppercase',
        color: 'var(--color-ink-light)',
      }}
    >
      <span
        aria-hidden="true"
        style={{
          marginRight: 8,
          color: 'var(--color-terracotta)',
          display: 'inline-block',
          animation: 'aui-braille-spin 900ms steps(8) infinite',
        }}
      >
        {BRAILLE_FRAMES[0]}
      </span>
      {label}
    </div>
  );
}

/**
 * Assistant-side message. Forked from the Claude-clone composition with
 * Theseus tuning: serif body (Vollkorn) on parchment, a Courier Prime
 * stage label + braille spinner while streaming, and the action bar
 * (copy, refresh, export) that the Claude clone ships with.
 */
const AssistantMessage: FC = () => {
  // reserves space for action bar and compensates with -mb for consistent msg spacing
  const ACTION_BAR_PT = 'pt-1.5';
  const ACTION_BAR_HEIGHT = `-mb-7.5 min-h-7.5 ${ACTION_BAR_PT}`;

  return (
    <MessagePrimitive.Root
      data-slot="aui_assistant-message-root"
      data-role="assistant"
      className="aui-assistant-message fade-in slide-in-from-bottom-1 relative animate-in duration-150"
    >
      <div
        data-slot="aui_assistant-message-content"
        className="wrap-break-word px-2 leading-relaxed"
      >
        <MessagePrimitive.Parts
          components={{
            Text: MarkdownText,
            Reasoning,
            ReasoningGroup,
            tools: { Fallback: ToolFallback },
          }}
        />
        <StreamingFooter />
        <MessageError />
      </div>

      <div
        data-slot="aui_assistant-message-footer"
        className={cn('ml-2 flex items-center', ACTION_BAR_HEIGHT)}
      >
        <AssistantActionBar />
      </div>
    </MessagePrimitive.Root>
  );
};

/**
 * Streaming footer, refined through the wait-tier ladder (WL-4).
 *
 *   streaming, no token yet  -> PreStreamWait (T0 nothing, T1 micro stage
 *                               label, T2 WeaveSpinner + narrated line at 2s)
 *   streaming, tokens flowing -> the stage label, as before
 *   finished                  -> the client-observed TTFT usage receipt, if one
 *                               was measured for this request (WL-4c)
 */
function StreamingFooter() {
  const metadata = useMessage((m) => m.metadata);
  const custom = (metadata?.custom ?? {}) as Partial<TheseusMessageMetadata>;

  if (custom.isStreaming) {
    if (custom.hasStreamedText) {
      return <StageLabel label={custom.stageLabel ?? 'Composing'} />;
    }
    return (
      <PreStreamWait
        startedAt={custom.startedAt}
        stageLabel={custom.stageLabel}
        narrationStep={custom.narrationStep ?? 0}
      />
    );
  }

  return <UsageReceiptLine receipt={custom.usageReceipt ?? null} />;
}

/**
 * Pre-first-token wait state. The tier promotes on real elapsed time via
 * useWaitTier (no fabricated activity): T1 shows the same Courier stage label
 * as a micro-state, T2 escalates to the WeaveSpinner plus one narrated line
 * pulled from the WL-2 inventory at the current pipeline step.
 */
function PreStreamWait({
  startedAt,
  stageLabel,
  narrationStep,
}: {
  startedAt?: number;
  stageLabel?: string;
  narrationStep: number;
}) {
  const tier = useWaitTier(true, startedAt);
  if (tier === 'T0') return null;
  if (tier === 'T1') return <StageLabel label={stageLabel || 'Working'} />;
  return (
    <div
      className="aui-prestream-wait"
      role="status"
      aria-label={stageLabel || 'Thinking'}
      style={{
        marginTop: 8,
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        fontFamily: 'var(--font-mono)',
        fontSize: 10,
        letterSpacing: '0.12em',
        textTransform: 'uppercase',
        color: 'var(--color-ink-light)',
      }}
    >
      <WeaveSpinner size="compact" />
      <span>{narrationFor('thinking', narrationStep)}</span>
    </div>
  );
}

/** The finished request's client-observed TTFT, keyed by provider route. */
function UsageReceiptLine({ receipt }: { receipt: TheseusMessageMetadata['usageReceipt'] }) {
  if (!receipt) return null;
  return (
    <div
      className="aui-usage-receipt"
      title={`${receipt.provider} via ${receipt.route}`}
      style={{
        marginTop: 6,
        fontFamily: 'var(--font-mono)',
        fontSize: 10,
        letterSpacing: '0.08em',
        color: 'var(--color-ink-light)',
      }}
    >
      {`first token ${Math.round(receipt.ttftMs)} ms`}
    </div>
  );
}

const MessageError: FC = () => {
  return (
    <MessagePrimitive.Error>
      <ErrorPrimitive.Root
        className="aui-message-error-root mt-2 rounded-md border p-3 text-sm"
        style={{
          borderColor: 'color-mix(in srgb, var(--color-error) 40%, transparent)',
          background: 'color-mix(in srgb, var(--color-error) 8%, transparent)',
          color: 'var(--color-error)',
        }}
      >
        <ErrorPrimitive.Message className="aui-message-error-message line-clamp-2" />
      </ErrorPrimitive.Root>
    </MessagePrimitive.Error>
  );
};

const AssistantActionBar: FC = () => {
  return (
    <ActionBarPrimitive.Root
      hideWhenRunning
      autohide="not-last"
      className="aui-assistant-action-bar-root col-start-3 row-start-2 -ml-1 flex gap-1"
      style={{ color: 'var(--color-ink-muted)' }}
    >
      <ActionBarPrimitive.Copy asChild>
        <TooltipIconButton tooltip="Copy">
          <AuiIf condition={(s) => s.message.isCopied}>
            <CheckIcon />
          </AuiIf>
          <AuiIf condition={(s) => !s.message.isCopied}>
            <CopyIcon />
          </AuiIf>
        </TooltipIconButton>
      </ActionBarPrimitive.Copy>
      <ActionBarPrimitive.Reload asChild>
        <TooltipIconButton tooltip="Refresh">
          <RefreshCwIcon />
        </TooltipIconButton>
      </ActionBarPrimitive.Reload>
      <ActionBarMorePrimitive.Root>
        <ActionBarMorePrimitive.Trigger asChild>
          <TooltipIconButton
            tooltip="More"
            className="data-[state=open]:bg-accent"
          >
            <MoreHorizontalIcon />
          </TooltipIconButton>
        </ActionBarMorePrimitive.Trigger>
        <ActionBarMorePrimitive.Content
          side="bottom"
          align="start"
          className="aui-action-bar-more-content z-50 min-w-32 overflow-hidden rounded-md border bg-popover p-1 text-popover-foreground shadow-md"
        >
          <ActionBarPrimitive.ExportMarkdown asChild>
            <ActionBarMorePrimitive.Item className="aui-action-bar-more-item flex cursor-pointer select-none items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground">
              <DownloadIcon className="size-4" />
              Export as Markdown
            </ActionBarMorePrimitive.Item>
          </ActionBarPrimitive.ExportMarkdown>
        </ActionBarMorePrimitive.Content>
      </ActionBarMorePrimitive.Root>
    </ActionBarPrimitive.Root>
  );
};

export default AssistantMessage;
