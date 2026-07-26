'use client';

// SOURCING: ThreadView excerpt model + CS10 plan treatment. CH4: full-height
// scroll, measure column, pin-while-streaming, return-to-latest when unpinned.

import { useEffect, useRef, useState } from 'react';
import type { BlockHost } from '@commonplace/block-view/types';
import {
  MessagePrimitive,
  ThreadPrimitive,
} from '@assistant-ui/react';
import { MarkdownTextPrimitive } from '@assistant-ui/react-markdown';
import { useThreadStore, type AgentPlanStep } from '@/lib/thread-store';
import {
  scrollPinFromMetrics,
  shouldAutoScroll,
} from '@/lib/chat/scroll-pin';
import { ArtifactPart } from '@/components/chat/ArtifactPart';
import type { ChatArtifactPayload } from '@/lib/chat/project-types';
import { cn } from '@/lib/cn';
import { persistChatThread } from '@/lib/chat/catalog-client';

const MEASURE = 'max-w-[74ch] min-w-[68ch] w-[70ch] max-[900px]:min-w-0 max-[900px]:w-full';

function toneOf(status: string): string {
  if (status === 'running') return 'text-ij-ink-info animate-pulse';
  if (status === 'complete') return 'text-ij-ink';
  if (status === 'refused' || status === 'failed') return 'text-[color:var(--hue-status-failed)]';
  if (status === 'awaiting') return 'text-[color:var(--hue-status-awaiting)] animate-pulse';
  return 'text-ij-ink-disabled';
}

function InlinePlan({ steps }: { steps: readonly AgentPlanStep[] }) {
  const [open, setOpen] = useState(false);
  if (steps.length === 0) return null;
  return (
    <div data-agent-plan className={cn(MEASURE, 'mx-auto my-2')}>
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className="flex w-full items-center gap-2 text-left text-ij-ink-info hover:text-ij-ink"
        style={{ fontWeight: 'var(--rec-weight-cap)' }}
      >
        <span className="flex-1">Plan · {steps.length} steps</span>
        <span>{open ? 'Collapse' : 'Expand'}</span>
      </button>
      {open ? (
        <ol className="mt-2 grid gap-1">
          {steps.map((step) => (
            <li key={step.id} data-plan-status={step.status} className={toneOf(step.status)}>
              {step.label}
              {step.tool ? <span className="ml-2 font-ij-mono text-ij-ink-disabled">{step.tool}</span> : null}
            </li>
          ))}
        </ol>
      ) : null}
    </div>
  );
}

function UserTurn() {
  return (
    <MessagePrimitive.Root className={cn(MEASURE, 'mx-auto my-3')}>
      <div
        data-speaker="human"
        className="rounded-[var(--radius-control)] bg-ij-raised px-3 py-2 font-cp-human text-cp-human"
      >
        <MessagePrimitive.Content
          components={{
            Text: () => <MarkdownTextPrimitive />,
          }}
        />
      </div>
    </MessagePrimitive.Root>
  );
}

function AssistantTurn({
  host,
  artifacts,
}: {
  host: BlockHost;
  artifacts: readonly ChatArtifactPayload[];
}) {
  return (
    <MessagePrimitive.Root className={cn(MEASURE, 'mx-auto my-3')}>
      <div data-speaker="agent" className="px-1 font-cp-agent text-cp-agent">
        <MessagePrimitive.Content
          components={{
            Text: () => <MarkdownTextPrimitive />,
          }}
        />
        {artifacts.map((artifact, index) => (
          <ArtifactPart key={`${artifact.kind}-${index}`} host={host} artifact={artifact} />
        ))}
      </div>
    </MessagePrimitive.Root>
  );
}

export interface TranscriptProps {
  readonly host: BlockHost;
  readonly threadId: string | null;
  readonly initialScrollTop?: number;
  readonly artifactsByMessage?: Readonly<Record<string, readonly ChatArtifactPayload[]>>;
  readonly unreachable?: boolean;
}

export function Transcript({
  host,
  threadId,
  initialScrollTop = 0,
  artifactsByMessage = {},
  unreachable = false,
}: TranscriptProps) {
  const plan = useThreadStore((state) => state.plan);
  const isRunning = useThreadStore((state) => state.isRunning);
  const messageCount = useThreadStore((state) => state.messages.length);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const [pinned, setPinned] = useState(true);
  const [showReturn, setShowReturn] = useState(false);
  const restoredRef = useRef(false);

  useEffect(() => {
    const node = scrollRef.current;
    if (!node || restoredRef.current) return;
    node.scrollTop = initialScrollTop;
    restoredRef.current = true;
  }, [initialScrollTop]);

  useEffect(() => {
    const node = scrollRef.current;
    if (!node || !shouldAutoScroll(pinned, isRunning)) return;
    node.scrollTop = node.scrollHeight;
  }, [pinned, isRunning, messageCount]);

  const onScroll = () => {
    const node = scrollRef.current;
    if (!node) return;
    const next = scrollPinFromMetrics({
      scrollTop: node.scrollTop,
      clientHeight: node.clientHeight,
      scrollHeight: node.scrollHeight,
      streaming: isRunning,
    });
    setPinned(next.pinned);
    setShowReturn(next.showReturn);
    if (threadId) {
      void persistChatThread(threadId, { scrollTop: node.scrollTop }).catch(() => {});
    }
  };

  if (unreachable) {
    return (
      <div
        data-chat-transcript
        data-chat-unreachable
        className="flex h-full min-h-0 flex-1 items-center justify-center text-ij-ink-info"
        role="status"
      >
        The harness is unreachable. Reconnect to continue this thread.
      </div>
    );
  }

  return (
    <div className="relative flex h-full min-h-0 flex-1 flex-col">
      <div
        ref={scrollRef}
        data-chat-transcript
        className="min-h-0 flex-1 overflow-y-auto"
        onScroll={onScroll}
      >
        <ThreadPrimitive.Root className="mx-auto flex w-full flex-col px-4 py-6">
          <ThreadPrimitive.Empty>
            <p className={cn(MEASURE, 'mx-auto text-ij-ink-info')}>
              Start a thread in this project. Messages persist across reload.
            </p>
          </ThreadPrimitive.Empty>
          <ThreadPrimitive.Messages
            components={{
              UserMessage: UserTurn,
              AssistantMessage: () => <AssistantTurn host={host} artifacts={[]} />,
            }}
          />
          {plan.length > 0 ? <InlinePlan steps={plan} /> : null}
        </ThreadPrimitive.Root>
      </div>
      {showReturn ? (
        <button
          type="button"
          data-return-to-latest
          className="absolute bottom-4 left-1/2 -translate-x-1/2 rounded-[var(--radius-control)] border border-ij-control-border bg-ij-raised px-3 py-1.5 text-ij-ink shadow-sm"
          onClick={() => {
            const node = scrollRef.current;
            if (!node) return;
            node.scrollTop = node.scrollHeight;
            setPinned(true);
            setShowReturn(false);
          }}
        >
          Return to latest
        </button>
      ) : null}
      {/* artifactsByMessage reserved for promoted inline parts from the catalog */}
      {Object.keys(artifactsByMessage).length > 0 ? null : null}
    </div>
  );
}
