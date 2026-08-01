'use client';

// SOURCING: @assistant-ui/react Thread/Message primitives + HANDOFF-CONSOLE-CHAT-SURFACE
// multibuffer model. Bubbles retired: turns, tools, and objects are excerpts.
// Composer unavailable notice lives only in the composer status slot.

import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import type { BlockHost, ObjectRef } from '@commonplace/block-view/types';
import { extractTheoremAddress, theoremUri } from '@commonplace/block-view/addressing';
import {
  MessagePrimitive,
  ThreadPrimitive,
  useMessage,
  type ToolCallMessagePartProps,
} from '@assistant-ui/react';
import { MarkdownTextPrimitive } from '@assistant-ui/react-markdown';
import { motion } from 'motion/react';
import { getToolMeta } from '@/components/chat/toolMeta';
import { ReceiptJson } from '@/components/receipt-json';
import { PresenceMark } from '@/components/mark/PresenceMark';
import { useShellStore, type ConnectionState } from '@/lib/shell-store';
import { useThreadStore, chatEndpoint, type AgentPlanStep } from '@/lib/thread-store';
import { submitThreadText } from '@/lib/thread-submit';
import { EASE_OUT, seconds, useMotionDurations } from '@/motion/motion-tokens';
import { ObjectExcerpt } from './thread/ObjectExcerpt';
import { ThreadExcerpt } from './thread/ThreadExcerpt';

import { Composer, NEW_LINE_HINT } from '@/components/chat/RuntimeComposer';
import { reducedFromMissing } from '@/lib/degradation';

export const ThreadRuntimeAvailable = createContext(false);

function formatTime(value: unknown): string | undefined {
  if (typeof value !== 'string' && typeof value !== 'number') return undefined;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return undefined;
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function MarkdownText() {
  return <MarkdownTextPrimitive />;
}

function ToolCallExcerpt(props: ToolCallMessagePartProps) {
  const toolName = props.toolName ?? 'tool';
  const meta = getToolMeta(toolName);
  if (meta.presentation === 'hidden') return null;

  const summary = props.argsText?.slice(0, 120) || meta.label;
  const resultObject =
    props.result != null && typeof props.result === 'object' ? props.result : null;
  const resultText =
    typeof props.result === 'string'
      ? props.result
      : resultObject == null && props.result != null
        ? String(props.result)
        : null;

  let argsObject: unknown = null;
  if (props.argsText) {
    try {
      argsObject = JSON.parse(props.argsText) as unknown;
    } catch {
      argsObject = null;
    }
  }

  const useJson =
    meta.presentation === 'json' && (resultObject != null || (argsObject != null && typeof argsObject === 'object'));

  return (
    <ThreadExcerpt
      kind="tool"
      excerptId={`tool-${props.toolCallId ?? toolName}`}
      speaker={`tool · ${meta.label}`}
      summary={summary}
      defaultCollapsed
    >
      {useJson ? (
        <div className="flex flex-col gap-2">
          {argsObject != null && typeof argsObject === 'object' ? (
            <ReceiptJson
              data={argsObject}
              defaultExpanded={1}
              />
          ) : props.argsText ? (
            <pre className="overflow-x-auto whitespace-pre-wrap font-ij-mono text-ij-ink-info">{props.argsText}</pre>
          ) : null}
          {resultObject != null ? (
            <ReceiptJson
              data={resultObject}
              defaultExpanded={1}
              />
          ) : resultText ? (
            <pre className="overflow-x-auto whitespace-pre-wrap font-ij-mono text-ij-ink-info">{resultText}</pre>
          ) : null}
        </div>
      ) : (
        <pre className="overflow-x-auto whitespace-pre-wrap font-ij-mono text-ij-ink-info">
          {[props.argsText, resultText].filter(Boolean).join('\n\n') || meta.label}
        </pre>
      )}
    </ThreadExcerpt>
  );
}

function MessageObjectExcerpts({ host, text }: { host: BlockHost; text: string }) {
  const addresses = useMemo(() => {
    const found: string[] = [];
    const parts = text.split(/\s+/);
    for (const part of parts) {
      const address = extractTheoremAddress(part);
      if (address) found.push(theoremUri(address));
    }
    return [...new Set(found)];
  }, [text]);

  if (addresses.length === 0) return null;
  return (
    <>
      {addresses.map((address) => (
        <ObjectExcerpt
          key={address}
          host={host}
          address={address}
          excerptId={`object-${address}`}
        />
      ))}
    </>
  );
}

function UserMessage({ host }: { host: BlockHost }) {
  const durations = useMotionDurations();
  const createdAt = useMessage((message) => message.createdAt);
  const content = useMessage((message) =>
    message.content
      .filter((part): part is { type: 'text'; text: string } => part.type === 'text')
      .map((part) => part.text)
      .join('\n'),
  );

  return (
    <MessagePrimitive.Root>
      <motion.div
        initial={durations.reduced ? false : { opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: seconds(durations.base), ease: EASE_OUT }}
      >
        <ThreadExcerpt
          kind="human"
          excerptId={`human-${String(createdAt ?? content.slice(0, 24))}`}
          speaker="human"
          timestamp={formatTime(createdAt)}
        >
          <MessagePrimitive.Parts />
          <MessageObjectExcerpts host={host} text={content} />
        </ThreadExcerpt>
      </motion.div>
    </MessagePrimitive.Root>
  );
}

function AssistantMessage({ host }: { host: BlockHost }) {
  const durations = useMotionDurations();
  const createdAt = useMessage((message) => message.createdAt);
  const degradationMeta = useMessage((message) => message.metadata.custom?.degradation) as
    | { degraded: true; missingIndexes: string[] }
    | undefined;
  const degradation = degradationMeta?.degraded
    ? reducedFromMissing(degradationMeta.missingIndexes)
    : null;
  const content = useMessage((message) =>
    message.content
      .filter((part): part is { type: 'text'; text: string } => part.type === 'text')
      .map((part) => part.text)
      .join('\n'),
  );

  return (
    <MessagePrimitive.Root>
      <motion.div
        initial={durations.reduced ? false : { opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: seconds(durations.base), ease: EASE_OUT }}
      >
        <ThreadExcerpt
          kind="agent"
          excerptId={`agent-${String(createdAt ?? content.slice(0, 24))}`}
          speaker="agent"
          timestamp={formatTime(createdAt)}
        >
          {degradation ? (
            <span
              data-ask-degraded
              data-degradation="reduced"
              className="mb-1 block text-ij-island-meta text-ij-ink-info"
              style={{ fontFamily: 'var(--cp-font-human)' }}
            >
              {degradation.cause}
            </span>
          ) : null}
          <MessagePrimitive.Parts
            components={{
              Text: MarkdownText,
              tools: { Fallback: ToolCallExcerpt },
            }}
          />
          <MessageObjectExcerpts host={host} text={content} />
        </ThreadExcerpt>
      </motion.div>
    </MessagePrimitive.Root>
  );
}

function AgentPlan({ steps }: { steps: readonly AgentPlanStep[] }) {
  if (steps.length === 0) return null;
  return (
    <ThreadExcerpt kind="plan" excerptId="agent-plan" speaker="plan" summary={`${steps.length} steps`}>
      <div data-agent-plan aria-label="Agent plan" className="overflow-hidden">
        {steps.map((step) => {
          const status = String(step.status);
          const tone =
            status === 'complete'
              ? 'done'
              : status === 'refused' || status === 'failed'
                ? 'failed'
                : status === 'running'
                  ? 'running'
                  : status === 'awaiting'
                    ? 'awaiting'
                    : 'pending';
          const className =
            tone === 'running'
              ? 'text-ij-ink-info animate-pulse'
              : tone === 'done'
                ? 'text-ij-ink'
                : tone === 'awaiting'
                  ? 'text-[color:var(--hue-status-awaiting)] animate-pulse'
                  : tone === 'failed'
                    ? 'text-[color:var(--hue-status-failed)]'
                    : 'text-ij-ink-disabled';
          return (
            <div
              key={step.id}
              data-plan-status={step.status}
              data-status-hue
              className={`flex h-ij-row items-center gap-2 border-b border-ij-seam last:border-b-0 ${className}`}
            >
              <span className="min-w-0 flex-1 truncate">{step.label}</span>
              {step.tool ? (
                <span className="font-ij-mono text-ij-ink-info" data-mono-ok>
                  {step.tool}
                </span>
              ) : null}
            </div>
          );
        })}
      </div>
    </ThreadExcerpt>
  );
}

interface StarterSuggestion {
  readonly id: string;
  readonly label: string;
  readonly prompt: string;
}

function titleOf(object: ObjectRef | undefined, fallback: string): string {
  return String(object?.properties.title ?? object?.properties.name ?? fallback);
}

const STARTER_SLOTS = [
  { id: 'recent-record', resting: 'Review a recent record' },
  { id: 'recent-document', resting: 'Summarize a recent document' },
  { id: 'runnable-action', resting: 'Plan an action' },
] as const;

function chipRefusal(connection: ConnectionState, endpointMissing: boolean): string | null {
  // Endpoint unavailable is owned by the composer status slot only.
  if (endpointMissing) return 'Chat endpoint is not configured';
  if (connection === 'unauthenticated') return 'Sign in required';
  if (connection === 'credential-unavailable') return 'Credential unavailable';
  if (connection === 'identity-refused') return 'Authentication refused';
  if (connection === 'disconnected') return 'Transport unreachable';
  if (connection === 'connecting') return 'Transport connecting';
  return null;
}

function StarterSuggestions({ host, disabled }: { host: BlockHost; disabled: boolean }) {
  const [suggestions, setSuggestions] = useState<readonly StarterSuggestion[]>([]);
  const connection = useShellStore((state) => state.connection);

  useEffect(() => {
    let active = true;
    void Promise.all([
      Promise.resolve(host.query({ types: ['record'], rank: [{ kind: 'field', field: 'updated', direction: 'desc' }], page: { limit: 1 } })),
      Promise.resolve(host.query({ types: ['doc'], rank: [{ kind: 'field', field: 'updated', direction: 'desc' }], page: { limit: 1 } })),
    ]).then(([records, docs]) => {
      if (!active) return;
      const record = records.objects[0];
      const doc = docs.objects[0];
      const recordTitle = titleOf(record, 'recent record');
      const docTitle = titleOf(doc, 'recent document');
      setSuggestions([
        { id: 'recent-record', label: `Review ${recordTitle}`, prompt: `Review the recent record: ${recordTitle}` },
        { id: 'recent-document', label: `Summarize ${docTitle}`, prompt: `Summarize the recent document: ${docTitle}` },
        { id: 'runnable-action', label: `Plan action for ${recordTitle}`, prompt: `/do Plan the next action for ${recordTitle}` },
      ]);
    }).catch(() => {
      if (active) setSuggestions([]);
    });
    return () => {
      active = false;
    };
  }, [host]);

  const refusal = chipRefusal(connection, disabled);

  return (
    <div className="flex h-full flex-col justify-end gap-3 px-3 pb-4 text-ij-ink-info" data-chat-empty-state>
      <p data-chat-empty-lede className="text-ij-ink">Start from live tenant context.</p>
      <div className="flex flex-wrap gap-2" data-chat-starters>
        {STARTER_SLOTS.map((slot) => {
          const live = suggestions.find((suggestion) => suggestion.id === slot.id);
          const reason = live ? null : (refusal ?? 'Tenant suggestions are unavailable');
          return (
            <button
              key={slot.id}
              type="button"
              data-chat-starter={slot.id}
              data-starter-refusal={reason ?? undefined}
              title={reason ?? undefined}
              disabled={reason !== null}
              onClick={() => (live ? void submitThreadText(live.prompt) : undefined)}
              className="inline-flex items-center border border-ij-control-border bg-ij-raised px-3 font-ij-ui text-ij-ink hover:bg-ij-hover-surface disabled:text-ij-ink-disabled"
              style={{
                height: 'var(--ij-chat-chip-h)',
                fontSize: 'var(--ij-chat-chip-font-size)',
                borderRadius: 'var(--ij-chat-chip-radius)',
                transition: 'var(--rec-clickable-transition)',
              }}
            >
              {live ? live.label : slot.resting}
            </button>
          );
        })}
      </div>
      <p data-composer-hint className="text-ij-ink-disabled">{NEW_LINE_HINT}</p>
    </div>
  );
}
export function ThreadView({ host, density = 'compact' }: { host: BlockHost; density?: 'full' | 'compact' }) {
  const runtimeAvailable = useContext(ThreadRuntimeAvailable);
  const error = useThreadStore((state) => state.error);
  const plan = useThreadStore((state) => state.plan);
  const endpoint = chatEndpoint();
  const [webSearchAvailable, setWebSearchAvailable] = useState(false);

  useEffect(() => {
    let active = true;
    void fetch('/api/capabilities', { cache: 'no-store' })
      .then(async (response) => {
        if (!response.ok) return false;
        const body = (await response.json()) as { web_search?: unknown };
        return body.web_search === true;
      })
      .then((available) => {
        if (active) setWebSearchAvailable(available);
      })
      .catch(() => {
        if (active) setWebSearchAvailable(false);
      });
    return () => {
      active = false;
    };
  }, []);

  if (!runtimeAvailable) {
    return (
      <div className="m-3 rounded-ij-arc border border-ij-seam-raised bg-ij-raised p-4 text-ij-ink-info">
        Thread unavailable outside an assistant runtime.
      </div>
    );
  }

  const full = density === 'full';
  return (
    <ThreadPrimitive.Root
      data-chat-surface={full ? 'full' : undefined}
      className={`relative flex h-full min-h-0 flex-col ${full ? 'bg-ij-editor' : 'bg-ij-chrome'}`}
    >
      <ThreadPrimitive.Viewport className="min-h-0 flex-1 overflow-y-auto">
        <div
          className={`relative mx-auto flex h-full w-full flex-col ${full ? 'pt-8' : ''}`}
          style={full ? { maxWidth: 'var(--ij-thread-column-max)' } : undefined}
        >
          <ThreadPrimitive.Empty>
            <div className="flex flex-col items-center gap-3 px-4 py-8" data-presence-mark-placement="thread-idle">
              <PresenceMark state="idle" size={48} />
              <StarterSuggestions host={host} disabled={!endpoint} />
            </div>
          </ThreadPrimitive.Empty>
          <ThreadPrimitive.Messages
            components={{
              UserMessage: function BoundUserMessage() {
                return <UserMessage host={host} />;
              },
              AssistantMessage: function BoundAssistantMessage() {
                return <AssistantMessage host={host} />;
              },
            }}
          />
          <AgentPlan steps={plan} />
          {error ? <div className="px-4 py-1 text-ij-error">{error}</div> : null}
          {/* CS20 cause: JumpStrip mirrored excerpt labels into a floating nav, duplicating the human box. */}
        </div>
      </ThreadPrimitive.Viewport>
      <div
        className={full ? 'mx-auto mb-24 w-full px-6' : 'p-2'}
        style={full ? { maxWidth: 'var(--ij-thread-column-max)' } : undefined}
        data-composer-zone
      >
        <Composer
          host={host}
          compact={!full}
          unavailable={!endpoint}
          webSearchAvailable={webSearchAvailable}
        />
      </div>
    </ThreadPrimitive.Root>
  );
}
